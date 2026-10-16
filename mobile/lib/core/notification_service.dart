import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

import '../models/app_notification.dart';

class NotificationService {
  NotificationService._();
  static final NotificationService instance = NotificationService._();

  FirebaseFirestore get _db => FirebaseFirestore.instance;
  String? get _uid => FirebaseAuth.instance.currentUser?.uid;

  /// Newest-first stream of the signed-in user's notifications.
  /// Requires the `userId + createdAt` composite index.
  Stream<List<AppNotification>> watchMine() {
    final uid = _uid;
    if (uid == null) return Stream.value(const []);
    return _db
        .collection('notifications')
        .where('userId', isEqualTo: uid)
        .orderBy('createdAt', descending: true)
        .snapshots()
        .map((snap) =>
            snap.docs.map((d) => AppNotification.fromDoc(d.id, d.data())).toList());
  }

  Future<void> markRead(String id) {
    return _db.collection('notifications').doc(id).update({
      'read': true,
      'readAt': FieldValue.serverTimestamp(),
    });
  }

  Future<void> markAllRead(List<AppNotification> unread) async {
    if (unread.isEmpty) return;
    final batch = _db.batch();
    for (final n in unread) {
      batch.update(_db.collection('notifications').doc(n.id), {
        'read': true,
        'readAt': FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
  }
}
