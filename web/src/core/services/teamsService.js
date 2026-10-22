import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { COLLECTIONS } from "../../config/appConfig";

const teamsRef = collection(db, COLLECTIONS.teams);
const teamDoc = (id) => doc(db, COLLECTIONS.teams, id);

export function createTeam(data) {
  return addDoc(teamsRef, {
    status: "available",
    memberUids: [],
    createdAt: serverTimestamp(),
    ...data,
  });
}

export function watchTeams(onData, onError) {
  return onSnapshot(query(teamsRef, orderBy("name")), onData, onError);
}

export function updateTeam(id, data) {
  return updateDoc(teamDoc(id), { ...data, updatedAt: serverTimestamp() });
}
