enum MapOverlay { none, typhoons, stormSignals, rainForecast }

class MapStyleOption {
  const MapStyleOption({
    required this.id,
    required this.label,
    required this.url,
  });

  final String id;
  final String label;
  final String url;
}
