import 'dart:convert';

import 'package:flutter/services.dart' show rootBundle;

const Map<String, String> _areaAliases = {
  'ncr': 'metro manila',
  'national capital region': 'metro manila',
  'metro manila': 'metro manila',
  'compostela valley': 'davao de oro',
  'maguindanao del norte': 'maguindanao',
  'maguindanao del sur': 'maguindanao',
  'barmm': 'armm',
  'western samar': 'samar',
};

String canonicalArea(String name) {
  var key = name
      .toLowerCase()
      .replaceAll(RegExp(r'\(.*?\)'), ' ')
      .replaceAll(RegExp(r'[^a-z0-9 ]'), ' ')
      .replaceAll(RegExp(r'\s+'), ' ')
      .trim();
  if (key.startsWith('province of ')) {
    key = key.substring('province of '.length);
  }
  return _areaAliases[key] ?? key;
}

class ProvinceLookup {
  ProvinceLookup._(this._regions);

  final List<_Region> _regions;

  static ProvinceLookup? _instance;

  static Future<ProvinceLookup> load() async {
    final cached = _instance;
    if (cached != null) return cached;
    final raw = await rootBundle.loadString('assets/geo/ph_provinces.geojson');
    return _instance = ProvinceLookup.fromGeoJson(raw);
  }

  factory ProvinceLookup.fromGeoJson(String raw) {
    final decoded = jsonDecode(raw) as Map<String, dynamic>;
    final features = (decoded['features'] as List).cast<Map<String, dynamic>>();
    final regions = <_Region>[];
    for (final feature in features) {
      final name = (feature['properties'] as Map)['name'] as String;
      final geometry = feature['geometry'] as Map<String, dynamic>;
      regions.add(_Region(name, geometry));
    }
    return ProvinceLookup._(regions);
  }

  String? provinceAt(double lat, double lng) {
    for (final region in _regions) {
      if (region.contains(lat, lng)) return region.name;
    }
    return null;
  }
}

class _Region {
  _Region(this.name, Map<String, dynamic> geometry)
      : _polygons = _parse(geometry);

  final String name;
  final List<_Polygon> _polygons;

  bool contains(double lat, double lng) {
    for (final polygon in _polygons) {
      if (polygon.contains(lng, lat)) return true;
    }
    return false;
  }

  static List<_Polygon> _parse(Map<String, dynamic> geometry) {
    final type = geometry['type'] as String;
    final coordinates = geometry['coordinates'] as List;
    if (type == 'Polygon') {
      return [_Polygon(coordinates)];
    }
    return [for (final polygon in coordinates) _Polygon(polygon as List)];
  }
}

class _Polygon {
  _Polygon(List rawRings)
      : rings = [for (final ring in rawRings) _Ring(ring as List)];

  final List<_Ring> rings;

  bool contains(double x, double y) {
    if (!rings.first.contains(x, y)) return false;
    for (var i = 1; i < rings.length; i++) {
      if (rings[i].contains(x, y)) return false;
    }
    return true;
  }
}

class _Ring {
  _Ring(List raw) : _points = [for (final p in raw) p as List] {
    xs = [for (final p in _points) (p[0] as num).toDouble()];
    ys = [for (final p in _points) (p[1] as num).toDouble()];
  }

  final List<List> _points;
  late final List<double> xs;
  late final List<double> ys;

  bool contains(double x, double y) {
    var inside = false;
    final n = _points.length;
    for (var i = 0, j = n - 1; i < n; j = i++) {
      final xi = xs[i];
      final yi = ys[i];
      final xj = xs[j];
      final yj = ys[j];
      if (((yi > y) != (yj > y)) &&
          (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    return inside;
  }
}
