import 'dart:convert';

import 'package:http/http.dart' as http;

import '../models/map_overlay.dart';
import 'map_config.dart';

/// Selectable base-map styles. MapTiler styles are keyed; OpenFreeMap ones are
/// keyless fallbacks. Attribution is rendered by MapLibre.
class MapStyles {
  static String _maptiler(String id) =>
      'https://api.maptiler.com/maps/$id/style.json?key=${MapConfig.mapTilerKey}';

  static final List<MapStyleOption> all = [
    MapStyleOption(id: 'streets', label: 'Streets', url: _maptiler('streets-v4')),
    MapStyleOption(id: 'basic', label: 'Basic', url: _maptiler('basic-v2')),
    MapStyleOption(id: 'dataviz', label: 'Dataviz', url: _maptiler('dataviz-v2')),
    MapStyleOption(
      id: 'positron',
      label: 'Positron (OSM)',
      url: 'https://tiles.openfreemap.org/styles/positron',
    ),
    MapStyleOption(
      id: 'bright',
      label: 'Bright (OSM)',
      url: 'https://tiles.openfreemap.org/styles/bright',
    ),
  ];

  /// The calm grey basemap (OpenFreeMap Positron) is the default for the
  /// overlay map — light, keyless, and it keeps the hazard colours readable.
  static MapStyleOption get defaultStyle =>
      all.firstWhere((s) => s.id == 'positron');

  // Label source-layers we strip so only place/boundary names remain.
  static const Set<String> _droppedLabelLayers = {
    'transportation_name',
    'housenumber',
    'poi',
    'poi_label',
    'airport_label',
    'transit',
    'transit_stop_label',
    'water_name',
    'waterway_label',
    'mountain_peak_label',
    'highway_shield',
  };

  /// Tint the Positron water layers so oceans/lakes/rivers read as water while
  /// the land stays calm grey. Must match the web (mapStyle.js).
  static const String _waterColor = '#B9D4EA';
  static const String _waterwayColor = '#9CC0DC';

  /// Fetches the Positron style, removes street/POI/building labels so the
  /// basemap shows place names only, and tints the water blue. Falls back to the
  /// plain style URL on any network/parse error, so the map always loads.
  static Future<String> resolveDefaultStyle() async {
    final url = defaultStyle.url;
    try {
      final res =
          await http.get(Uri.parse(url)).timeout(const Duration(seconds: 12));
      if (res.statusCode != 200) return url;
      final style = jsonDecode(res.body) as Map<String, dynamic>;
      final layers = (style['layers'] as List?)?.cast<dynamic>();
      if (layers == null) return url;
      style['layers'] = layers.where((dynamic layer) {
        if (layer is! Map) return true;
        if (layer['type'] != 'symbol') return true;
        final sourceLayer = (layer['source-layer'] ?? '').toString();
        return !_droppedLabelLayers.contains(sourceLayer);
      }).map(_recolorWater).toList();
      return jsonEncode(style);
    } catch (_) {
      return url;
    }
  }

  /// Recolors the water (fill) and waterway (line) layers in place.
  static dynamic _recolorWater(dynamic layer) {
    if (layer is! Map) return layer;
    final sourceLayer = (layer['source-layer'] ?? '').toString();
    final paint = (layer['paint'] as Map?)?.cast<String, dynamic>();
    if (paint == null) return layer;
    if (layer['type'] == 'fill' && sourceLayer == 'water') {
      paint['fill-color'] = _waterColor;
    } else if (layer['type'] == 'line' && sourceLayer == 'waterway') {
      paint['line-color'] = _waterwayColor;
    }
    return layer;
  }
}
