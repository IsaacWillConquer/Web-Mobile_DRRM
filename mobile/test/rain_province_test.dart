import 'package:drrm_mobile/core/overlays.dart';
import 'package:drrm_mobile/models/rain_forecast.dart';
import 'package:flutter_test/flutter_test.dart';

Map<String, dynamic> _areas(List<String> names) => {
      'type': 'FeatureCollection',
      'features': [
        for (final n in names)
          {
            'type': 'Feature',
            'properties': {'name': n},
            'geometry': {
              'type': 'Polygon',
              'coordinates': [
                [
                  [120.0, 14.0],
                  [121.0, 14.0],
                  [121.0, 15.0],
                  [120.0, 14.0],
                ],
              ],
            },
          },
      ],
    };

List<Map> _features(Map<String, dynamic> collection) =>
    (collection['features'] as List).cast<Map>();

void main() {
  group('RainForecast.fromMap', () {
    test('reads per-province documents', () {
      final f = RainForecast.fromMap({
        'source': 'Open-Meteo',
        'provinces': [
          {'name': 'Pampanga', 'level': 3, 'mm': 401.4},
          {'name': 'Cebu', 'level': 1, 'mm': 21},
        ],
      });
      expect(f.byProvince, isTrue);
      expect(f.regions.map((r) => r.name), ['Pampanga', 'Cebu']);
      expect(f.regions.first.mm, 401.4);
    });

    test('falls back to the old per-region documents', () {
      final f = RainForecast.fromMap({
        'regions': [
          {'name': 'NCR', 'level': 3, 'mm': 455},
        ],
      });
      expect(f.byProvince, isFalse);
      expect(f.regions.single.name, 'NCR');
    });

    test('an empty provinces list falls back to regions', () {
      final f = RainForecast.fromMap({
        'provinces': const [],
        'regions': [
          {'name': 'NCR', 'level': 2, 'mm': 90},
        ],
      });
      expect(f.byProvince, isFalse);
      expect(f.regions.length, 1);
    });
  });

  group('buildRainForecast', () {
    const rain = [
      RegionRain(name: 'Pampanga', level: 3, mm: 401.4),
      RegionRain(name: 'Cebu', level: 1, mm: 20.6),
    ];

    test('labels each area with its rounded 7-day total in mm', () {
      final features = _features(buildRainForecast(_areas(['Pampanga', 'Cebu']), rain));
      expect(features.map((f) => f['properties']['label']), ['401', '21']);
      expect(features.map((f) => f['properties']['level']), [3, 1]);
    });

    test('areas without a forecast are left out', () {
      final features = _features(buildRainForecast(_areas(['Pampanga', 'Sulu']), rain));
      expect(features.length, 1);
      expect(features.single['properties']['name'], 'Pampanga');
    });

    test('districts that share a name are all coloured (Metro Manila)', () {
      final features = _features(buildRainForecast(
        _areas(['Metro Manila', 'Metro Manila', 'Metro Manila', 'Metro Manila']),
        const [RegionRain(name: 'Metro Manila', level: 3, mm: 316)],
      ));
      expect(features.length, 4);
      expect(features.every((f) => f['properties']['label'] == '316'), isTrue);
    });
  });

  test('kRainLevels: three levels, distinct colours, thresholds in the captions', () {
    expect(kRainLevels.map((s) => s.level), [1, 2, 3]);
    expect(kRainLevels.map((s) => s.colorHex).toSet().length, 3);
    expect(kRainLevels[0].label, contains('50'));
    expect(kRainLevels[1].label, allOf(contains('50'), contains('149')));
    expect(kRainLevels[2].label, contains('150'));
  });
}
