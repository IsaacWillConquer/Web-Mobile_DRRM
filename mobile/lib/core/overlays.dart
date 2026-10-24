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
Map<String, dynamic> buildRainForecast(
  Map<String, dynamic> regions,
  List<RegionRain> rain,
) {
  final levelByArea = {for (final r in rain) canonicalArea(r.name): r.level};
  return _choropleth(regions, (name) => levelByArea[canonicalArea(name)]);
}

Map<String, dynamic> _choropleth(
  Map<String, dynamic> base,
  int? Function(String name) levelOf,
) {
  final features = <Map<String, dynamic>>[];
  for (final raw in (base['features'] as List)) {
    final feature = (raw as Map).cast<String, dynamic>();
    final props = (feature['properties'] as Map).cast<String, dynamic>();
    final name = (props['name'] ?? '').toString();
    final level = levelOf(name);
    if (level == null) continue;
    features.add({
      'type': 'Feature',
      'properties': {'name': name, 'level': level, 'label': '$level'},
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
