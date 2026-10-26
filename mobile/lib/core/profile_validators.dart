/// Input rules for the profile edit screen.
///
/// Ported from the Barangay Health app's `validators.dart` (same email pattern,
/// same future / too-old birthday checks, same age calculation), adapted to the
/// fields this app already stores for a resident.
library;

final RegExp _emailPattern = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');

/// Returns an error message, or null when [value] is a valid email address.
String? emailError(String? value, {bool required = true}) {
  final text = value?.trim() ?? '';
  if (text.isEmpty) return required ? 'Enter your email address.' : null;
  if (!_emailPattern.hasMatch(text)) return 'Email address is not valid.';
  return null;
}

/// True when [date] (calendar day only) is after today.
bool isFutureDate(DateTime date) {
  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  return DateTime(date.year, date.month, date.day).isAfter(today);
}

/// True when [date] is further back than [maxYears] years.
bool isTooOldDate(DateTime date, {int maxYears = 120}) {
  return date.year < DateTime.now().year - maxYears;
}

/// Age in whole years, accounting for whether the birthday has passed.
/// Returns null when [birthdate] is missing or in the future.
int? ageFromBirthdate(DateTime? birthdate, {DateTime? now}) {
  if (birthdate == null) return null;
  final today = now ?? DateTime.now();
  var age = today.year - birthdate.year;
  final hadBirthday = today.month > birthdate.month ||
      (today.month == birthdate.month && today.day >= birthdate.day);
  if (!hadBirthday) age -= 1;
  return age < 0 ? null : age;
}

/// "Jan 5, 2000" — the same display format the registration screen uses.
String formatDisplayDate(DateTime date) {
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return '${months[date.month - 1]} ${date.day}, ${date.year}';
}

/// Validates the editable profile fields, in the order they appear on screen.
/// Returns the first problem found, or null when everything is acceptable.
String? validateProfileEdit({
  required String email,
  required DateTime? birthdate,
  required Iterable<String> disability,
  required String city,
  required String barangay,
  required String street,
}) {
  final emailProblem = emailError(email);
  if (emailProblem != null) return emailProblem;

  if (birthdate == null) return 'Select your birthdate.';
  if (isFutureDate(birthdate)) return 'Birthdate cannot be in the future.';
  if (isTooOldDate(birthdate)) {
    return 'Birthdate is too far in the past — please check the year.';
  }

  if (disability.isEmpty) return 'Select at least one disability option.';

  if (city.trim().isEmpty) return 'Enter your city / municipality.';
  if (barangay.trim().isEmpty) return 'Enter your barangay.';
  if (street.trim().isEmpty) return 'Enter your street.';
  return null;
}
