import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../../config/firebase";
import { COLLECTIONS } from "../../config/appConfig";

const logsRef = collection(db, COLLECTIONS.logs);

// Append-only audit log; readable by staff per Firestore rules.
export function watchLogs({ max = 200 } = {}, onData, onError) {
  return onSnapshot(
    query(logsRef, orderBy("createdAt", "desc"), limit(max)),
    onData,
    onError,
  );
}
