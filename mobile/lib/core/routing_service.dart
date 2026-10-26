import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:maplibre_gl/maplibre_gl.dart';

import '../config/map_config.dart';

class RouteResult {
  const RouteResult({
    required this.points,
    required this.distanceMeters,
    required this.durationSeconds,
  });

  final List<LatLng> points;
  final double distanceMeters;
  final double durationSeconds;

  String get distanceText => distanceMeters >= 1000
      ? '${(distanceMeters / 1000).toStringAsFixed(1)} km'
      : '${distanceMeters.round()} m';

  String get etaText {
    final mins = (durationSeconds / 60).round();
    if (mins < 1) return '< 1 min';
    if (mins < 60) return '$mins min';
    return '${mins ~/ 60} h ${mins % 60} min';
  }
}

/// Road route (like Waze / delivery apps) from OpenRouteService.
class RoutingService {
  RoutingService._();
  static final RoutingService instance = RoutingService._();

  /// Returns null when the key is missing, the request fails, or no road route exists.
  Future<RouteResult?> getRoute({
    required LatLng from,
    required LatLng to,
  }) async {
    if (MapConfig.orsKey.isEmpty || MapConfig.orsKey.startsWith('YOUR_')) {
      return null;
    }
    try {
      final res = await http
          .post(
            Uri.parse(
              'https://api.openrouteservice.org/v2/directions/driving-car/geojson',
            ),
            headers: {
              'Authorization': MapConfig.orsKey,
              'Content-Type': 'application/json',
            },
            body: jsonEncode({
              'coordinates': [
                [from.longitude, from.latitude],
                [to.longitude, to.latitude],
              ],
            }),
          )
          .timeout(const Duration(seconds: 15));
      if (res.statusCode != 200) return null;

      final json = jsonDecode(res.body) as Map<String, dynamic>;
      final feature = (json['features'] as List).first as Map<String, dynamic>;
      final coords = feature['geometry']['coordinates'] as List;
      final summary = feature['properties']['summary'] as Map<String, dynamic>;

      final points = coords
          .map((c) => LatLng((c[1] as num).toDouble(), (c[0] as num).toDouble()))
          .toList();
      return RouteResult(
        points: points,
        distanceMeters: (summary['distance'] as num).toDouble(),
        durationSeconds: (summary['duration'] as num).toDouble(),
      );
    } catch (_) {
      return null;
    }
  }
}
