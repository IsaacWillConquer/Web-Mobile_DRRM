import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../../config/firebase";
import { COLLECTIONS, ROLES } from "../../config/appConfig";

export async function registerUser({ email, password, name, phone }) {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(credential.user, { displayName: name });
  await setDoc(doc(db, COLLECTIONS.users, credential.user.uid), {
    email,
    name,
    phone: phone ?? "",
    role: ROLES.resident,
    active: true,
    createdAt: serverTimestamp(),
  });
  return credential.user;
}

export function loginUser({ email, password }) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function logoutUser() {
  return signOut(auth);
}

export function observeAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function getUserProfile(uid) {
  const snapshot = await getDoc(doc(db, COLLECTIONS.users, uid));
  if (!snapshot.exists()) return null;
  const data = snapshot.data();
  if (typeof data.role === "string") data.role = data.role.trim();
  return data;
}
