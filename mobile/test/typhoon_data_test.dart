import 'package:drrm_mobile/core/typhoon_source.dart';
import 'package:drrm_mobile/models/typhoon.dart';
import 'package:flutter_test/flutter_test.dart';

Typhoon _t(Map<String, dynamic> extra, {String id = 't'}) => Typhoon.fromMap(id, {
      'typhoonName': 'Test',
      'category': 'Typhoon',
      'source': 'JMA',
      'postedAt': '2026-10-23T00:00:00Z',
      'active': true,
      ...extra,
    });

void main() {
  group('Typhoon.fromMap (new fields)', () {
    test('track keeps its order and counts the depression-stage points', () {
      final t = _t({
        'track': [
          {'lat': 10.0, 'lng': 160.0, 'pre': true},
          {'lat': 11.0, 'lng': 158.0, 'pre': true},
          {'lat': 12.0, 'lng': 157.0},
          {'lat': 13.0, 'lng': 156.0, 'windKph': 148},
        ],
      });
      expect(t.track.length, 4);
      expect(t.preTrackCount, 2);
      expect(t.track.last, [13.0, 156.0]);
    });

    test('forecast points carry wind, class, valid time and radius', () {
      final t = _t({
        'forecast': [
          {
            'lat': 24.3,
            'lng': 122.5,
            'hours': 12,
            'label': '12H',
            'windKph': 130,
            'jmaClass': 'TY',
            'validAt': '2026-10-23T15:00:00Z',
            'radiusKm': 55.6,
          },
        ],
      });
      final p = t.forecast.single;
      expect(p.windKph, 130);
      expect(p.jmaClass, 'TY');
      expect(p.validAt, DateTime.utc(2026, 10, 23, 15));
      expect(p.radiusKm, 55.6);
    });

    test('wind, gust, pressure, class and wind areas', () {
      final t = _t({
        'maxWindsKph': 148,
        'gustKph': 213,
        'pressureHpa': 955,
        'jmaClass': 'TY',
        'analysisAt': '2026-10-23T03:00:00Z',
        'galeArea': {'lat': 24.03, 'lng': 123.6, 'radiusKm': 740.8},
        'stormArea': {'lat': 23.38, 'lng': 123.41, 'radiusKm': 305.6},
      });
      expect(t.gustKph, 213);
      expect(t.pressureHpa, 955);
      expect(t.jmaClass, 'TY');
      expect(t.analysisAt, DateTime.utc(2026, 10, 23, 3));
      expect(t.galeArea!.radiusKm, 740.8);
      expect(t.stormArea!.lat, 23.38);
    });

    test('simulation, demo and override flags', () {
      expect(_t({}).isSimulation, isFalse);
      expect(_t({'simulation': true}).isSimulation, isTrue);
      expect(_t({'demo': true}).isSimulation, isTrue); // old seeder
      expect(_t({}).overridesLive, isFalse);
      expect(_t({'overrideLive': true}).overridesLive, isTrue);
    });

    test('an old bulletin without any new field still parses', () {
      final t = _t({
        'track': [
          [14.0, 126.0],
          [14.9, 123.6],
        ],
        'dangerRadiusKm': 250,
      });
      expect(t.preTrackCount, 0);
      expect(t.galeArea, isNull);
      expect(t.stormArea, isNull);
      expect(t.jmaClass, isNull);
      expect(t.dangerRadiusKm, 250);
    });

    test('WindArea.tryParse rejects incomplete maps', () {
      expect(WindArea.tryParse(null), isNull);
      expect(WindArea.tryParse({'lat': 1, 'lng': 2}), isNull);
      expect(WindArea.tryParse({'lat': 1, 'lng': 2, 'radiusKm': 3})!.radiusKm, 3);
    });
  });

  group('selectActiveTyphoon', () {
    test('nothing active gives null', () {
      expect(selectActiveTyphoon(const []), isNull);
      expect(selectActiveTyphoon([_t({'active': false})]), isNull);
    });

    test('the live storm wins over a simulation', () {
      final live = _t({'typhoonName': 'Live'}, id: 'active');
      final sim = _t({
        'typhoonName': 'Sim',
        'simulation': true,
        'postedAt': '2026-10-24T00:00:00Z', // newer, still loses
      }, id: 'simulation');
      expect(selectActiveTyphoon([sim, live])!.name, 'Live');
    });

    test('the simulation shows when there is no live storm', () {
      final sim = _t({'typhoonName': 'Sim', 'simulation': true}, id: 'simulation');
      final off = _t({'active': false}, id: 'active');
      expect(selectActiveTyphoon([off, sim])!.name, 'Sim');
    });

    test('overrideLive makes the simulation win over a live storm', () {
      final live = _t({'typhoonName': 'Live'}, id: 'active');
      final sim = _t({
        'typhoonName': 'Sim',
        'simulation': true,
        'overrideLive': true,
      }, id: 'simulation');
      expect(selectActiveTyphoon([live, sim])!.name, 'Sim');
    });

    test('a legacy demo doc in bulletins/active counts as a simulation', () {
      final legacy = _t({'typhoonName': 'Legacy', 'demo': true}, id: 'active');
      final live = _t({'typhoonName': 'Live'}, id: 'other');
      expect(selectActiveTyphoon([legacy, live])!.name, 'Live');
      expect(selectActiveTyphoon([legacy])!.name, 'Legacy');
    });

    test('among live storms the newest bulletin wins', () {
      final older = _t({'typhoonName': 'Older', 'postedAt': '2026-10-22T00:00:00Z'}, id: 'a');
      final newer = _t({'typhoonName': 'Newer', 'postedAt': '2026-10-23T00:00:00Z'}, id: 'b');
      expect(selectActiveTyphoon([older, newer])!.name, 'Newer');
    });
  });
}
