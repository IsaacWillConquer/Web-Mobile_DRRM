import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../../config/firebase";
import { COLLECTIONS } from "../../config/appConfig";

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
