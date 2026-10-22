import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { COLLECTIONS } from "../../config/appConfig";

const assignmentsRef = collection(db, COLLECTIONS.assignments);
const assignmentDoc = (id) => doc(db, COLLECTIONS.assignments, id);

export function createAssignment(data) {
  return addDoc(assignmentsRef, {
    status: "dispatched",
    createdAt: serverTimestamp(),
    ...data,
  });
}

export function watchAssignments({ teamId, status } = {}, onData, onError) {
  const filters = [];
  if (teamId) filters.push(where("teamId", "==", teamId));
  if (status) filters.push(where("status", "==", status));
  return onSnapshot(
    query(assignmentsRef, ...filters, orderBy("createdAt", "desc")),
    onData,
    onError,
  );
}

export function updateAssignmentStatus(id, status, uid) {
  return updateDoc(assignmentDoc(id), {
    status,
    updatedBy: uid,
    updatedAt: serverTimestamp(),
  });
}
