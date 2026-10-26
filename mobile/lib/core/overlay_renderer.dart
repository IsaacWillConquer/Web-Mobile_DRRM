import 'package:maplibre_gl/maplibre_gl.dart';

import '../models/typhoon.dart';
import 'overlays.dart';

/// Adds/removes the thematic overlays on a single MapLibre controller.
class OverlayRenderer {
  OverlayRenderer(this.controller);

  final MapLibreMapController controller;

  static const _layerIds = <String>[
    'drrm-signals-src', 'drrm-signals-fill',
    'drrm-signals-lbl-src', 'drrm-signals-label',
    'drrm-rain-src', 'drrm-rain-fill',
    'drrm-rain-lbl-src', 'drrm-rain-label',
    'drrm-tc-gale-src', 'drrm-tc-gale-fill', 'drrm-tc-gale-line',
    'drrm-tc-storm-src', 'drrm-tc-storm-fill', 'drrm-tc-storm-line',
    'drrm-tc-cone-src', 'drrm-tc-cone-fill', 'drrm-tc-cone-line',
    'drrm-tc-pre-src', 'drrm-tc-pre',
    'drrm-tc-track-src', 'drrm-tc-track',
    'drrm-tc-fcline-src', 'drrm-tc-fcline',
    'drrm-tc-mark-src', 'drrm-tc-mark-circle', 'drrm-tc-mark-code',
    'drrm-tc-mark-time',
  ];

  // Glyph set the basemap styles ship (OpenFreeMap / MapTiler). MapLibre's
  // default font is not in those glyph servers, so labels would not draw.
  static const _font = ['Noto Sans Bold'];
  static const _dash = <double>[3, 2];

  // Built from kSignalLevels so the map and the legend share one set of colours.
  static final List<Object> _signalFill = [
    'match',
    ['get', 'level'],
    for (final style in kSignalLevels) ...[style.level, style.colorHex],
    '#9E9E9E',
  ];

  static final List<Object> _rainFill = [
    'match',
    ['get', 'level'],
    for (final style in kRainLevels) ...[style.level, style.colorHex],
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
    await controller.addGeoJsonSource(
      'drrm-signals-lbl-src',
      buildLabelPoints(features),
    );
    await _labels('drrm-signals-lbl-src', 'drrm-signals-label', size: 13);
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
    await controller.addGeoJsonSource(
      'drrm-rain-lbl-src',
      buildLabelPoints(features),
    );
    // 80+ provinces: let MapLibre hide colliding numbers; zooming in reveals them.
    await _labels(
      'drrm-rain-lbl-src',
      'drrm-rain-label',
      size: 11,
      allowOverlap: false,
    );
  }

  Future<void> showTyphoon(Typhoon typhoon) async {
    if (typhoon.track.isEmpty) return;

    // Bottom to top: wind circles, cone, past track, forecast path, markers.
    final gale = typhoon.galeArea;
    if (gale != null) {
      await _windArea(
        gale,
        'drrm-tc-gale',
        color: '#EA580C',
        fillOpacity: 0.07,
        width: 1.5,
      );
    }
    final storm = stormRing(typhoon);
    if (storm != null) {
      await _windArea(
        storm,
        'drrm-tc-storm',
        color: '#DC2626',
        fillOpacity: 0.12,
        width: 2,
      );
    }

    final cone = typhoon.cone;
    if (cone != null) {
      await controller.addGeoJsonSource('drrm-tc-cone-src', {
        'type': 'Feature',
        'properties': const <String, dynamic>{},
        'geometry': cone,
      });
      await controller.addFillLayer(
        'drrm-tc-cone-src',
        'drrm-tc-cone-fill',
        FillLayerProperties(fillColor: '#F59E0B', fillOpacity: 0.18),
      );
      await controller.addLineLayer(
        'drrm-tc-cone-src',
        'drrm-tc-cone-line',
        LineLayerProperties(
          lineColor: '#B45309',
          lineWidth: 1.5,
          lineDasharray: _dash,
        ),
      );
    }

    final past = buildTyphoonPastTrack(typhoon);
    if (past.pre != null) {
      await controller.addGeoJsonSource('drrm-tc-pre-src', past.pre!);
      await controller.addLineLayer(
        'drrm-tc-pre-src',
        'drrm-tc-pre',
        LineLayerProperties(
          lineColor: '#1D4ED8',
          lineWidth: 2.5,
          lineOpacity: 0.45,
          lineCap: 'round',
          lineJoin: 'round',
        ),
      );
    }
    if (past.main != null) {
      await controller.addGeoJsonSource('drrm-tc-track-src', past.main!);
      await controller.addLineLayer(
        'drrm-tc-track-src',
        'drrm-tc-track',
        LineLayerProperties(
          lineColor: '#1D4ED8',
          lineWidth: 3.5,
          lineCap: 'round',
          lineJoin: 'round',
        ),
      );
    }

    final forecastLine = buildTyphoonForecastLine(typhoon);
    if (forecastLine != null) {
      await controller.addGeoJsonSource('drrm-tc-fcline-src', forecastLine);
      await controller.addLineLayer(
        'drrm-tc-fcline-src',
        'drrm-tc-fcline',
        LineLayerProperties(
          lineColor: '#1D4ED8',
          lineWidth: 3,
          lineDasharray: const <double>[2, 2],
        ),
      );
    }

    await controller.addGeoJsonSource(
      'drrm-tc-mark-src',
      buildTyphoonMarkers(typhoon),
    );
    await controller.addCircleLayer(
      'drrm-tc-mark-src',
      'drrm-tc-mark-circle',
      CircleLayerProperties(
        circleRadius: 12,
        circleColor: const ['get', 'color'],
        circleStrokeColor: '#FFFFFF',
        circleStrokeWidth: 2,
      ),
    );
    await controller.addSymbolLayer(
      'drrm-tc-mark-src',
      'drrm-tc-mark-code',
      SymbolLayerProperties(
        textField: const ['get', 'code'],
        textSize: 9,
        textColor: '#FFFFFF',
        textFont: _font,
        textAllowOverlap: true,
        textIgnorePlacement: true,
      ),
    );
    await controller.addSymbolLayer(
      'drrm-tc-mark-src',
      'drrm-tc-mark-time',
      SymbolLayerProperties(
        textField: const ['get', 'time'],
        textSize: 11,
        textColor: '#7F1D1D',
        textHaloColor: '#FFFFFF',
        textHaloWidth: 1.5,
        textFont: _font,
        textAnchor: 'bottom',
        textOffset: const [0, -1.4],
        textAllowOverlap: true,
        textIgnorePlacement: true,
      ),
    );
  }

  /// A dashed-outline circle (gale-force or storm-force winds).
  Future<void> _windArea(
    WindArea area,
    String id, {
    required String color,
    required double fillOpacity,
    required double width,
  }) async {
    await controller.addGeoJsonSource('$id-src', buildWindAreaPolygon(area));
    await controller.addFillLayer(
      '$id-src',
      '$id-fill',
      FillLayerProperties(fillColor: color, fillOpacity: fillOpacity),
    );
    await controller.addLineLayer(
      '$id-src',
      '$id-line',
      LineLayerProperties(
        lineColor: color,
        lineWidth: width,
        lineDasharray: _dash,
      ),
    );
  }

  Future<void> _labels(
    String sourceId,
    String layerId, {
    String color = '#1F2937',
    double size = 12,
    bool allowOverlap = true,
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
        textFont: _font,
        textAllowOverlap: allowOverlap,
      ),
    );
  }
}
