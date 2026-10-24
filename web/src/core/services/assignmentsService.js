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

// Cancel every still-open assignment for a report (e.g. when it is rejected or
// marked duplicate). Completed/declined/cancelled assignments are left alone.
export async function cancelAssignmentsForReport(reportId, uid) {
  const snap = await getDocs(query(assignmentsRef, where("reportId", "==", reportId)));
  const open = snap.docs.filter(
    (d) => !["completed", "declined", "cancelled"].includes(d.data().status),
  );
  await Promise.all(open.map((d) => updateAssignmentStatus(d.id, "cancelled", uid)));
  return open.length;
}
