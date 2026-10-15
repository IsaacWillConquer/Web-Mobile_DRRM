import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

import '../models/report.dart';

class ReportService {
  ReportService._();
  static final ReportService instance = ReportService._();

  FirebaseFirestore get _db => FirebaseFirestore.instance;
  String get _uid => FirebaseAuth.instance.currentUser!.uid;

  Future<String> submitReport({
    required String disasterType,
    required String description,
    required String onBehalfOf,
    required double lat,
    required double lng,
    required int peopleAffected,
    List<String> imageUrls = const [],
  }) async {
    final doc = await _db.collection('reports').add({
      'reporterId': _uid,
      'onBehalfOf': onBehalfOf,
      'disasterType': disasterType,
      'description': description,
      'lat': lat,
      'lng': lng,
      'imageUrls': imageUrls.take(3).toList(),
      'status': 'Submitted',
      'priority': 'medium',
      'peopleAffected': peopleAffected,
      'clusterId': null,
      'verifiedBy': null,
      'history': [
        {
          'status': 'Submitted',
          'by': _uid,
          'at': DateTime.now().toIso8601String(),
        },
      ],
      'createdAt': FieldValue.serverTimestamp(),
    });
    return doc.id;
  }

  Future<void> saveContact(String reportId, Map<String, dynamic> data) {
    return _db.collection('reportContacts').doc(reportId).set({
      ...data,
      'updatedAt': FieldValue.serverTimestamp(),
    });
  }

  Stream<List<Report>> myReports() {
    return _db
        .collection('reports')
        .where('reporterId', isEqualTo: _uid)
        .snapshots()
        .map((snap) {
      final reports =
          snap.docs.map((d) => Report.fromDoc(d.id, d.data())).toList();
      reports.sort((a, b) {
        final ad = a.createdAt;
        final bd = b.createdAt;
        if (ad == null && bd == null) return 0;
        if (ad == null) return 1;
        if (bd == null) return -1;
        return bd.compareTo(ad);
      });
      return reports;
    });
  }
}
