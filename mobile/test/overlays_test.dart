import 'package:drrm_mobile/core/overlays.dart';
import 'package:drrm_mobile/models/rain_forecast.dart';
import 'package:drrm_mobile/models/typhoon.dart';
import 'package:flutter_test/flutter_test.dart';

Map<String, dynamic> _featureCollection(List<String> names) => {
      'type': 'FeatureCollection',
      'features': [
        for (final name in names)
          {
            'type': 'Feature',
            'properties': {'name': name},
            'geometry': {
              'type': 'Polygon',
              'coordinates': [
                [
                  [120.0, 14.0],
                  [121.0, 14.0],
                  [121.0, 15.0],
                  [120.0, 15.0],
                  [120.0, 14.0],
                ],
              ],
            },
          },
      ],
    };

void main() {
  test('buildStormSignals levels matched provinces and drops the rest', () {
    final result = buildStormSignals(
      _featureCollection(['Bulacan', 'Cebu']),
      const [StormSignal(level: 2, areas: ['Bulacan', 'NCR'])],
    );
    final features = (result['features'] as List).cast<Map>();
    expect(features.length, 1);
    expect(features.first['properties']['name'], 'Bulacan');
    expect(features.first['properties']['level'], 2);
  });

  test('buildStormSignals uses the highest level for an area', () {
    final result = buildStormSignals(
      _featureCollection(['Bulacan']),
      const [
        StormSignal(level: 1, areas: ['Bulacan']),
        StormSignal(level: 3, areas: ['Bulacan', 'NCR']),
      ],
    );
    final features = (result['features'] as List).cast<Map>();
    expect(features.single['properties']['level'], 3);
  });

  test('buildRainForecast matches via area aliases (NCR <-> Metro Manila)', () {
    final result = buildRainForecast(
      _featureCollection(['NCR', 'Cebu']),
      const [RegionRain(name: 'Metro Manila', level: 3, mm: 210)],
    );
    final features = (result['features'] as List).cast<Map>();
    expect(features.length, 1);
    expect(features.single['properties']['name'], 'NCR');
    expect(features.single['properties']['level'], 3);
  });

  test('buildTyphoonTrack emits a LineString in lng,lat order', () {
    final typhoon = Typhoon.fromMap('t', {
      'typhoonName': 'Tino',
      'active': true,
      'track': [
        {'lat': 14.5, 'lng': 121.0},
        {'lat': 15.0, 'lng': 122.0},
      ],
    });
    final track = buildTyphoonTrack(typhoon);
    final coords = track['geometry']['coordinates'] as List;
    expect(coords.length, 2);
    expect(coords.first, [121.0, 14.5]);
  });

  test('circleRing returns a closed ring of lng,lat pairs', () {
    final ring = circleRing(14.6, 121.0, 100, steps: 16);
    expect(ring.length, 17);
    expect(ring.first[0], closeTo(ring.last[0], 0.0001));
    expect(ring.first[1], closeTo(ring.last[1], 0.0001));
  });
}
