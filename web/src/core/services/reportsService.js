import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { COLLECTIONS, REPORT_STATUSES } from "../../config/appConfig";

const reportsRef = collection(db, COLLECTIONS.reports);
const reportDoc = (id) => doc(db, COLLECTIONS.reports, id);

export function createReport(data) {
  return addDoc(reportsRef, {
    status: REPORT_STATUSES[0],
    priority: "medium",
    imageUrls: [],
    history: [],
    createdAt: serverTimestamp(),
    ...data,
  });
}

export async function fetchReports({ status, reporterId } = {}) {
  const filters = [];
  if (status) filters.push(where("status", "==", status));
  if (reporterId) filters.push(where("reporterId", "==", reporterId));
  const snap = await getDocs(query(reportsRef, ...filters, orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function watchReports({ status, reporterId } = {}, onData, onError) {
  const filters = [];
  if (status) filters.push(where("status", "==", status));
  if (reporterId) filters.push(where("reporterId", "==", reporterId));
  return onSnapshot(
    query(reportsRef, ...filters, orderBy("createdAt", "desc")),
    onData,
    onError,
  );
}

export async function getReport(id) {
  const snap = await getDoc(reportDoc(id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export function watchReport(id, onData, onError) {
  return onSnapshot(reportDoc(id), onData, onError);
}

export function updateReportStatus(id, status, uid) {
  return updateDoc(reportDoc(id), {
    status,
    updatedAt: serverTimestamp(),
    history: arrayUnion({ status, by: uid, at: Date.now() }),
  });
}

export function updateReport(id, data) {
  return updateDoc(reportDoc(id), { ...data, updatedAt: serverTimestamp() });
}
