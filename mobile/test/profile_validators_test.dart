import 'package:drrm_mobile/core/profile_validators.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('emailError', () {
    test('accepts a normal address', () {
      expect(emailError('juan@example.com'), isNull);
    });

    test('rejects empty and malformed addresses', () {
      expect(emailError(''), isNotNull);
      expect(emailError('juan'), isNotNull);
      expect(emailError('juan@example'), isNotNull);
      expect(emailError('juan @example.com'), isNotNull);
    });

    test('empty is fine when not required', () {
      expect(emailError('', required: false), isNull);
    });
  });

  group('dates', () {
    test('future and too-old birthdates are detected', () {
      final now = DateTime.now();
      expect(isFutureDate(now.add(const Duration(days: 2))), isTrue);
      expect(isFutureDate(DateTime(now.year, now.month, now.day)), isFalse);
      expect(isTooOldDate(DateTime(now.year - 121, 1, 1)), isTrue);
      expect(isTooOldDate(DateTime(now.year - 30, 1, 1)), isFalse);
    });

    test('age accounts for whether the birthday has passed', () {
      final today = DateTime(2026, 10, 23);
      expect(ageFromBirthdate(DateTime(2000, 10, 23), now: today), 26);
      expect(ageFromBirthdate(DateTime(2000, 10, 24), now: today), 25);
      expect(ageFromBirthdate(null, now: today), isNull);
    });

    test('display format matches the registration screen', () {
      expect(formatDisplayDate(DateTime(2000, 1, 5)), 'Jan 5, 2000');
    });
  });

  group('validateProfileEdit', () {
    String? run({
      String email = 'juan@example.com',
      DateTime? birthdate,
      List<String> disability = const ['None'],
      String city = 'Hagonoy',
      String barangay = 'San Pedro',
      String street = 'Rizal St',
    }) {
      return validateProfileEdit(
        email: email,
        birthdate: birthdate ?? DateTime(2000, 1, 1),
        disability: disability,
        city: city,
        barangay: barangay,
        street: street,
      );
    }

    test('valid input passes', () {
      expect(run(), isNull);
    });

    test('each required field is enforced', () {
      expect(run(email: 'nope'), isNotNull);
      expect(run(disability: const []), isNotNull);
      expect(run(city: '  '), isNotNull);
      expect(run(barangay: ''), isNotNull);
      expect(run(street: ''), isNotNull);
    });

    test('missing and future birthdates are rejected', () {
      expect(
        validateProfileEdit(
          email: 'juan@example.com',
          birthdate: null,
          disability: const ['None'],
          city: 'a',
          barangay: 'b',
          street: 'c',
        ),
        'Select your birthdate.',
      );
      expect(
        run(birthdate: DateTime.now().add(const Duration(days: 5))),
        'Birthdate cannot be in the future.',
      );
    });
  });
}
