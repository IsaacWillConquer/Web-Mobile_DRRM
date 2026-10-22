import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
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

// Appends a status change to `history[]`, skipping the append when the report
// is already in that status (guards against repeated verify/assign clicks
// producing duplicate timeline entries). Uses a transaction so concurrent
// writers don't clobber each other's history.
export function updateReportStatus(id, status, uid) {
  const ref = reportDoc(id);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.data() ?? {};
    const history = Array.isArray(current.history) ? current.history : [];
    const last = history[history.length - 1];
    const nextHistory =
      last?.status === status ? history : [...history, { status, by: uid, at: Date.now() }];
    tx.update(ref, { status, updatedAt: serverTimestamp(), history: nextHistory });
    return { changed: last?.status !== status };
  });
}

export function updateReport(id, data) {
  return updateDoc(reportDoc(id), { ...data, updatedAt: serverTimestamp() });
}
