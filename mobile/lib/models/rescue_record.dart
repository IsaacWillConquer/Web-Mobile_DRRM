import 'package:cloud_firestore/cloud_firestore.dart';

/// Outcome record written when a rescue team finishes a job
/// (`rescueRecords/{id}`, one per completed assignment).
class RescueRecord {
  const RescueRecord({
    required this.id,
    required this.assignmentId,
    required this.peopleRescued,
    required this.notes,
    required this.imageUrls,
    this.reportId,
    this.teamId,
    this.recordedBy,
    this.createdAt,
  });

  final String id;
  final String assignmentId;
  final String? reportId;
  final String? teamId;
  final int peopleRescued;
  final String notes;
  final List<String> imageUrls;
  final String? recordedBy;
  final DateTime? createdAt;

  factory RescueRecord.fromDoc(String id, Map<String, dynamic> data) {
    final created = data['createdAt'];
    return RescueRecord(
      id: id,
      assignmentId: (data['assignmentId'] ?? '') as String,
      reportId: data['reportId'] as String?,
      teamId: data['teamId'] as String?,
      peopleRescued: (data['peopleRescued'] ?? 0) as int,
      notes: (data['notes'] ?? '') as String,
      imageUrls: ((data['imageUrls'] ?? const []) as List).cast<String>(),
      recordedBy: data['recordedBy'] as String?,
      createdAt: created is Timestamp ? created.toDate() : null,
    );
  }
}
