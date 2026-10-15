import 'package:maplibre_gl/maplibre_gl.dart';

import '../models/typhoon.dart';
import 'overlays.dart';

/// Adds/removes the thematic overlays on a single MapLibre controller.
class OverlayRenderer {
  OverlayRenderer(this.controller);

  final MapLibreMapController controller;

  static const _layerIds = <String>[
    'drrm-signals-src', 'drrm-signals-fill', 'drrm-signals-label',
    'drrm-rain-src', 'drrm-rain-fill', 'drrm-rain-label',
    'drrm-tc-danger-src', 'drrm-tc-danger',
    'drrm-tc-cone-src', 'drrm-tc-cone',
    'drrm-tc-track-src', 'drrm-tc-track',
    'drrm-tc-fc-src', 'drrm-tc-fc-circle', 'drrm-tc-fc-label',
  ];

  static const _signalFill = [
    'match', ['get', 'level'],
    1, '#1E88E5',
    2, '#F9A825',
    3, '#EF6C00',
    4, '#D32F2F',
    5, '#C2185B',
    '#9E9E9E',
  ];

  static const _rainFill = [
    'match', ['get', 'level'],
    1, '#93C5FD',
    2, '#FCD34D',
    3, '#F87171',
    '#9E9E9E',
  ];

  Future<void> clear() async {
    for (final id in _layerIds.reversed) {
      try {
        if (id.endsWith('-src')) {
          await controller.removeSource(id);
        } else {
          await controller.removeLayer(id);
        }
      } catch (_) {
        // Layer/source not present — ignore.
      }
    }
  }

  Future<void> showStormSignals(Map<String, dynamic> features) async {
    await controller.addGeoJsonSource('drrm-signals-src', features);
    await controller.addFillLayer(
      'drrm-signals-src',
      'drrm-signals-fill',
      FillLayerProperties(
        fillColor: _signalFill,
        fillOpacity: 0.5,
        fillOutlineColor: '#FFFFFF',
      ),
    );
    await _labels('drrm-signals-src', 'drrm-signals-label');
  }

  Future<void> showRainForecast(Map<String, dynamic> features) async {
    await controller.addGeoJsonSource('drrm-rain-src', features);
    await controller.addFillLayer(
      'drrm-rain-src',
      'drrm-rain-fill',
      FillLayerProperties(
        fillColor: _rainFill,
        fillOpacity: 0.5,
        fillOutlineColor: '#FFFFFF',
      ),
    );
    await _labels('drrm-rain-src', 'drrm-rain-label');
  }

  Future<void> showTyphoon(Typhoon typhoon) async {
    if (typhoon.track.isEmpty) return;

    if (typhoon.dangerRadiusKm != null) {
      final center = typhoon.track.last;
      await controller.addGeoJsonSource('drrm-tc-danger-src', {
        'type': 'FeatureCollection',
        'features': [
          {
            'type': 'Feature',
            'properties': const <String, dynamic>{},
            'geometry': {
              'type': 'Polygon',
              'coordinates': [
                circleRing(center[0], center[1], typhoon.dangerRadiusKm!),
              ],
            },
          },
        ],
      });
      await controller.addFillLayer(
        'drrm-tc-danger-src',
        'drrm-tc-danger',
        FillLayerProperties(
          fillColor: '#D32F2F',
          fillOpacity: 0.12,
          fillOutlineColor: '#D32F2F',
        ),
      );
    }

    if (typhoon.cone != null) {
      await controller.addGeoJsonSource('drrm-tc-cone-src', {
        'type': 'Feature',
        'properties': const <String, dynamic>{},
        'geometry': typhoon.cone,
      });
      await controller.addFillLayer(
        'drrm-tc-cone-src',
        'drrm-tc-cone',
        FillLayerProperties(fillColor: '#9CA3AF', fillOpacity: 0.35),
      );
    }

    await controller.addGeoJsonSource(
      'drrm-tc-track-src',
      buildTyphoonTrack(typhoon),
    );
    await controller.addLineLayer(
      'drrm-tc-track-src',
      'drrm-tc-track',
      LineLayerProperties(lineColor: '#1D4ED8', lineWidth: 3),
    );

    await controller.addGeoJsonSource(
      'drrm-tc-fc-src',
      buildTyphoonForecast(typhoon),
    );
    await controller.addCircleLayer(
      'drrm-tc-fc-src',
      'drrm-tc-fc-circle',
      CircleLayerProperties(
        circleRadius: 6,
        circleColor: '#FFFFFF',
        circleStrokeColor: '#D32F2F',
        circleStrokeWidth: 2,
      ),
    );
    await _labels(
      'drrm-tc-fc-src',
      'drrm-tc-fc-label',
      color: '#9B1C1C',
      size: 11,
    );
  }

  Future<void> _labels(
    String sourceId,
    String layerId, {
    String color = '#1F2937',
    double size = 12,
  }) async {
    await controller.addSymbolLayer(
      sourceId,
      layerId,
      SymbolLayerProperties(
        textField: const ['get', 'label'],
        textSize: size,
        textColor: color,
        textHaloColor: '#FFFFFF',
        textHaloWidth: 1.5,
        textAllowOverlap: true,
      ),
    );
  }
}
