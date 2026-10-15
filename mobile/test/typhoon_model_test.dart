import 'package:drrm_mobile/models/typhoon.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('Typhoon.fromMap parses a plain map with an ISO postedAt', () {
    final map = <String, dynamic>{
      'typhoonName': 'Kiko',
      'category': 'Typhoon',
      'source': 'PAGASA',
      'sourceUrl': 'https://example.test/bulletin',
      'postedAt': '2026-10-15T05:00:00+08:00',
      'active': true,
      'signals': [
        {
          'level': 1,
          'areas': ['Metro Manila', 'Bulacan'],
        },
        {
          'level': 3,
          'areas': ['Isabela'],
        },
      ],
    };

    final typhoon = Typhoon.fromMap('doc-1', map);

    expect(typhoon.id, 'doc-1');
    expect(typhoon.name, 'Kiko');
    expect(typhoon.category, 'Typhoon');
    expect(typhoon.source, 'PAGASA');
    expect(typhoon.sourceUrl, 'https://example.test/bulletin');
    expect(typhoon.active, isTrue);
    expect(typhoon.postedAt.year, 2026);
    expect(typhoon.hasSignals, isTrue);
    expect(typhoon.signals, hasLength(2));
    expect(typhoon.signals.first.level, 1);
    expect(typhoon.signals.first.areas, contains('Bulacan'));
    expect(typhoon.signals.last.level, 3);
  });

  test('Typhoon.fromMap tolerates missing optional fields', () {
    final typhoon = Typhoon.fromMap('doc-2', {
      'typhoonName': 'Bagyo',
      'active': false,
    });

    expect(typhoon.name, 'Bagyo');
    expect(typhoon.category, '');
    expect(typhoon.sourceUrl, isNull);
    expect(typhoon.hasSignals, isFalse);
    expect(typhoon.signals, isEmpty);
  });
}
