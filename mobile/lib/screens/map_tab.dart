import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show rootBundle;
import 'package:geolocator/geolocator.dart';
import 'package:maplibre_gl/maplibre_gl.dart';

import '../config/map_styles.dart';
import '../core/location.dart';
import '../core/overlay_renderer.dart';
import '../core/overlays.dart';
import '../core/province_lookup.dart';
import '../core/rain_service.dart';
import '../core/signal_resolver.dart';
import '../core/typhoon_service.dart';
import '../models/map_overlay.dart';
import '../models/rain_forecast.dart';
import '../models/typhoon.dart';
import '../widgets/map_layers_sheet.dart';
import '../widgets/overlay_pill.dart';
import '../widgets/typhoon_alert_card.dart';

const LatLng _phCenter = LatLng(12.8797, 121.7740);
const String _provincesAsset = 'assets/geo/ph_provinces.geojson';
const String _regionsAsset = 'assets/geo/ph_regions.geojson';

class MapTab extends StatefulWidget {
  const MapTab({super.key});

  @override
  State<MapTab> createState() => _MapTabState();
}

class _MapTabState extends State<MapTab> {
  final String _styleUrl = MapStyles.defaultStyle.url;

  MapLibreMapController? _controller;
  bool _styleLoaded = false;
  Circle? _me;
  LatLng? _mePosition;
  bool _locating = false;

  Typhoon? _typhoon;
  StormSignal? _signal;
  RainForecast? _rain;
  Map<String, dynamic>? _provinces;
  Map<String, dynamic>? _regions;

  MapOverlay _active = MapOverlay.none;
  bool _loading = true;
  bool _loadFailed = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  OverlayRenderer? get _renderer {
    final controller = _controller;
    if (controller == null || !_styleLoaded) return null;
    return OverlayRenderer(controller);
  }

  Future<Position?> _tryLocation() => resolvePosition();

  Future<T?> _safe<T>(Future<T?> Function() load) async {
    try {
      return await load();
    } catch (_) {
      return null;
    }
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _loadFailed = false;
    });
    try {
      final provincesRaw = await rootBundle.loadString(_provincesAsset);
      final regionsRaw = await rootBundle.loadString(_regionsAsset);
      _provinces = parseGeoJson(provincesRaw);
      _regions = parseGeoJson(regionsRaw);

      _typhoon =
          await _safe<Typhoon>(() => TyphoonService.instance.getActiveTyphoon());
      _rain = await _safe<RainForecast>(() => RainService.instance.latest());
      final position = await _tryLocation();
      if (position != null) {
        _mePosition = LatLng(position.latitude, position.longitude);
      }

      final typhoon = _typhoon;
      if (typhoon != null && typhoon.hasSignals && _mePosition != null) {
        final lookup = await ProvinceLookup.load();
        _signal = StormSignalResolver(lookup)
            .resolve(typhoon, _mePosition!.latitude, _mePosition!.longitude);
      }

      if (!mounted) return;
      setState(() {});
      await _syncMe();
      _moveToUser();
      await _applyOverlay();
    } catch (_) {
      if (mounted) setState(() => _loadFailed = true);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _applyOverlay() async {
    final renderer = _renderer;
    if (renderer == null) return;
    await renderer.clear();
    switch (_active) {
      case MapOverlay.stormSignals:
        final provinces = _provinces;
        if (provinces != null && _typhoon != null) {
          await renderer.showStormSignals(
            buildStormSignals(provinces, _typhoon!.signals),
          );
        }
      case MapOverlay.rainForecast:
        final regions = _regions;
        if (regions != null && _rain != null) {
          await renderer.showRainForecast(
            buildRainForecast(regions, _rain!.regions),
          );
        }
      case MapOverlay.typhoons:
        if (_typhoon != null) await renderer.showTyphoon(_typhoon!);
      case MapOverlay.none:
        break;
    }
  }

  Future<void> _syncMe() async {
    final controller = _controller;
    final position = _mePosition;
    if (controller == null || !_styleLoaded || position == null) return;
    final options = CircleOptions(
      geometry: position,
      circleRadius: 8,
      circleColor: '#3B82F6',
      circleStrokeColor: '#FFFFFF',
      circleStrokeWidth: 3,
    );
    if (_me == null) {
      _me = await controller.addCircle(options);
    } else {
      await controller.updateCircle(_me!, options);
    }
  }

  void _moveToUser({double zoom = 14}) {
    final controller = _controller;
    final position = _mePosition;
    if (controller != null && position != null) {
      controller.animateCamera(CameraUpdate.newLatLngZoom(position, zoom));
    }
  }

  Future<void> _recenter() async {
    if (_locating) return;
    setState(() => _locating = true);
    try {
      if (_mePosition == null) {
        final position = await _tryLocation();
        if (position == null) {
          _showMessage('Location unavailable. Check GPS and permissions.');
          return;
        }
        if (!mounted) return;
        setState(() =>
            _mePosition = LatLng(position.latitude, position.longitude));
      }
      await _syncMe();
      _moveToUser(zoom: 15);
    } finally {
      if (mounted) setState(() => _locating = false);
    }
  }

  Future<void> _openLayers() async {
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => MapLayersSheet(
        active: _active,
        onChanged: _onOverlayChanged,
        typhoonAvailable: _typhoon?.hasTrack ?? false,
        signalsAvailable: _typhoon?.hasSignals ?? false,
        rainAvailable: _rain?.regions.isNotEmpty ?? false,
      ),
    );
  }

  void _onOverlayChanged(MapOverlay overlay) {
    setState(() => _active = overlay);
    _applyOverlay();
  }

  void _showMessage(String text) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
  }

  void _dismiss() {
    final typhoon = _typhoon;
    if (typhoon != null) TyphoonService.instance.dismiss(typhoon);
    setState(() {});
  }

  bool get _showCard =>
      _typhoon != null && !TyphoonService.instance.isDismissed(_typhoon);

  String? get _overlayLabel => switch (_active) {
        MapOverlay.typhoons => 'Typhoons',
        MapOverlay.stormSignals => 'Storm Signals',
        MapOverlay.rainForecast => 'Rain Forecast',
        MapOverlay.none => null,
      };

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        MapLibreMap(
          styleString: _styleUrl,
          initialCameraPosition: const CameraPosition(target: _phCenter, zoom: 5),
          tiltGesturesEnabled: false,
          rotateGesturesEnabled: false,
          compassEnabled: false,
          onMapCreated: (controller) => _controller = controller,
          onStyleLoadedCallback: () {
            _styleLoaded = true;
            _syncMe();
            _applyOverlay();
            _moveToUser();
          },
        ),
        SafeArea(
          bottom: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (_showCard)
                  TyphoonAlertCard(
                    typhoon: _typhoon!,
                    signal: _signal,
                    onDismiss: _dismiss,
                  ),
                if (_active == MapOverlay.typhoons && _typhoon!.hasTrack) ...[
                  const SizedBox(height: 8),
                  Center(child: _TyphoonChip(typhoon: _typhoon!)),
                ],
                if (_loadFailed)
                  const _Notice(
                    icon: Icons.error_outline,
                    text: 'Could not load live data.',
                  ),
              ],
            ),
          ),
        ),
        if (_loading)
          const Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: LinearProgressIndicator(minHeight: 2),
          ),
        if (_overlayLabel != null)
          Positioned(
            left: 16,
            bottom: 24,
            child: OverlayPill(label: _overlayLabel!, onTap: _openLayers),
          ),
        Positioned(
          right: 16,
          bottom: 24,
          child: Column(
            children: [
              _circleButton(
                icon: Icons.layers_outlined,
                onTap: _openLayers,
              ),
              const SizedBox(height: 12),
              _circleButton(
                icon: Icons.my_location,
                color: const Color(0xFF3B82F6),
                busy: _locating,
                onTap: _recenter,
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _circleButton({
    required IconData icon,
    required VoidCallback onTap,
    Color color = const Color(0xFF1F2937),
    bool busy = false,
  }) {
    return Material(
      color: Colors.white,
      shape: const CircleBorder(),
      elevation: 3,
      shadowColor: Colors.black26,
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: SizedBox(
          width: 48,
          height: 48,
          child: busy
              ? const Padding(
                  padding: EdgeInsets.all(14),
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : Icon(icon, color: color),
        ),
      ),
    );
  }
}

class _TyphoonChip extends StatelessWidget {
  const _TyphoonChip({required this.typhoon});

  final Typhoon typhoon;

  @override
  Widget build(BuildContext context) {
    final winds = typhoon.maxWindsKph;
    final label = winds == null
        ? typhoon.name.toUpperCase()
        : '${typhoon.name.toUpperCase()} · $winds km/h';
    return Material(
      elevation: 3,
      borderRadius: BorderRadius.circular(24),
      color: Colors.white,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 22,
              height: 22,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                color: Color(0xFFE53935),
              ),
              child: const Icon(Icons.cyclone, size: 14, color: Colors.white),
            ),
            const SizedBox(width: 8),
            Text(
              label,
              style: const TextStyle(
                fontWeight: FontWeight.bold,
                color: Color(0xFF1F2937),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Notice extends StatelessWidget {
  const _Notice({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Material(
      elevation: 3,
      borderRadius: BorderRadius.circular(12),
      color: Colors.white,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 18, color: Colors.red.shade700),
            const SizedBox(width: 8),
            Flexible(child: Text(text, style: const TextStyle(fontSize: 13))),
          ],
        ),
      ),
    );
  }
}
