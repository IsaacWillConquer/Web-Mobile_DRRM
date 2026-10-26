import 'dart:convert';
import 'dart:math' as math;

import '../models/rain_forecast.dart';
import '../models/typhoon.dart';
import 'pagasa.dart';
import 'province_lookup.dart';

/// Pure GeoJSON builders for the map overlays. Kept free of Flutter/MapLibre
/// so they are unit-testable.

Map<String, dynamic> parseGeoJson(String raw) =>
    jsonDecode(raw) as Map<String, dynamic>;

/// Province choropleth of PAGASA wind signals. Provinces with a matching signal
/// level get a `level` property; others are omitted.
Map<String, dynamic> buildStormSignals(
  Map<String, dynamic> provinces,
  List<StormSignal> signals,
) {
  final levelByArea = <String, int>{};
  for (final signal in signals) {
    for (final area in signal.areas) {
      final key = canonicalArea(area);
      final previous = levelByArea[key] ?? 0;
      if (signal.level > previous) levelByArea[key] = signal.level;
    }
  }
  return _choropleth(provinces, (name) => levelByArea[canonicalArea(name)]);
}

/// Region choropleth of weekly rainfall (Open-Meteo).
/// Rain choropleth. [areas] is the provinces or regions GeoJSON the forecast
/// was made for; each area is labelled with its 7-day total in mm.
Map<String, dynamic> buildRainForecast(
  Map<String, dynamic> areas,
  List<RegionRain> rain,
) {
  final byArea = {for (final r in rain) canonicalArea(r.name): r};
  return _choropleth(
    areas,
    (name) => byArea[canonicalArea(name)]?.level,
    labelOf: (name) {
      final entry = byArea[canonicalArea(name)];
      return entry == null ? '' : entry.mm.round().toString();
    },
  );
}

/// Colour and caption of each rain level. Same thresholds as `levelForMm` in
/// scripts/lib/rain_geo.js; shared by the map fill and the legend.
class RainLevelStyle {
  const RainLevelStyle(this.level, this.colorHex, this.label);

  final int level;
  final String colorHex;
  final String label;
}

const List<RainLevelStyle> kRainLevels = [
  RainLevelStyle(1, '#93C5FD', 'Light · under 50 mm'),
  RainLevelStyle(2, '#FCD34D', 'Moderate · 50–149 mm'),
  RainLevelStyle(3, '#F87171', 'Heavy · 150 mm or more'),
];

Map<String, dynamic> _choropleth(
  Map<String, dynamic> base,
  int? Function(String name) levelOf, {
  String Function(String name)? labelOf,
}) {
  final features = <Map<String, dynamic>>[];
  for (final raw in (base['features'] as List)) {
    final feature = (raw as Map).cast<String, dynamic>();
    final props = (feature['properties'] as Map).cast<String, dynamic>();
    final name = (props['name'] ?? '').toString();
    final level = levelOf(name);
    if (level == null) continue;
    features.add({
      'type': 'Feature',
      'properties': {
        'name': name,
        'level': level,
        'label': labelOf?.call(name) ?? '$level',
      },
      'geometry': feature['geometry'],
    });
  }
  return {'type': 'FeatureCollection', 'features': features};
}

/// Typhoon track as a LineString (GeoJSON [lng, lat] order).
Map<String, dynamic> buildTyphoonTrack(Typhoon typhoon) {
  return {
    'type': 'Feature',
    'properties': const <String, dynamic>{},
    'geometry': {
      'type': 'LineString',
      'coordinates': [for (final p in typhoon.track) [p[1], p[0]]],
    },
  };
}

/// Forecast points as a FeatureCollection.
Map<String, dynamic> buildTyphoonForecast(Typhoon typhoon) {
  return {
    'type': 'FeatureCollection',
    'features': [
      for (final point in typhoon.forecast)
        {
          'type': 'Feature',
          'properties': {
            'label': point.label ?? '${point.hours ?? ''}H',
            'hours': point.hours ?? 0,
          },
          'geometry': {
            'type': 'Point',
            'coordinates': [point.lng, point.lat],
          },
        },
    ],
  };
}

/// Colour and wind range of each PAGASA tropical cyclone wind signal (TCWS).
/// Shared by the map fill and the legend so they cannot drift apart.
class SignalLevelStyle {
  const SignalLevelStyle(this.level, this.colorHex, this.winds);

  final int level;
  final String colorHex;
  final String winds;
}

const List<SignalLevelStyle> kSignalLevels = [
  SignalLevelStyle(1, '#1E88E5', '39–61 km/h'),
  SignalLevelStyle(2, '#F9A825', '62–88 km/h'),
  SignalLevelStyle(3, '#EF6C00', '89–117 km/h'),
  SignalLevelStyle(4, '#D32F2F', '118–184 km/h'),
  SignalLevelStyle(5, '#C2185B', '185 km/h or more'),
];

// ---------------------------------------------------------------------------
// One label per feature. A symbol layer on the polygons would label EVERY part
// of a multi-part province (each island), so labels get their own point source.
// ---------------------------------------------------------------------------

/// A point inside the largest part of a Polygon/MultiPolygon, kept away from
/// its edges (a cheap "pole of inaccessibility"), as GeoJSON [lng, lat].
/// Null when the geometry has no usable ring.
List<double>? labelPoint(Object? geometry) {
  if (geometry is! Map) return null;
  final type = geometry['type'];
  final coords = geometry['coordinates'];
  if (coords is! List) return null;

  final rings = <List<List<double>>>[]; // outer ring of each part
  if (type == 'Polygon') {
    final ring = _readRing(coords.isEmpty ? null : coords.first);
    if (ring.isNotEmpty) rings.add(ring);
  } else if (type == 'MultiPolygon') {
    for (final polygon in coords) {
      if (polygon is List && polygon.isNotEmpty) {
        final ring = _readRing(polygon.first);
        if (ring.isNotEmpty) rings.add(ring);
      }
    }
  }
  if (rings.isEmpty) return null;

  var largest = rings.first;
  var largestArea = _ringArea(largest);
  for (final ring in rings.skip(1)) {
    final area = _ringArea(ring);
    if (area > largestArea) {
      largest = ring;
      largestArea = area;
    }
  }
  return _interiorPoint(largest);
}

/// Turns a polygon FeatureCollection into one Point per feature (properties
/// are kept, so `label`/`level` still work). Features without geometry drop out.
Map<String, dynamic> buildLabelPoints(Map<String, dynamic> polygons) {
  final features = <Map<String, dynamic>>[];
  for (final raw in (polygons['features'] as List)) {
    final feature = (raw as Map).cast<String, dynamic>();
    final point = labelPoint(feature['geometry']);
    if (point == null) continue;
    features.add({
      'type': 'Feature',
      'properties': feature['properties'] ?? const <String, dynamic>{},
      'geometry': {'type': 'Point', 'coordinates': point},
    });
  }
  return {'type': 'FeatureCollection', 'features': features};
}

List<List<double>> _readRing(Object? raw) {
  if (raw is! List) return const [];
  return [
    for (final p in raw)
      if (p is List && p.length >= 2 && p[0] is num && p[1] is num)
        [(p[0] as num).toDouble(), (p[1] as num).toDouble()],
  ];
}

double _ringArea(List<List<double>> ring) {
  var sum = 0.0;
  for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  return sum.abs() / 2;
}

bool _inRing(List<List<double>> ring, double x, double y) {
  var inside = false;
  for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    final xi = ring[i][0];
    final yi = ring[i][1];
    final xj = ring[j][0];
    final yj = ring[j][1];
    if ((yi > y) != (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

double _distToSegment(
  double px,
  double py,
  double ax,
  double ay,
  double bx,
  double by,
) {
  final dx = bx - ax;
  final dy = by - ay;
  final len2 = dx * dx + dy * dy;
  final t = len2 == 0
      ? 0.0
      : math.max(0.0, math.min(1.0, ((px - ax) * dx + (py - ay) * dy) / len2));
  final cx = ax + t * dx;
  final cy = ay + t * dy;
  return math.sqrt((px - cx) * (px - cx) + (py - cy) * (py - cy));
}

double _distToRing(List<List<double>> ring, double x, double y) {
  var best = double.infinity;
  for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    best = math.min(
      best,
      _distToSegment(x, y, ring[j][0], ring[j][1], ring[i][0], ring[i][1]),
    );
  }
  return best;
}

/// Grid search for the inside point farthest from the ring's edges, narrowing
/// the search window around the best point a few times.
List<double> _interiorPoint(List<List<double>> ring) {
  var x0 = ring.first[0];
  var x1 = x0;
  var y0 = ring.first[1];
  var y1 = y0;
  for (final p in ring) {
    x0 = math.min(x0, p[0]);
    x1 = math.max(x1, p[0]);
    y0 = math.min(y0, p[1]);
    y1 = math.max(y1, p[1]);
  }

  var bestX = (x0 + x1) / 2;
  var bestY = (y0 + y1) / 2;
  var bestDist = _inRing(ring, bestX, bestY) ? _distToRing(ring, bestX, bestY) : -1.0;

  const steps = 12;
  for (var round = 0; round < 4; round++) {
    for (var i = 0; i <= steps; i++) {
      for (var j = 0; j <= steps; j++) {
        final x = x0 + (x1 - x0) * i / steps;
        final y = y0 + (y1 - y0) * j / steps;
        if (!_inRing(ring, x, y)) continue;
        final d = _distToRing(ring, x, y);
        if (d > bestDist) {
          bestDist = d;
          bestX = x;
          bestY = y;
        }
      }
    }
    final halfW = (x1 - x0) / 6;
    final halfH = (y1 - y0) / 6;
    x0 = bestX - halfW;
    x1 = bestX + halfW;
    y0 = bestY - halfH;
    y1 = bestY + halfH;
  }
  return [bestX, bestY];
}

// ---------------------------------------------------------------------------
// Typhoon layers: past track, forecast line, markers, wind circles.
// ---------------------------------------------------------------------------

const List<String> _weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/// Clock label in Philippine time (UTC+8), e.g. `Sun 8AM` or `Sat 11:30PM`.
String phtClockLabel(DateTime when) {
  final t = when.toUtc().add(const Duration(hours: 8));
  final hour12 = t.hour % 12 == 0 ? 12 : t.hour % 12;
  final suffix = t.hour < 12 ? 'AM' : 'PM';
  final minutes = t.minute == 0 ? '' : ':${t.minute.toString().padLeft(2, '0')}';
  return '${_weekdays[t.weekday - 1]} $hour12$minutes$suffix';
}

/// Forecast points that get a map marker: 12H and 24H, then every later point
/// (JMA's day-spaced forecasts). JMA also publishes 3H..21H every 3 hours;
/// labelling all of those would bury the map. Points without a lead time stay.
List<TyphoonPoint> selectForecastMarkers(List<TyphoonPoint> forecast) {
  return [
    for (final p in forecast)
      if (p.hours == null || p.hours == 12 || p.hours! >= 24) p,
  ];
}

/// Marker caption: `12H` style up to 24 hours out, Philippine clock time after
/// that (JMA's later forecasts sit at fixed UTC times, so "45H" means little).
String forecastMarkerTime(TyphoonPoint point) {
  final hours = point.hours;
  if (hours != null && hours <= 24) return point.label ?? '${hours}H';
  final validAt = point.validAt;
  if (validAt != null) return phtClockLabel(validAt);
  return point.label ?? (hours == null ? '' : '${hours}H');
}

Map<String, dynamic> _marker({
  required double lat,
  required double lng,
  required String time,
  String? code,
}) {
  return {
    'type': 'Feature',
    'properties': {
      'time': time,
      'code': code ?? '',
      'color': categoryColorHex(code),
    },
    'geometry': {
      'type': 'Point',
      'coordinates': [lng, lat],
    },
  };
}

/// Current position (`NOW`) plus the selected forecast points, each with a
/// category code and colour for the marker.
Map<String, dynamic> buildTyphoonMarkers(Typhoon typhoon) {
  final features = <Map<String, dynamic>>[];
  if (typhoon.track.isNotEmpty) {
    final now = typhoon.track.last;
    features.add(
      _marker(
        lat: now[0],
        lng: now[1],
        time: 'NOW',
        code: markerCode(
          windKph: typhoon.maxWindsKph,
          jmaClass: typhoon.jmaClass,
        ),
      ),
    );
  }
  for (final p in selectForecastMarkers(typhoon.forecast)) {
    features.add(
      _marker(
        lat: p.lat,
        lng: p.lng,
        time: forecastMarkerTime(p),
        code: markerCode(windKph: p.windKph, jmaClass: p.jmaClass),
      ),
    );
  }
  return {'type': 'FeatureCollection', 'features': features};
}

Map<String, dynamic>? _line(List<List<double>> latLngs) {
  if (latLngs.length < 2) return null;
  return {
    'type': 'Feature',
    'properties': const <String, dynamic>{},
    'geometry': {
      'type': 'LineString',
      'coordinates': [for (final p in latLngs) [p[1], p[0]]],
    },
  };
}

/// Past track as two lines: the depression stage (first `preTrackCount`
/// points) and the rest. They share the hand-over point so the path is
/// continuous. Either is null when it has fewer than two points.
({Map<String, dynamic>? pre, Map<String, dynamic>? main}) buildTyphoonPastTrack(
  Typhoon typhoon,
) {
  final points = typhoon.track;
  final split = typhoon.preTrackCount.clamp(0, points.length).toInt();
  if (split == 0) return (pre: null, main: _line(points));
  return (
    pre: _line(points.sublist(0, split)),
    main: _line(points.sublist(split - 1)),
  );
}

/// Dashed forecast path: from the current position through every forecast
/// point (not only the labelled ones). Null when there is nothing to draw.
Map<String, dynamic>? buildTyphoonForecastLine(Typhoon typhoon) {
  if (typhoon.track.isEmpty) return null;
  return _line([
    typhoon.track.last,
    for (final p in typhoon.forecast) [p.lat, p.lng],
  ]);
}

/// Storm-force circle. Old bulletins only had `dangerRadiusKm` centred on the
/// storm; that is used when there is no gale/storm area at all.
WindArea? stormRing(Typhoon typhoon) {
  if (typhoon.stormArea != null) return typhoon.stormArea;
  final radius = typhoon.dangerRadiusKm;
  if (typhoon.galeArea == null && radius != null && typhoon.track.isNotEmpty) {
    final c = typhoon.track.last;
    return WindArea(lat: c[0], lng: c[1], radiusKm: radius);
  }
  return null;
}

/// A wind circle as a one-polygon FeatureCollection.
Map<String, dynamic> buildWindAreaPolygon(WindArea area) {
  return {
    'type': 'FeatureCollection',
    'features': [
      {
        'type': 'Feature',
        'properties': const <String, dynamic>{},
        'geometry': {
          'type': 'Polygon',
          'coordinates': [circleRing(area.lat, area.lng, area.radiusKm)],
        },
      },
    ],
  };
}

/// A geodesic ring (GeoJSON [lng, lat] pairs) approximating a circle of
/// [radiusKm] around a centre.
List<List<double>> circleRing(double lat, double lng, double radiusKm,
    {int steps = 64}) {
  const earthKm = 6371.0;
  final latR = lat * math.pi / 180;
  final lngR = lng * math.pi / 180;
  final angular = radiusKm / earthKm;
  final ring = <List<double>>[];
  for (var i = 0; i <= steps; i++) {
    final bearing = 2 * math.pi * i / steps;
    final lat2 = math.asin(
      math.sin(latR) * math.cos(angular) +
          math.cos(latR) * math.sin(angular) * math.cos(bearing),
    );
    final lng2 = lngR +
        math.atan2(
          math.sin(bearing) * math.sin(angular) * math.cos(latR),
          math.cos(angular) - math.sin(latR) * math.sin(lat2),
        );
    ring.add([lng2 * 180 / math.pi, lat2 * 180 / math.pi]);
  }
  return ring;
}
