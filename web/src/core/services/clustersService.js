import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { COLLECTIONS } from "../../config/appConfig";

const clustersRef = collection(db, COLLECTIONS.clusters);

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

export function watchClusters(onData, onError) {
  return onSnapshot(query(clustersRef, orderBy("createdAt", "desc")), onData, onError);
}
