import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { COLLECTIONS } from "../../config/appConfig";

const clustersRef = collection(db, COLLECTIONS.clusters);
const clusterDoc = (id) => doc(db, COLLECTIONS.clusters, id);

export function createCluster(data) {
  return addDoc(clustersRef, {
    reportIds: [],
    reportCount: 0,
    peopleAffected: 0,
    priority: "medium",
    status: "open",
    createdAt: serverTimestamp(),
    ...data,
  });
}

export async function fetchClusters() {
  const snap = await getDocs(query(clustersRef, orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function watchClusters(onData, onError) {
  return onSnapshot(query(clustersRef, orderBy("createdAt", "desc")), onData, onError);
}

export function updateCluster(id, data) {
  return updateDoc(clusterDoc(id), { ...data, updatedAt: serverTimestamp() });
}

export function deleteCluster(id) {
  return deleteDoc(clusterDoc(id));
}
