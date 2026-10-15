import 'package:drrm_mobile/core/phone.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('normalizePhone', () {
    test('accepts trunk-zero format', () {
      expect(normalizePhone('09171234567'), '+639171234567');
    });

    test('accepts bare 10-digit format', () {
      expect(normalizePhone('9171234567'), '+639171234567');
    });

    test('accepts 63-prefixed format', () {
      expect(normalizePhone('639171234567'), '+639171234567');
    });

    test('accepts E.164 with spaces and dashes', () {
      expect(normalizePhone('+63 917-123-4567'), '+639171234567');
    });

    test('rejects wrong length', () {
      expect(normalizePhone('91712345'), isNull);
      expect(normalizePhone('917123456789'), isNull);
    });

    test('rejects numbers not starting with 9', () {
      expect(normalizePhone('8171234567'), isNull);
      expect(normalizePhone('0212345678'), isNull);
    });

    test('rejects empty and junk', () {
      expect(normalizePhone(''), isNull);
      expect(normalizePhone('hello'), isNull);
    });
  });

  group('phoneToAuthEmail', () {
    test('produces a stable synthetic email', () {
      expect(phoneToAuthEmail('+639171234567'), '639171234567@drrm.local');
    });
  });
}
