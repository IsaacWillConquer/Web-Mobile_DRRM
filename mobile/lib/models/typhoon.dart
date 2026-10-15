import 'package:cloud_firestore/cloud_firestore.dart';

class StormSignal {
  const StormSignal({required this.level, required this.areas});

  final int level;
  final List<String> areas;

  factory StormSignal.fromMap(Map<String, dynamic> map) {
    return StormSignal(
      level: (map['level'] as num).toInt(),
      areas: ((map['areas'] ?? const []) as List)
          .map((e) => e.toString())
          .toList(growable: false),
    );
  }
}

class Typhoon {
  const Typhoon({
    required this.id,
    required this.name,
    required this.category,
    required this.source,
    required this.postedAt,
    required this.active,
    required this.signals,
    this.sourceUrl,
  });

  final String id;
  final String name;
  final String category;
  final String source;
  final String? sourceUrl;
  final DateTime postedAt;
  final bool active;
  final List<StormSignal> signals;

  bool get hasSignals => signals.isNotEmpty;

  factory Typhoon.fromMap(String id, Map<String, dynamic> data) {
    final rawSignals = (data['signals'] ?? const []) as List;
    return Typhoon(
      id: id,
      name: (data['typhoonName'] ?? data['name'] ?? '') as String,
      category: (data['category'] ?? '') as String,
      source: (data['source'] ?? '') as String,
      sourceUrl: data['sourceUrl'] as String?,
      postedAt: _parseDate(data['postedAt']),
      active: (data['active'] ?? false) as bool,
      signals: rawSignals
          .map((e) => StormSignal.fromMap(Map<String, dynamic>.from(e as Map)))
          .toList(growable: false),
    );
  }
}

DateTime _parseDate(Object? value) {
  if (value is Timestamp) return value.toDate();
  if (value is DateTime) return value;
  if (value is int) return DateTime.fromMillisecondsSinceEpoch(value);
  if (value is String) {
    return DateTime.tryParse(value) ?? DateTime.fromMillisecondsSinceEpoch(0);
  }
  return DateTime.fromMillisecondsSinceEpoch(0);
}
