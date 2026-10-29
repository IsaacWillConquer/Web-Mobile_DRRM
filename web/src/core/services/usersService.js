import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { COLLECTIONS, ROLES, STAFF_ROLES } from "../../config/appConfig";
import { normalizePhone, phoneToAuthEmail } from "../phone";

const usersRef = collection(db, COLLECTIONS.users);
const userDoc = (uid) => doc(db, COLLECTIONS.users, uid);
const API_KEY = import.meta.env.VITE_FIREBASE_API_KEY;

export function displayName(user) {
  if (!user) return "—";
  if (user.name) return user.name;
  const full = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return full || user.email || "—";
}

const byName = (a, b) => displayName(a).localeCompare(displayName(b));

// Live list of staff accounts. Admin-only by Firestore rules.
export function watchStaff(onData, onError) {
  const staffQuery = query(usersRef, where("role", "in", STAFF_ROLES));
  return onSnapshot(
    staffQuery,
    (snap) => onData(snap.docs.map((d) => ({ uid: d.id, ...d.data() })).sort(byName)),
    onError,
  );
}

// Live list of every user (staff read is allowed by rules); used for analytics.
export function watchAllUsers(onData, onError) {
  return onSnapshot(
    usersRef,
    (snap) => onData(snap.docs.map((d) => ({ uid: d.id, ...d.data() }))),
    onError,
  );
}

// Live list of resident (mobile-only) accounts. Admin-only by Firestore rules.
export function watchResidents(onData, onError) {
  const residentQuery = query(usersRef, where("role", "==", ROLES.resident));
  return onSnapshot(
    residentQuery,
    (snap) => onData(snap.docs.map((d) => ({ uid: d.id, ...d.data() })).sort(byName)),
    onError,
  );
}

// Creates the Firebase Auth user through the Identity Toolkit REST endpoint
// (so the current admin stays signed in) and writes the profile as the admin.
export async function createStaff({ email, password, name, role }) {
  if (!STAFF_ROLES.includes(role)) {
    throw new Error("Pick a valid role for the new account.");
  }
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, displayName: name, returnSecureToken: false }),
    },
  );
  const data = await response.json();
  if (!response.ok) {
    const code = data?.error?.message ?? "unknown-error";
    if (code.includes("EMAIL_EXISTS")) throw new Error("That email is already registered.");
    if (code.includes("WEAK_PASSWORD")) {
      throw new Error("Password is too weak (use at least 6 characters).");
    }
    if (code.includes("INVALID_EMAIL")) throw new Error("Please enter a valid email.");
    throw new Error("Could not create the account. Please try again.");
  }

  const displayLabel = name || email;

  // Rescue team accounts also need a teams/{id} doc, otherwise they never show
  // up in the Dispatch team selector. Write both together so they can't drift.
  if (role === ROLES.rescueTeam) {
    const teamRef = doc(collection(db, COLLECTIONS.teams));
    const batch = writeBatch(db);
    batch.set(teamRef, {
      name: displayLabel,
      contact: "",
      status: "available",
      memberUids: [data.localId],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(userDoc(data.localId), {
      email,
      name: displayLabel,
      role,
      active: true,
      teamId: teamRef.id,
      createdAt: serverTimestamp(),
    });
    await batch.commit();
    return { uid: data.localId, email, name: displayLabel, role, teamId: teamRef.id };
  }

  await setDoc(userDoc(data.localId), {
    email,
    name: displayLabel,
    role,
    active: true,
    createdAt: serverTimestamp(),
  });
  return { uid: data.localId, email, name: displayLabel, role };
}

function fullName({ firstName, middleName, lastName, suffix }) {
  return [firstName, middleName, lastName, suffix]
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .join(" ");
}

// Creates a resident (mobile-only) login. Residents sign in with their mobile
// number + password, so the Firebase Auth account uses the internal
// `<digits>@drrm.local` identifier; the real email (optional) is contact info only.
export async function createResident({
  phone,
  password,
  firstName,
  middleName,
  lastName,
  suffix,
  email,
  city,
  barangay,
  street,
}) {
  const e164 = normalizePhone(phone);
  if (!e164) {
    throw new Error("Enter a valid 10-digit mobile number (9XXXXXXXXX).");
  }
  if (!password || password.length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }
  const name = fullName({ firstName, middleName, lastName, suffix }) || e164;

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: phoneToAuthEmail(e164),
        password,
        displayName: name,
        returnSecureToken: false,
      }),
    },
  );
  const data = await response.json();
  if (!response.ok) {
    const code = data?.error?.message ?? "unknown-error";
    if (code.includes("EMAIL_EXISTS")) throw new Error("That mobile number is already registered.");
    if (code.includes("WEAK_PASSWORD")) {
      throw new Error("Password is too weak (use at least 6 characters).");
    }
    throw new Error("Could not create the account. Please try again.");
  }

  await setDoc(userDoc(data.localId), {
    firstName: (firstName ?? "").trim(),
    middleName: (middleName ?? "").trim(),
    lastName: (lastName ?? "").trim(),
    suffix: (suffix ?? "").trim(),
    name,
    phone: e164,
    email: (email ?? "").trim(),
    role: ROLES.resident,
    active: true,
    profile: {
      address: {
        city: (city ?? "").trim(),
        barangay: (barangay ?? "").trim(),
        street: (street ?? "").trim(),
        line: "",
      },
      household: {},
    },
    createdAt: serverTimestamp(),
  });
  return { uid: data.localId, phone: e164, name };
}

// Edits a resident's profile. `phone` is intentionally excluded — it is the
// login identity and cannot change without an Admin SDK.
export function updateResident(uid, data) {
  return updateStaff(uid, data);
}

export function setResidentActive(uid, active) {
  return updateStaff(uid, { active });
}

// Removes the Firestore profile (same caveat as staff: the Auth account remains).
export function deleteResident(uid) {
  return deleteStaff(uid);
}

export function updateStaff(uid, data) {
  return updateDoc(userDoc(uid), { ...data, updatedAt: serverTimestamp() });
}

export function setStaffActive(uid, active) {
  return updateStaff(uid, { active });
}

// Assigns (or clears) a rescue team member's team. Drives PII access: a rescue
// team can only read `reportContacts` for reports assigned to its `teamId`.
export function setUserTeam(uid, teamId) {
  return updateStaff(uid, { teamId: teamId ?? null });
}

// Removes the Firestore profile. The Firebase Auth account itself remains;
// delete it from the console if needed.
export function deleteStaff(uid) {
  return deleteDoc(userDoc(uid));
}

// Maintains the shared dispatcher list that residents use to raise
// fixed-shape "new_report" pings (see Firestore rules).
export async function syncDispatcherConfig(uids) {
  await setDoc(doc(db, "config", "dispatch"), {
    dispatcherUids: uids,
    updatedAt: serverTimestamp(),
  });
}
