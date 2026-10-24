import 'package:drrm_mobile/core/overlays.dart';
import 'package:drrm_mobile/models/typhoon.dart';
import 'package:flutter_test/flutter_test.dart';

Typhoon _t(Map<String, dynamic> extra) => Typhoon.fromMap('t', {
      'typhoonName': 'Test',
      'category': 'Typhoon',
      'source': 'JMA',
      'postedAt': '2026-10-23T00:00:00Z',
      'active': true,
      ...extra,
    });

List<dynamic> _coords(Map<String, dynamic> lineFeature) =>
    (lineFeature['geometry'] as Map)['coordinates'] as List;

List<Map<String, dynamic>> _features(Map<String, dynamic> collection) =>
    [for (final f in collection['features'] as List) (f as Map).cast<String, dynamic>()];

Map<String, dynamic> _props(Map<String, dynamic> feature) =>
    (feature['properties'] as Map).cast<String, dynamic>();

void main() {
  group('phtClockLabel', () {
    test('formats Philippine time (UTC+8)', () {
      expect(phtClockLabel(DateTime.utc(2026, 10, 25, 0)), 'Sun 8AM');
      expect(phtClockLabel(DateTime.utc(2026, 10, 23, 15)), 'Fri 11PM');
      expect(phtClockLabel(DateTime.utc(2026, 10, 23, 4, 30)), 'Fri 12:30PM');
    });

    test('midnight is 12AM and rolls to the next day', () {
      expect(phtClockLabel(DateTime.utc(2026, 10, 23, 16)), 'Sat 12AM');
    });
  });

  group('forecast markers', () {
    const hours = [3, 6, 9, 12, 15, 18, 21, 24, 45, 69, 93];

    test('only 12H, 24H and the later day points get a marker', () {
      final picked = selectForecastMarkers([
        for (final h in hours) TyphoonPoint(lat: 1, lng: 1, hours: h),
      ]);
      expect(picked.map((p) => p.hours), [12, 24, 45, 69, 93]);
    });

    test('a point with no lead time is kept', () {
      final picked = selectForecastMarkers(const [TyphoonPoint(lat: 1, lng: 1)]);
      expect(picked.length, 1);
    });

    test('caption: label up to 24H, Philippine clock time after', () {
      expect(
        forecastMarkerTime(const TyphoonPoint(lat: 1, lng: 1, hours: 12, label: '12H')),
        '12H',
      );
      expect(
        forecastMarkerTime(const TyphoonPoint(lat: 1, lng: 1, hours: 24)),
        '24H',
      );
      expect(
        forecastMarkerTime(TyphoonPoint(
          lat: 1,
          lng: 1,
          hours: 45,
          label: '45H',
          validAt: DateTime.utc(2026, 10, 25),
        )),
        'Sun 8AM',
      );
      expect(
        forecastMarkerTime(const TyphoonPoint(lat: 1, lng: 1, hours: 45, label: '45H')),
        '45H',
      );
    });
  });

  group('buildTyphoonMarkers', () {
    final typhoon = _t({
      'maxWindsKph': 148,
      'jmaClass': 'TY',
      'track': [
        [14.0, 126.0],
        [14.9, 123.6],
      ],
      'forecast': [
        {'lat': 15.0, 'lng': 122.0, 'hours': 6, 'label': '6H', 'windKph': 140},
        {'lat': 15.2, 'lng': 121.0, 'hours': 12, 'label': '12H', 'windKph': 130, 'jmaClass': 'TY'},
        {
          'lat': 29.1,
          'lng': 124.2,
          'hours': 45,
          'label': '45H',
          'windKph': 93,
          'jmaClass': 'STS',
          'validAt': '2026-10-25T00:00:00Z',
        },
        {'lat': 34.5, 'lng': 139.7, 'hours': 93, 'label': '93H', 'windKph': 65, 'jmaClass': 'LOW'},
      ],
    });

    test('NOW first, then the selected points, in lng,lat order', () {
      final features = _features(buildTyphoonMarkers(typhoon));
      expect(features.length, 4); // NOW, 12H, 45H, 93H (6H is not selected)
      expect(_props(features[0])['time'], 'NOW');
      expect((features[0]['geometry'] as Map)['coordinates'], [123.6, 14.9]);
      expect(features.map((f) => _props(f)['time']), ['NOW', '12H', 'Sun 8AM', '93H']);
    });

    test('codes and colours follow wind, with LOW passed through', () {
      final props = _features(buildTyphoonMarkers(typhoon)).map(_props).toList();
      expect(props.map((p) => p['code']), ['TY', 'TY', 'STS', 'LOW']);
      expect(props[0]['color'], '#DC2626');
      expect(props[2]['color'], '#F97316');
      expect(props[3]['color'], '#6B7280');
    });

    test('no wind gives an empty code with the neutral colour', () {
      final features = _features(buildTyphoonMarkers(_t({
        'track': [
          [14.9, 123.6],
        ],
      })));
      expect(_props(features.single)['code'], '');
      expect(_props(features.single)['color'], '#6B7280');
    });
  });

  group('buildTyphoonPastTrack', () {
    final five = [
      for (var i = 0; i < 5; i++) {'lat': 10.0 + i, 'lng': 160.0 - i},
    ];

    test('splits at the depression stage and shares the hand-over point', () {
      final t = _t({
        'track': [
          for (var i = 0; i < 5; i++) {'lat': 10.0 + i, 'lng': 160.0 - i, if (i < 2) 'pre': true},
        ],
      });
      final past = buildTyphoonPastTrack(t);
      final pre = _coords(past.pre!);
      final main = _coords(past.main!);
      expect(pre.length, 2);
      expect(main.length, 4); // 5 points minus the 2 pre, plus the shared one
      expect(pre.last, main.first);
      expect(main.last, [156.0, 14.0]);
    });

    test('no depression stage gives a single main line', () {
      final past = buildTyphoonPastTrack(_t({'track': five}));
      expect(past.pre, isNull);
      expect(_coords(past.main!).length, 5);
    });

    test('too few points give null', () {
      final past = buildTyphoonPastTrack(_t({
        'track': [
          {'lat': 10.0, 'lng': 160.0},
        ],
      }));
      expect(past.pre, isNull);
      expect(past.main, isNull);
    });
  });

  group('buildTyphoonForecastLine', () {
    test('starts at the current position and runs through every forecast point', () {
      final line = buildTyphoonForecastLine(_t({
        'track': [
          [14.0, 126.0],
          [14.9, 123.6],
        ],
        'forecast': [
          {'lat': 15.0, 'lng': 122.0, 'hours': 6},
          {'lat': 15.2, 'lng': 121.0, 'hours': 12},
        ],
      }))!;
      expect(_coords(line), [
        [123.6, 14.9],
        [122.0, 15.0],
        [121.0, 15.2],
      ]);
    });

    test('null without a track or without forecast points', () {
      expect(buildTyphoonForecastLine(_t({})), isNull);
      expect(
        buildTyphoonForecastLine(_t({
          'track': [
            [14.9, 123.6],
          ],
        })),
        isNull,
      );
    });
  });

  group('stormRing', () {
    test('uses the storm-force area when there is one', () {
      final ring = stormRing(_t({
        'stormArea': {'lat': 23.38, 'lng': 123.41, 'radiusKm': 305.6},
      }))!;
      expect(ring.radiusKm, 305.6);
      expect(ring.lat, 23.38);
    });

    test('old bulletins fall back to dangerRadiusKm around the storm', () {
      final ring = stormRing(_t({
        'dangerRadiusKm': 250,
        'track': [
          [14.9, 123.6],
        ],
      }))!;
      expect(ring.radiusKm, 250);
      expect(ring.lat, 14.9);
      expect(ring.lng, 123.6);
    });

    test('a gale-only storm has no storm-force ring', () {
      expect(
        stormRing(_t({
          'dangerRadiusKm': 220,
          'galeArea': {'lat': 14.9, 'lng': 123.6, 'radiusKm': 220},
          'track': [
            [14.9, 123.6],
          ],
        })),
        isNull,
      );
    });
  });

  test('buildWindAreaPolygon is a closed ring around the area', () {
    final collection = buildWindAreaPolygon(
      const WindArea(lat: 15, lng: 122, radiusKm: 100),
    );
    final ring = (((_features(collection).single['geometry'] as Map)['coordinates'] as List).first)
        as List;
    expect(ring.first, ring.last);
    expect(ring.length, greaterThan(32));
  });
}
