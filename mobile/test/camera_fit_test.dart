import 'package:drrm_mobile/core/camera_fit.dart';
import 'package:drrm_mobile/models/typhoon.dart';
import 'package:flutter_test/flutter_test.dart';

Typhoon _typhoon({
  List<List<double>> track = const [],
  List<TyphoonPoint> forecast = const [],
  Map<String, dynamic>? cone,
  double? dangerRadiusKm,
  WindArea? galeArea,
  WindArea? stormArea,
}) {
  return Typhoon(
    id: 't',
    name: 'Test',
    category: 'Tropical Storm',
    source: 'TEST',
    postedAt: DateTime(2026, 10, 22),
    active: true,
    signals: const [],
    track: track,
    forecast: forecast,
    cone: cone,
    dangerRadiusKm: dangerRadiusKm,
    galeArea: galeArea,
    stormArea: stormArea,
  );
}

void main() {
  group('GeoBounds', () {
    test('fromLatLngs returns null for no points', () {
      expect(GeoBounds.fromLatLngs(const []), isNull);
    });

    test('fromLatLngs finds the extremes', () {
      final b = GeoBounds.fromLatLngs(const [
        [14.0, 120.0],
        [16.5, 122.5],
        [15.0, 119.0],
      ])!;
      expect(b.south, 14.0);
      expect(b.north, 16.5);
      expect(b.west, 119.0);
      expect(b.east, 122.5);
    });

    test('withMinSpan grows a tiny box around its centre', () {
      const tiny = GeoBounds(south: 14.9, west: 120.9, north: 15.1, east: 121.1);
      final grown = tiny.withMinSpan(3.0);
      expect(grown.latSpan, closeTo(3.0, 1e-9));
      expect(grown.lngSpan, closeTo(3.0, 1e-9));
      expect(grown.centerLat, closeTo(15.0, 1e-9));
      expect(grown.centerLng, closeTo(121.0, 1e-9));
    });

    test('withMinSpan leaves a large box unchanged', () {
      const big = GeoBounds(south: 10, west: 118, north: 18, east: 126);
      final same = big.withMinSpan(3.0);
      expect(same.south, 10);
      expect(same.north, 18);
      expect(same.west, 118);
      expect(same.east, 126);
    });
  });

  group('boundsForGeoJson', () {
    test('converts GeoJSON [lng, lat] into a lat/lng box', () {
      final b = boundsForGeoJson({
        'type': 'FeatureCollection',
        'features': [
          {
            'type': 'Feature',
            'properties': {'name': 'A'},
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
      })!;
      expect(b.south, 14.0);
      expect(b.north, 15.0);
      expect(b.west, 120.0);
      expect(b.east, 121.0);
    });

    test('handles MultiPolygon across several features', () {
      final b = boundsForGeoJson({
        'type': 'FeatureCollection',
        'features': [
          {
            'type': 'Feature',
            'geometry': {
              'type': 'MultiPolygon',
              'coordinates': [
                [
                  [
                    [120.0, 14.0],
                    [120.5, 14.0],
                    [120.5, 14.5],
                    [120.0, 14.0],
                  ],
                ],
                [
                  [
                    [124.0, 10.0],
                    [124.5, 10.0],
                    [124.5, 10.5],
                    [124.0, 10.0],
                  ],
                ],
              ],
            },
          },
        ],
      })!;
      expect(b.south, 10.0);
      expect(b.north, 14.5);
      expect(b.west, 120.0);
      expect(b.east, 124.5);
    });

    test('returns null for an empty collection or null', () {
      expect(
        boundsForGeoJson({'type': 'FeatureCollection', 'features': []}),
        isNull,
      );
      expect(boundsForGeoJson(null), isNull);
    });
  });

  group('boundsForTyphoon', () {
    test('covers track and forecast points', () {
      final b = boundsForTyphoon(_typhoon(
        track: const [
          [14.0, 126.0],
          [14.9, 123.6],
        ],
        forecast: const [
          TyphoonPoint(lat: 15.4, lng: 120.4, hours: 24),
        ],
      ))!;
      expect(b.south, 14.0);
      expect(b.north, 15.4);
      expect(b.west, 120.4);
      expect(b.east, 126.0);
    });

    test('includes the cone polygon', () {
      final b = boundsForTyphoon(_typhoon(
        track: const [
          [15.0, 122.0],
        ],
        cone: {
          'type': 'Polygon',
          'coordinates': [
            [
              [118.0, 17.0],
              [119.0, 13.0],
              [122.0, 15.0],
              [118.0, 17.0],
            ],
          ],
        },
      ))!;
      expect(b.north, 17.0);
      expect(b.south, 13.0);
      expect(b.west, 118.0);
    });

    test('includes the danger circle around the latest position', () {
      // ~111.19 km is about 1 degree of latitude.
      final b = boundsForTyphoon(_typhoon(
        track: const [
          [15.0, 122.0],
        ],
        dangerRadiusKm: 111.19,
      ))!;
      expect(b.north, closeTo(16.0, 0.02));
      expect(b.south, closeTo(14.0, 0.02));
    });

    test('returns null when there is nothing to frame', () {
      expect(boundsForTyphoon(_typhoon()), isNull);
    });

    test('only the most recent track points are framed', () {
      final b = boundsForTyphoon(_typhoon(
        track: [
          for (var i = 0; i < 20; i++) [10.0, 100.0 + i], // lng 100..119
        ],
        forecast: const [TyphoonPoint(lat: 11, lng: 121, hours: 12)],
      ))!;
      expect(b.west, 110.0); // last 10 points: 110..119
      expect(b.east, 121.0);
    });

    test('frames the storm-force ring but not the huge gale ring', () {
      final b = boundsForTyphoon(_typhoon(
        track: const [
          [15.0, 122.0],
        ],
        galeArea: const WindArea(lat: 15, lng: 122, radiusKm: 700),
        stormArea: const WindArea(lat: 15, lng: 122, radiusKm: 111.19),
      ))!;
      expect(b.north, closeTo(16.0, 0.02));
      expect(b.south, closeTo(14.0, 0.02));
    });
  });

  group('isInPhilippines', () {
    test('Manila yes, San Francisco no', () {
      expect(isInPhilippines(14.6, 121.0), isTrue);
      expect(isInPhilippines(37.77, -122.42), isFalse);
    });
  });
}
