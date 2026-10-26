import 'package:cloud_firestore/cloud_firestore.dart';

class Assignment {
  const Assignment({
    required this.id,
    this.reportId,
    this.teamId,
    required this.status,
    this.type = 'primary',
    this.notes,
    this.createdAt,
  });

  final String id;
  final String? reportId;
  final String? teamId;
  final String status; // dispatched | accepted | in_progress | completed | declined | cancelled
  final String type;
  final String? notes;
  final DateTime? createdAt;

  bool get isDone =>
      status == 'completed' || status == 'declined' || status == 'cancelled';

  factory Assignment.fromDoc(String id, Map<String, dynamic> data) {
    final created = data['createdAt'];
    return Assignment(
      id: id,
      reportId: data['reportId'] as String?,
      teamId: data['teamId'] as String?,
      status: (data['status'] ?? 'dispatched') as String,
      type: (data['type'] ?? 'primary') as String,
      notes: data['notes'] as String?,
      createdAt: created is Timestamp ? created.toDate() : null,
    );
  }
}
