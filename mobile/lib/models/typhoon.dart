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

class TyphoonPoint {
  const TyphoonPoint({
    required this.lat,
    required this.lng,
    this.hours,
    this.label,
  });

  final double lat;
  final double lng;
  final int? hours;
  final String? label;

  factory TyphoonPoint.fromMap(Map<String, dynamic> map) {
    return TyphoonPoint(
      lat: (map['lat'] as num).toDouble(),
      lng: (map['lng'] as num).toDouble(),
      hours: (map['hours'] as num?)?.toInt(),
      label: map['label'] as String?,
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
    this.internationalName,
    this.maxWindsKph,
    this.track = const [],
    this.forecast = const [],
    this.cone,
    this.dangerRadiusKm,
  });

  final String id;
  final String name;
  final String category;
  final String source;
  final String? sourceUrl;
  final DateTime postedAt;
  final bool active;
  final List<StormSignal> signals;
  final String? internationalName;
  final int? maxWindsKph;
  final List<List<double>> track;
  final List<TyphoonPoint> forecast;
  final Map<String, dynamic>? cone;
  final double? dangerRadiusKm;

  bool get hasSignals => signals.isNotEmpty;
  bool get hasTrack => track.isNotEmpty;

  factory Typhoon.fromMap(String id, Map<String, dynamic> data) {
    final rawSignals = (data['signals'] ?? const []) as List;
    final rawTrack = (data['track'] ?? const []) as List;
    final rawForecast = (data['forecast'] ?? const []) as List;

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
      internationalName: data['internationalName'] as String?,
      maxWindsKph: (data['maxWindsKph'] as num?)?.toInt(),
      track: rawTrack.map(_parsePoint).toList(growable: false),
      forecast: rawForecast
          .map((e) => TyphoonPoint.fromMap(Map<String, dynamic>.from(e as Map)))
          .toList(growable: false),
      cone: (data['cone'] as Map?)?.cast<String, dynamic>(),
      dangerRadiusKm: (data['dangerRadiusKm'] as num?)?.toDouble(),
    );
  }
}

List<double> _parsePoint(Object? value) {
  if (value is List) {
    return [(value[0] as num).toDouble(), (value[1] as num).toDouble()];
  }
  final map = (value as Map).cast<String, dynamic>();
  return [
    (map['lat'] as num).toDouble(),
    (map['lng'] as num).toDouble(),
  ];
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
