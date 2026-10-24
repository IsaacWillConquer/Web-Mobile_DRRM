import 'package:drrm_mobile/core/pagasa.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('classifyPagasa', () {
    test('boundaries follow the PAGASA scale', () {
      String code(num kph) => classifyPagasa(kph)!.code;
      expect(code(0), 'TD');
      expect(code(61), 'TD');
      expect(code(62), 'TS');
      expect(code(88), 'TS');
      expect(code(89), 'STS');
      expect(code(117), 'STS');
      expect(code(118), 'TY');
      expect(code(184), 'TY');
      expect(code(185), 'STY');
      expect(code(300), 'STY');
    });

    test('names', () {
      expect(classifyPagasa(85)!.name, 'Tropical Storm');
      expect(classifyPagasa(148)!.name, 'Typhoon');
    });

    test('unknown or invalid wind is null', () {
      expect(classifyPagasa(null), isNull);
      expect(classifyPagasa(-1), isNull);
      expect(classifyPagasa(double.nan), isNull);
    });
  });

  group('markerCode', () {
    test('uses the PAGASA code from wind', () {
      expect(markerCode(windKph: 148), 'TY');
      expect(markerCode(windKph: 93, jmaClass: 'STS'), 'STS');
    });

    test('JMA LOW is kept, whatever the wind says', () {
      expect(markerCode(windKph: 65, jmaClass: 'LOW'), 'LOW');
    });

    test('no wind and no LOW gives no code', () {
      expect(markerCode(), isNull);
      expect(markerCode(jmaClass: 'TY'), isNull);
    });
  });

  test('categoryColorHex gives a distinct colour per category', () {
    final colors = {
      for (final c in ['TD', 'TS', 'STS', 'TY', 'STY']) categoryColorHex(c),
    };
    expect(colors.length, 5);
    expect(categoryColorHex('LOW'), categoryColorHex(null));
    expect(categoryColorHex('TY'), startsWith('#'));
  });
}
