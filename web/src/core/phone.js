// Philippine mobile number helpers, mirroring mobile/lib/core/phone.dart so the
// admin portal can create resident logins that the mobile app accepts.
export const PHONE_COUNTRY_CODE = "+63";
export const PHONE_DIGITS = 10;

// Returns the E.164 number ("+639XXXXXXXXX") for a Philippine mobile number,
// or null if the input is not a valid 10-digit mobile number starting with 9.
export function normalizePhone(raw) {
  let digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.startsWith("63")) {
    digits = digits.slice(2);
  } else if (digits.startsWith("0")) {
    digits = digits.slice(1);
  }
  if (digits.length !== PHONE_DIGITS || !digits.startsWith("9")) return null;
  return `${PHONE_COUNTRY_CODE}${digits}`;
}

// Internal Firebase Auth identifier for a phone number. Never shown to users;
// the user's real email lives in `users/{uid}.email`.
export function phoneToAuthEmail(e164) {
  const digits = String(e164 ?? "").replace(/\D/g, "");
  return `${digits}@drrm.local`;
}
