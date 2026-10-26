import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';

import '../models/assignment.dart';
import '../models/report.dart';
import '../models/rescue_record.dart';

/// "Rescue assigned" ping written by the web responder when they confirm a rescue.
class RescueAlert {
  const RescueAlert({
    required this.id,
    required this.title,
    required this.body,
    this.assignmentId,
    this.reportId,
  });

  final String id;
  final String title;
  final String body;
  final String? assignmentId;
  final String? reportId;
}

class RescueService {
  RescueService._();
  static final RescueService instance = RescueService._();

  FirebaseFirestore get _db => FirebaseFirestore.instance;

  // ---------- reading ----------

  Stream<List<Assignment>> watchTeamAssignments(String teamId) {
    return _db
        .collection('assignments')
        .where('teamId', isEqualTo: teamId)
        .snapshots()
        .map((snap) {
      final items =
          snap.docs.map((d) => Assignment.fromDoc(d.id, d.data())).toList();
      // Sort in memory so no composite index is needed.
      items.sort((a, b) {
        final ad = a.createdAt;
        final bd = b.createdAt;
        if (ad == null && bd == null) return 0;
        if (ad == null) return 1;
        if (bd == null) return -1;
        return bd.compareTo(ad);
      });
      return items;
    });
  }

  Stream<Assignment?> watchAssignment(String id) {
    return _db.collection('assignments').doc(id).snapshots().map((doc) {
      final data = doc.data();
      if (data == null) return null;
      return Assignment.fromDoc(doc.id, data);
    });
  }

  Future<Assignment?> getAssignment(String id) async {
    final doc = await _db.collection('assignments').doc(id).get();
    final data = doc.data();
    if (data == null) return null;
    return Assignment.fromDoc(doc.id, data);
  }

  Future<Report?> getReport(String reportId) async {
    final doc = await _db.collection('reports').doc(reportId).get();
    final data = doc.data();
    if (data == null) return null;
    return Report.fromDoc(doc.id, data);
  }

  Stream<Report?> watchReport(String reportId) {
    return _db.collection('reports').doc(reportId).snapshots().map((doc) {
      final data = doc.data();
      if (data == null) return null;
      return Report.fromDoc(doc.id, data);
    });
  }

  /// The rescue outcome record for a finished assignment (null until saved).
  Stream<RescueRecord?> watchRescueRecord(String assignmentId) {
    return _db
        .collection('rescueRecords')
        .where('assignmentId', isEqualTo: assignmentId)
        .limit(1)
        .snapshots()
        .map((snap) {
      if (snap.docs.isEmpty) return null;
      final doc = snap.docs.first;
      return RescueRecord.fromDoc(doc.id, doc.data());
    });
  }

  // ---------- popup alerts ----------

  /// Unread "rescue_assigned" notifications for this user (newest first).
  Stream<List<RescueAlert>> watchRescueAlerts(String uid) {
    return _db
        .collection('notifications')
        .where('userId', isEqualTo: uid)
        .where('type', isEqualTo: 'rescue_assigned')
        .snapshots()
        .map((snap) {
      final docs = snap.docs.where((d) => d.data()['read'] != true).toList();
      docs.sort((a, b) {
        final at = a.data()['createdAt'];
        final bt = b.data()['createdAt'];
        final am = at is Timestamp ? at.millisecondsSinceEpoch : 0;
        final bm = bt is Timestamp ? bt.millisecondsSinceEpoch : 0;
        return bm.compareTo(am);
      });
      return docs.map((d) {
        final data = d.data();
        return RescueAlert(
          id: d.id,
          title: (data['title'] ?? 'Rescue assigned') as String,
          body: (data['body'] ?? '') as String,
          assignmentId: data['assignmentId'] as String?,
          reportId: data['reportId'] as String?,
        );
      }).toList();
    });
  }

  Future<void> markAlertRead(String id) {
    return _db.collection('notifications').doc(id).update({
      'read': true,
      'readAt': FieldValue.serverTimestamp(),
    });
  }

  // ---------- actions ----------

  /// "Start Tracking": assignment -> in_progress, report -> Rescue in Progress,
  /// and the person who reported gets a heads-up.
  Future<void> startTracking({
    required String assignmentId,
    String? reportId,
    required String uid,
  }) async {
    await _db.collection('assignments').doc(assignmentId).update({
      'status': 'in_progress',
      'startedAt': FieldValue.serverTimestamp(),
      'updatedBy': uid,
      'updatedAt': FieldValue.serverTimestamp(),
    });

    if (reportId == null) return;
    await _db.collection('reports').doc(reportId).update({
      'status': 'Rescue in Progress',
      'updatedAt': FieldValue.serverTimestamp(),
    });
    await _notifyReporter(
      reportId,
      title: 'Rescue team en route',
      body: 'A rescue team is on the way to your location.',
    );
  }

  Future<void> updateResponderLocation({
    required String assignmentId,
    required double lat,
    required double lng,
  }) {
    return _db.collection('assignments').doc(assignmentId).update({
      'responderLocation': {
        'lat': lat,
        'lng': lng,
        'updatedAt': FieldValue.serverTimestamp(),
      },
    });
  }

  /// Saves the rescue record (people saved, description, photos), completes the
  /// assignment, and resolves the report once every team on it is finished.
  Future<void> finishRescue({
    required String assignmentId,
    required String? reportId,
    required String? teamId,
    required int peopleRescued,
    required String description,
    required List<String> imageUrls,
    required String uid,
  }) async {
    await _db.collection('rescueRecords').add({
      'assignmentId': assignmentId,
      'reportId': reportId,
      'teamId': teamId,
      'peopleRescued': peopleRescued,
      'notes': description.trim(),
      'imageUrls': imageUrls,
      'recordedBy': uid,
      'createdAt': FieldValue.serverTimestamp(),
    });

    await _db.collection('assignments').doc(assignmentId).update({
      'status': 'completed',
      'completedAt': FieldValue.serverTimestamp(),
      'updatedBy': uid,
      'updatedAt': FieldValue.serverTimestamp(),
    });

    if (reportId == null) return;

    // Only resolve the report when no other team is still working on it.
    final snap = await _db
        .collection('assignments')
        .where('reportId', isEqualTo: reportId)
        .get();
    final othersStillWorking = snap.docs.any((d) {
      if (d.id == assignmentId) return false;
      final s = d.data()['status'];
      return s != 'completed' && s != 'declined' && s != 'cancelled';
    });
    if (othersStillWorking) return;

    await _db.collection('reports').doc(reportId).update({
      'status': 'Resolved',
      'updatedAt': FieldValue.serverTimestamp(),
    });
    await _notifyReporter(
      reportId,
      title: 'Rescue completed',
      body: 'Your report has been resolved. Stay safe!',
    );
  }

  Future<void> _notifyReporter(
    String reportId, {
    required String title,
    required String body,
  }) async {
    try {
      final doc = await _db.collection('reports').doc(reportId).get();
      final reporterId = doc.data()?['reporterId'] as String?;
      if (reporterId == null) return;
      await _db.collection('notifications').add({
        'userId': reporterId,
        'title': title,
        'body': body,
        'reportId': reportId,
        'read': false,
        'createdAt': FieldValue.serverTimestamp(),
      });
    } catch (_) {
      // A failed courtesy notification must never block the rescue flow.
    }
  }
}
