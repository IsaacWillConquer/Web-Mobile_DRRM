import 'package:cloud_firestore/cloud_firestore.dart';

class AppNotification {
  const AppNotification({
    required this.id,
    required this.userId,
    required this.title,
    required this.body,
    required this.read,
    this.type,
    this.reportId,
    this.readAt,
    this.createdAt,
  });

  final String id;
  final String userId;
  final String title;
  final String body;
  final bool read;
  final String? type;
  final String? reportId;
  final DateTime? readAt;
  final DateTime? createdAt;

  factory AppNotification.fromDoc(String id, Map<String, dynamic> data) {
    return AppNotification(
      id: id,
      userId: (data['userId'] ?? '') as String,
      title: (data['title'] ?? '') as String,
      body: (data['body'] ?? '') as String,
      read: (data['read'] ?? false) as bool,
      type: data['type'] as String?,
      reportId: data['reportId'] as String?,
      readAt: _parseDate(data['readAt']),
      createdAt: _parseDate(data['createdAt']),
    );
  }

  /// Tolerant parser: serverTimestamp resolves to [Timestamp]; legacy rows may
  /// hold epoch-ms ints or ISO strings.
  static DateTime? _parseDate(Object? value) {
    if (value is Timestamp) return value.toDate();
    if (value is int) return DateTime.fromMillisecondsSinceEpoch(value);
    if (value is String && value.isNotEmpty) {
      return DateTime.tryParse(value);
    }
    return null;
  }
}
