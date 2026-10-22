import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { COLLECTIONS } from "../../config/appConfig";

const rescueRecordsRef = collection(db, COLLECTIONS.rescueRecords);

export function createRescueRecord(data) {
  return addDoc(rescueRecordsRef, {
    createdAt: serverTimestamp(),
    ...data,
  });
}

export function watchRescueRecords({ assignmentId } = {}, onData, onError) {
  const filters = assignmentId ? [where("assignmentId", "==", assignmentId)] : [];
  return onSnapshot(
    query(rescueRecordsRef, ...filters, orderBy("createdAt", "desc")),
    onData,
    onError,
  );
}
