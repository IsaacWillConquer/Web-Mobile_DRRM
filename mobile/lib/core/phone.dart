const String kCountryCode = '+63';

const int kPhoneDigits = 10;

/// Returns the E.164 number ("+639XXXXXXXXX") for a Philippine mobile number,
/// or null if the input is not a valid 10-digit mobile number starting with 9.
///
/// Accepts input with or without a leading country code or trunk zero, e.g.
/// "09171234567", "9171234567", "639171234567", "+63 917 123 4567".
String? normalizePhone(String raw) {
  var digits = raw.replaceAll(RegExp(r'\D'), '');
  if (digits.startsWith('63')) {
    digits = digits.substring(2);
  } else if (digits.startsWith('0')) {
    digits = digits.substring(1);
  }
  if (digits.length != kPhoneDigits || !digits.startsWith('9')) return null;
  return '$kCountryCode$digits';
}

/// Internal Firebase Auth identifier for a phone number. Never shown to users;
/// the user's real email lives in `users/{uid}.email`.
String phoneToAuthEmail(String e164) {
  final digits = e164.replaceAll(RegExp(r'\D'), '');
  return '$digits@drrm.local';
}
