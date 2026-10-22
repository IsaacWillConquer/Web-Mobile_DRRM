import 'dart:math' as math;

import '../models/typhoon.dart';
import 'overlays.dart';

/// Pure camera-framing helpers. No Flutter/MapLibre imports so they are
/// unit-testable. All public points are `[lat, lng]` unless noted.

/// Never frame tighter than this many degrees (~330 km) on either axis, so a
/// short track or a single small province does not zoom in absurdly close.
const double kMinFitSpanDeg = 3.0;

/// Rough bounding box of the whole Philippines (incl. Sulu / Batanes).
const GeoBounds philippinesBounds = GeoBounds(
  south: 4.5,
  west: 116.0,
  north: 21.5,
  east: 127.0,
);

bool isInPhilippines(double lat, double lng) =>
    philippinesBounds.contains(lat, lng);

/// A geographic bounding box in degrees.
class GeoBounds {
  const GeoBounds({
    required this.south,
    required this.west,
    required this.north,
    required this.east,
  });

  final double south;
  final double west;
  final double north;
  final double east;

  double get latSpan => north - south;
  double get lngSpan => east - west;
  double get centerLat => (south + north) / 2;
  double get centerLng => (west + east) / 2;

  bool contains(double lat, double lng) =>
      lat >= south && lat <= north && lng >= west && lng <= east;

  /// Smallest box covering every `[lat, lng]` pair, or null when empty.
  static GeoBounds? fromLatLngs(Iterable<List<double>> points) {
    final list = points.toList();
    if (list.isEmpty) return null;
    var south = list.first[0];
    var north = south;
    var west = list.first[1];
    var east = west;
    for (final p in list) {
      south = math.min(south, p[0]);
      north = math.max(north, p[0]);
      west = math.min(west, p[1]);
      east = math.max(east, p[1]);
    }
    return GeoBounds(south: south, west: west, north: north, east: east);
  }

  /// Grows the box (around its centre) so neither side is smaller than
  /// [minSpanDeg]. Boxes already larger are returned unchanged.
  GeoBounds withMinSpan(double minSpanDeg) {
    var s = south;
    var n = north;
    var w = west;
    var e = east;
    if (latSpan < minSpanDeg) {
      final half = minSpanDeg / 2;
      s = centerLat - half;
      n = centerLat + half;
    }
    if (lngSpan < minSpanDeg) {
      final half = minSpanDeg / 2;
      w = centerLng - half;
      e = centerLng + half;
    }
    return GeoBounds(south: s, west: w, north: n, east: e);
  }
}

/// Bounds of every coordinate inside a GeoJSON object (FeatureCollection,
/// Feature, or bare geometry). GeoJSON stores `[lng, lat]`; this returns a
/// normal lat/lng box. Null when there are no coordinates.
GeoBounds? boundsForGeoJson(Object? geojson) {
  final points = <List<double>>[];
  _collectGeoJson(geojson, points);
  return GeoBounds.fromLatLngs(points);
}

/// Bounds covering everything the Typhoons layer draws: the track, forecast
/// points, forecast cone and the danger circle around the current position.
GeoBounds? boundsForTyphoon(Typhoon typhoon) {
  final points = <List<double>>[
    ...typhoon.track,
    for (final p in typhoon.forecast) [p.lat, p.lng],
  ];

  final cone = typhoon.cone;
  if (cone != null) _collectGeoJson(cone, points);

  final radiusKm = typhoon.dangerRadiusKm;
  if (radiusKm != null && typhoon.track.isNotEmpty) {
    final center = typhoon.track.last;
    for (final ring in circleRing(center[0], center[1], radiusKm)) {
      points.add([ring[1], ring[0]]); // ring is [lng, lat]
    }
  }
  return GeoBounds.fromLatLngs(points);
}

void _collectGeoJson(Object? node, List<List<double>> out) {
  if (node is Map) {
    for (final key in const ['features', 'geometry', 'geometries', 'coordinates']) {
      final child = node[key];
      if (child != null) _collectGeoJson(child, out);
    }
  } else if (node is List) {
    if (node.length >= 2 && node[0] is num && node[1] is num) {
      out.add([(node[1] as num).toDouble(), (node[0] as num).toDouble()]);
    } else {
      for (final child in node) {
        _collectGeoJson(child, out);
      }
    }
  }
}
