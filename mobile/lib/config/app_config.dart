import 'package:flutter/material.dart';

import 'map_styles.dart';

class AppConfig {
  static const String appName = 'DRRM';
  static const String appTagline = 'Disaster Rescue Reporting & Monitoring';

  /// When true, the hazard overlays (typhoon / storm signals / rain) are drawn
  /// from bundled demo data (see core/demo_data.dart) instead of Firestore.
  /// Set to false to use the live feeds (the demo data is seeded in Firestore).
  static const bool demoMode = false;

  static const String cloudinaryCloudName = 'wyjg9xop';
  static const String cloudinaryUploadPreset = 'drrm-cloudinary';

  static String get mapStyleUrl => MapStyles.defaultStyle.url;
  static const String rainForecastSource = 'Open-Meteo';

  static const String ldrrmoHotline = '+639000000000';

  static const List<String> priorities = ['low', 'medium', 'high'];

  static const List<String> disabilityOptions = [
    'None',
    'Visual',
    'Hearing',
    'Speech',
    'Physical / Mobility',
    'Intellectual',
    'Learning',
    'Psychosocial',
    'Multiple',
    'Other',
  ];

  static const List<String> disasterTypes = [
    'Flood',
    'Fire',
    'Earthquake',
    'Landslide',
    'Typhoon',
    'Storm Surge',
    'Other',
  ];

  static const List<String> reportStatuses = [
    'Submitted',
    'Under Verification',
    'Verified',
    'Awaiting Assignment',
    'Team Assigned',
    'Rescue in Progress',
    'Resolved',
    'Closed',
    'Rejected',
    'Duplicate',
    'Cancelled',
  ];
}

class AppTheme {
  static ThemeData build() {
    final scheme = ColorScheme.fromSeed(seedColor: const Color(0xFF1D4ED8));
    return ThemeData(
      colorScheme: scheme,
      useMaterial3: true,
      inputDecorationTheme: InputDecorationTheme(
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(48),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ),
      ),
    );
  }
}
