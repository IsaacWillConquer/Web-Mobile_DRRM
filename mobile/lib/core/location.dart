import 'package:geolocator/geolocator.dart';

/// Requests permission (if needed) and resolves the device position.
///
/// Uses a bounded wait so it never hangs silently, and falls back to the last
/// known position. Returns null when permission is denied or no fix is
/// available.
Future<Position?> resolvePosition({
  LocationAccuracy accuracy = LocationAccuracy.medium,
  Duration timeLimit = const Duration(seconds: 8),
}) async {
  try {
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied ||
        permission == LocationPermission.deniedForever) {
      return null;
    }

    try {
      return await Geolocator.getCurrentPosition(
        locationSettings: LocationSettings(
          accuracy: accuracy,
          timeLimit: timeLimit,
        ),
      );
    } catch (_) {
      return Geolocator.getLastKnownPosition();
    }
  } catch (_) {
    return null;
  }
}
