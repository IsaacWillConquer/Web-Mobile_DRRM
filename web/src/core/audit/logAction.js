import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../../config/firebase";
import { COLLECTIONS } from "../../config/appConfig";

export async function logAction(uid, action, details = {}) {
  if (!uid) return;
  try {
    await addDoc(collection(db, COLLECTIONS.logs), {
      uid,
      action,
      details,
      createdAt: serverTimestamp(),
    });
  } catch {
    // audit logging must never block the user action
  }
}
