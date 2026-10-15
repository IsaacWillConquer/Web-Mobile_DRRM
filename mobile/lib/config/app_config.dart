import 'package:flutter/material.dart';

class AppConfig {
  static const String appName = 'DRRM';
  static const String appTagline = 'Disaster Rescue Reporting & Monitoring';

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
