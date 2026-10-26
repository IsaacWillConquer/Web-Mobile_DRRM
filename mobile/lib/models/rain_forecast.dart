import 'package:cloud_firestore/cloud_firestore.dart';

/// Weekly rainfall forecast, one entry per province (or per region in old
/// documents).
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
    this.byProvince = false,
  });

  final String source;
  final DateTime postedAt;
  /// The entries (named `regions` for history); provinces when [byProvince].
  final List<RegionRain> regions;

  /// True when the document holds per-province entries (`provinces`), false for
  /// the old per-region documents (`regions`).
  final bool byProvince;

  factory RainForecast.fromMap(Map<String, dynamic> data) {
    final provinces = data['provinces'];
    final hasProvinces = provinces is List && provinces.isNotEmpty;
    final raw = (hasProvinces ? provinces : (data['regions'] ?? const [])) as List;
    return RainForecast(
      source: (data['source'] ?? 'Open-Meteo') as String,
      postedAt: _parseDate(data['postedAt']),
      byProvince: hasProvinces,
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
