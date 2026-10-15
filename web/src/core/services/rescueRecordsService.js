import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { COLLECTIONS } from "../../config/appConfig";

const rescueRecordsRef = collection(db, COLLECTIONS.rescueRecords);
const rescueRecordDoc = (id) => doc(db, COLLECTIONS.rescueRecords, id);

export function createRescueRecord(data) {
  return addDoc(rescueRecordsRef, {
    createdAt: serverTimestamp(),
    ...data,
  });
}

export async function fetchRescueRecords({ assignmentId } = {}) {
  const filters = assignmentId ? [where("assignmentId", "==", assignmentId)] : [];
  const snap = await getDocs(
    query(rescueRecordsRef, ...filters, orderBy("createdAt", "desc")),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function watchRescueRecords({ assignmentId } = {}, onData, onError) {
  const filters = assignmentId ? [where("assignmentId", "==", assignmentId)] : [];
  return onSnapshot(
    query(rescueRecordsRef, ...filters, orderBy("createdAt", "desc")),
    onData,
    onError,
  );
}

export function updateRescueRecord(id, data) {
  return updateDoc(rescueRecordDoc(id), { ...data, updatedAt: serverTimestamp() });
}
