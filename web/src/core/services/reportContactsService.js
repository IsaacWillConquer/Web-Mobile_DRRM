import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../../config/firebase";
import { COLLECTIONS } from "../../config/appConfig";

const contactDoc = (reportId) => doc(db, COLLECTIONS.reportContacts, reportId);

export async function getReportContact(reportId) {
  const snap = await getDoc(contactDoc(reportId));
  return snap.exists() ? snap.data() : null;
}

export function saveReportContact(reportId, data) {
  return setDoc(
    contactDoc(reportId),
    { ...data, updatedAt: serverTimestamp() },
    { merge: true },
  );
}
