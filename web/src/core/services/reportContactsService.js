import { doc, getDoc } from "firebase/firestore";
import { db } from "../../config/firebase";
import { COLLECTIONS } from "../../config/appConfig";

const contactDoc = (reportId) => doc(db, COLLECTIONS.reportContacts, reportId);

export async function getReportContact(reportId) {
  const snap = await getDoc(contactDoc(reportId));
  return snap.exists() ? snap.data() : null;
}
