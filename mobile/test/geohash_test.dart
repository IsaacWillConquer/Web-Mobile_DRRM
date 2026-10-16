import 'package:flutter_test/flutter_test.dart';

import 'package:drrm_mobile/core/report_service.dart';

const String _base32 = '0123456789bcdefghjkmnpqrstuvwxyz';

/// Minimal decoder (independent path) to verify encoded cells contain the point.
List<double> decodeGeohash(String hash) {
  var latMin = -90.0, latMax = 90.0;
  var lngMin = -180.0, lngMax = 180.0;
  var isEven = true;
  for (final ch in hash.split('')) {
    final idx = _base32.indexOf(ch);
    expect(idx, greaterThanOrEqualTo(0), reason: 'invalid base32 char $ch');
    for (var bit = 4; bit >= 0; bit--) {
      final on = (idx >> bit) & 1 == 1;
      if (isEven) {
        final mid = (lngMin + lngMax) / 2;
        on ? lngMin = mid : lngMax = mid;
      } else {
        final mid = (latMin + latMax) / 2;
        on ? latMin = mid : latMax = mid;
      }
      isEven = !isEven;
    }
  }
  return [(latMin + latMax) / 2, (lngMin + lngMax) / 2];
}

void main() {
  test('encodes standard geohash vectors', () {
    // Authoritative reference values (Wikipedia example, geohash.org).
    expect(encodeGeohash(57.64911, 10.40744, precision: 10), 'u4pruydqqv');
    expect(encodeGeohash(37.7749, -122.4194, precision: 5), '9q8yy');
  });

  test('encoded cell contains the point (roundtrip)', () {
    const points = [
      [57.64911, 10.40744],
      [48.858260, 2.294499], // Eiffel Tower
      [14.5995, 120.9842], // Manila
      [0.0, 0.0],
      [-33.8688, 151.2093], // Sydney
    ];
    for (final p in points) {
      for (final precision in [1, 5, 8]) {
        final center = decodeGeohash(
            encodeGeohash(p[0].toDouble(), p[1].toDouble(), precision: precision));
        expect((center[0] - p[0]).abs(), lessThanOrEqualTo(90.0 / (1 << precision * 2) + 1e-9));
        expect((center[1] - p[1]).abs(), lessThanOrEqualTo(180.0 / (1 << precision * 2) + 1e-9));
      }
    }
  });

  test('nearby points share a prefix, far points do not', () {
    final a = encodeGeohash(14.5995, 120.9842);
    final b = encodeGeohash(14.5996, 120.9843);
    final far = encodeGeohash(8.4542, 124.6319); // Cagayan de Oro
    expect(a.substring(0, 6), b.substring(0, 6));
    expect(a.substring(0, 3), isNot(far.substring(0, 3)));
  });
}
