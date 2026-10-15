import 'package:cloud_firestore/cloud_firestore.dart';

/// Weekly rainfall forecast, one entry per region.
///
/// Source: Open-Meteo (https://open-meteo.com/). Not PAGASA data.
class RegionRain {
  const RegionRain({
    required this.name,
    required this.level,
    required this.mm,
  });

  final String name;

  /// 1 = light, 2 = moderate, 3 = heavy.
  final int level;

  /// Total forecast rainfall over the forecast window, in millimetres.
  final double mm;

  factory RegionRain.fromMap(Map<String, dynamic> map) => RegionRain(
        name: (map['name'] ?? '') as String,
        level: (map['level'] as num?)?.toInt() ?? 1,
        mm: (map['mm'] as num?)?.toDouble() ?? 0,
      );
}

class RainForecast {
  const RainForecast({
    required this.source,
    required this.postedAt,
    required this.regions,
  });

  final String source;
  final DateTime postedAt;
  final List<RegionRain> regions;

  factory RainForecast.fromMap(Map<String, dynamic> data) {
    final raw = (data['regions'] ?? const []) as List;
    return RainForecast(
      source: (data['source'] ?? 'Open-Meteo') as String,
      postedAt: _parseDate(data['postedAt']),
      regions: raw
          .map((e) => RegionRain.fromMap(Map<String, dynamic>.from(e as Map)))
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
