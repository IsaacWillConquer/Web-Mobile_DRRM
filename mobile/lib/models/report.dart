import 'package:cloud_firestore/cloud_firestore.dart';

class Report {
  const Report({
    required this.id,
    required this.disasterType,
    required this.description,
    required this.status,
    required this.priority,
    required this.onBehalfOf,
    required this.imageUrls,
    required this.peopleAffected,
    this.lat,
    this.lng,
    this.createdAt,
  });

  final String id;
  final String disasterType;
  final String description;
  final String status;
  final String priority;
  final String onBehalfOf;
  final List<String> imageUrls;
  final int peopleAffected;
  final double? lat;
  final double? lng;
  final DateTime? createdAt;

  factory Report.fromDoc(String id, Map<String, dynamic> data) {
    final created = data['createdAt'];
    return Report(
      id: id,
      disasterType: (data['disasterType'] ?? 'Other') as String,
      description: (data['description'] ?? '') as String,
      status: (data['status'] ?? 'Submitted') as String,
      priority: (data['priority'] ?? 'medium') as String,
      onBehalfOf: (data['onBehalfOf'] ?? 'self') as String,
      imageUrls: ((data['imageUrls'] ?? const []) as List).cast<String>(),
      peopleAffected: (data['peopleAffected'] ?? 0) as int,
      lat: (data['lat'] as num?)?.toDouble(),
      lng: (data['lng'] as num?)?.toDouble(),
      createdAt: created is Timestamp ? created.toDate() : null,
    );
  }
}
