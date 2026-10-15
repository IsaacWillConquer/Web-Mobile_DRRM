import 'dart:convert';
import 'dart:math' as math;

import '../models/rain_forecast.dart';
import '../models/typhoon.dart';
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
