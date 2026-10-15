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
  writeBatch,
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { COLLECTIONS } from "../../config/appConfig";

const notificationsRef = collection(db, COLLECTIONS.notifications);
const notificationDoc = (id) => doc(db, COLLECTIONS.notifications, id);

export function createNotification(data) {
  return addDoc(notificationsRef, {
    read: false,
    createdAt: serverTimestamp(),
    ...data,
  });
}

export function watchNotifications(userId, onData, onError) {
  return onSnapshot(
    query(
      notificationsRef,
      where("userId", "==", userId),
      orderBy("createdAt", "desc"),
    ),
    onData,
    onError,
  );
}

export function markNotificationRead(id) {
  return updateDoc(notificationDoc(id), { read: true, readAt: serverTimestamp() });
}

export async function markAllNotificationsRead(items) {
  const batch = writeBatch(db);
  items
    .filter((item) => !item.read)
    .forEach((item) => {
      batch.update(notificationDoc(item.id), { read: true, readAt: serverTimestamp() });
    });
  return batch.commit();
}
