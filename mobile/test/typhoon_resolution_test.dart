import 'dart:io';

import 'package:drrm_mobile/core/province_lookup.dart';
import 'package:drrm_mobile/core/signal_resolver.dart';
import 'package:drrm_mobile/models/typhoon.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  late ProvinceLookup lookup;

  setUpAll(() async {
    final raw = await File('assets/geo/ph_provinces.geojson').readAsString();
    lookup = ProvinceLookup.fromGeoJson(raw);
  });

  group('province lookup', () {
    test('Manila resolves to Metro Manila', () {
      expect(lookup.provinceAt(14.5995, 120.9842), 'Metro Manila');
    });

    test('Cebu City resolves to Cebu', () {
      expect(lookup.provinceAt(10.3157, 123.8854), 'Cebu');
    });

    test('Malolos resolves to Bulacan', () {
      expect(lookup.provinceAt(14.8527, 120.8160), 'Bulacan');
    });

    test('open sea resolves to null', () {
      expect(lookup.provinceAt(15.0, 130.0), isNull);
    });
  });

  group('area aliases', () {
    test('NCR matches Metro Manila', () {
      expect(canonicalArea('NCR'), canonicalArea('Metro Manila'));
      expect(canonicalArea('National Capital Region'), 'metro manila');
    });

    test('Maguindanao split matches Maguindanao', () {
      expect(canonicalArea('Maguindanao del Sur'), canonicalArea('Maguindanao'));
      expect(canonicalArea('Maguindanao del Norte'), canonicalArea('Maguindanao'));
    });

    test('Davao de Oro matches Compostela Valley', () {
      expect(canonicalArea('Davao de Oro'), canonicalArea('Compostela Valley'));
    });
  });

  group('signal resolution', () {
    final typhoon = Typhoon.fromMap('b1', {
      'typhoonName': 'Kiko',
      'category': 'Typhoon',
      'source': 'PAGASA',
      'postedAt': '2026-10-15T05:00:00+08:00',
      'active': true,
      'signals': [
        {
          'level': 1,
          'areas': ['Bulacan', 'Metro Manila'],
        },
        {
          'level': 3,
          'areas': ['NCR'],
        },
      ],
    });

    test('highest matching level wins (Bulacan -> 1)', () {
      final signal =
          StormSignalResolver(lookup).resolve(typhoon, 14.8527, 120.8160);
      expect(signal?.level, 1);
    });

    test('alias lets NCR area match Metro Manila coords (-> 3)', () {
      final signal =
          StormSignalResolver(lookup).resolve(typhoon, 14.5995, 120.9842);
      expect(signal?.level, 3);
    });

    test('province with no signal returns null', () {
      final signal =
          StormSignalResolver(lookup).resolve(typhoon, 10.3157, 123.8854);
      expect(signal, isNull);
    });
  });
}
