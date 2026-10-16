import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

import '../models/report.dart';

const String _base32 = '0123456789bcdefghjkmnpqrstuvwxyz';

/// Standard geohash encoder (no dependency). Precision 8 ≈ 19 m cells —
/// fine-grained enough for nearby-report queries and duplicate hints.
String encodeGeohash(double lat, double lng, {int precision = 8}) {
  var latMin = -90.0, latMax = 90.0;
  var lngMin = -180.0, lngMax = 180.0;
  var isEven = true, bit = 0, chIndex = 0;
  final out = StringBuffer();
  while (out.length < precision) {
    if (isEven) {
      final mid = (lngMin + lngMax) / 2;
      if (lng >= mid) {
        chIndex = (chIndex << 1) + 1;
        lngMin = mid;
      } else {
        chIndex = chIndex << 1;
        lngMax = mid;
      }
    } else {
      final mid = (latMin + latMax) / 2;
      if (lat >= mid) {
        chIndex = (chIndex << 1) + 1;
        latMin = mid;
      } else {
        chIndex = chIndex << 1;
        latMax = mid;
      }
    }
    isEven = !isEven;
    if (++bit == 5) {
      out.write(_base32[chIndex]);
      bit = 0;
      chIndex = 0;
    }
  }
  return out.toString();
}

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
      'geohash': encodeGeohash(lat, lng),
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
          'at': DateTime.now().millisecondsSinceEpoch,
        },
      ],
      'createdAt': FieldValue.serverTimestamp(),
    });
    await _notifyDispatchers(reportId: doc.id, disasterType: disasterType);
    return doc.id;
  }

  /// Fixed-shape "new_report" pings to the dispatcher list (config/dispatch).
  /// Shape is locked down by Firestore rules; failures never block submission.
  Future<void> _notifyDispatchers({
    required String reportId,
    required String disasterType,
  }) async {
    try {
      final config = await _db.collection('config').doc('dispatch').get();
      final uids =
          (config.data()?['dispatcherUids'] as List?)?.cast<String>() ?? const [];
      if (uids.isEmpty) return;
      final batch = _db.batch();
      for (final uid in uids) {
        batch.set(_db.collection('notifications').doc(), {
          'type': 'new_report',
          'reportId': reportId,
          'userId': uid,
          'read': false,
          'title': 'New report needs verification',
          'body': 'A $disasterType report was just submitted.',
          'createdAt': FieldValue.serverTimestamp(),
        });
      }
      await batch.commit();
    } catch (_) {
      // Pings are best-effort; the report is already saved.
    }
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
