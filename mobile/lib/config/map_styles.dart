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

  static MapStyleOption get defaultStyle => all.first;
}
