import 'dart:convert';

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

/// A circle of wind of a given strength (gale-force or storm-force). Its centre
/// is NOT necessarily the storm centre: JMA offsets it toward the stronger side.
class WindArea {
  const WindArea({
    required this.lat,
    required this.lng,
    required this.radiusKm,
  });

  final double lat;
  final double lng;
  final double radiusKm;

  static WindArea? tryParse(Object? value) {
    if (value is! Map) return null;
    final lat = value['lat'];
    final lng = value['lng'];
    final radius = value['radiusKm'];
    if (lat is! num || lng is! num || radius is! num) return null;
    return WindArea(
      lat: lat.toDouble(),
      lng: lng.toDouble(),
      radiusKm: radius.toDouble(),
    );
  }
}

class TyphoonPoint {
  const TyphoonPoint({
    required this.lat,
    required this.lng,
    this.hours,
    this.label,
    this.windKph,
    this.jmaClass,
    this.validAt,
    this.radiusKm,
  });

  final double lat;
  final double lng;
  final int? hours;
  final String? label;

  /// Sustained wind at this point (km/h), when the bulletin has one.
  final int? windKph;

  /// JMA's own class at this point (`TY`, `STS`, `TS`, `TD`, `LOW`).
  final String? jmaClass;

  /// When this forecast position is valid (UTC).
  final DateTime? validAt;

  /// Forecast uncertainty radius (km).
  final double? radiusKm;

  factory TyphoonPoint.fromMap(Map<String, dynamic> map) {
    return TyphoonPoint(
      lat: (map['lat'] as num).toDouble(),
      lng: (map['lng'] as num).toDouble(),
      hours: (map['hours'] as num?)?.toInt(),
      label: map['label'] as String?,
      windKph: (map['windKph'] as num?)?.toInt(),
      jmaClass: map['jmaClass'] as String?,
      validAt: _parseOptionalDate(map['validAt']),
      radiusKm: (map['radiusKm'] as num?)?.toDouble(),
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
    this.preTrackCount = 0,
    this.gustKph,
    this.pressureHpa,
    this.jmaClass,
    this.galeArea,
    this.stormArea,
    this.analysisAt,
    this.isSimulation = false,
    this.overridesLive = false,
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

  /// How many leading [track] points are the depression stage (JMA
  /// `preTyphoon`); drawn lighter than the rest.
  final int preTrackCount;
  final int? gustKph;
  final int? pressureHpa;

  /// JMA's own class right now (`TY`, `STS`, `TS`, `TD`, `LOW`).
  final String? jmaClass;

  /// Gale-force (>= 30 kt) and storm-force (>= 50 kt) wind circles.
  final WindArea? galeArea;
  final WindArea? stormArea;

  /// Time of the current position (UTC).
  final DateTime? analysisAt;

  /// Demo-only storm: the UI badges it SIMULATION.
  final bool isSimulation;

  /// A simulation that should win over a live storm (set from the seeder).
  final bool overridesLive;

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
      cone: _parseCone(data['cone']),
      dangerRadiusKm: (data['dangerRadiusKm'] as num?)?.toDouble(),
      preTrackCount: _countPreTrack(rawTrack),
      gustKph: (data['gustKph'] as num?)?.toInt(),
      pressureHpa: (data['pressureHpa'] as num?)?.toInt(),
      jmaClass: data['jmaClass'] as String?,
      galeArea: WindArea.tryParse(data['galeArea']),
      stormArea: WindArea.tryParse(data['stormArea']),
      analysisAt: _parseOptionalDate(data['analysisAt']),
      // `demo` is what the old seeder wrote into bulletins/active.
      isSimulation: data['simulation'] == true || data['demo'] == true,
      overridesLive: data['overrideLive'] == true,
    );
  }
}

// The forecast cone is a GeoJSON geometry. It is stored as a Map when written
// in-app, but Firestore forbids nested arrays, so it is stored as a JSON string
// in the database; accept both forms.
Map<String, dynamic>? _parseCone(Object? value) {
  if (value is Map) return value.cast<String, dynamic>();
  if (value is String && value.trim().isNotEmpty) {
    try {
      final decoded = jsonDecode(value);
      if (decoded is Map) return decoded.cast<String, dynamic>();
    } catch (_) {
      return null;
    }
  }
  return null;
}

// Depression-stage points come first in the stored track and carry `pre: true`.
int _countPreTrack(List raw) {
  var count = 0;
  for (final entry in raw) {
    if (entry is Map && entry['pre'] == true) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

DateTime? _parseOptionalDate(Object? value) {
  if (value is Timestamp) return value.toDate().toUtc();
  if (value is DateTime) return value.toUtc();
  if (value is String) return DateTime.tryParse(value)?.toUtc();
  return null;
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
