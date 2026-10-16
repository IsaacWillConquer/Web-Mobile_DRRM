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
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { COLLECTIONS, STAFF_ROLES } from "../../config/appConfig";

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

  await setDoc(userDoc(data.localId), {
    email,
    name: name || email,
    role,
    active: true,
    createdAt: serverTimestamp(),
  });
  return { uid: data.localId, email, name: name || email, role };
}

export function updateStaff(uid, data) {
  return updateDoc(userDoc(uid), { ...data, updatedAt: serverTimestamp() });
}

export function setStaffActive(uid, active) {
  return updateStaff(uid, { active });
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
