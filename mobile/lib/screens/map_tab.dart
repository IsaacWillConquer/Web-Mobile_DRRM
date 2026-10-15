import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:maplibre_gl/maplibre_gl.dart';

import '../config/app_config.dart';
import '../core/location.dart';
import '../core/province_lookup.dart';
import '../core/signal_resolver.dart';
import '../core/typhoon_service.dart';
import '../models/typhoon.dart';
import '../widgets/typhoon_alert_card.dart';

const LatLng _phCenter = LatLng(12.8797, 121.7740);

class MapTab extends StatefulWidget {
  const MapTab({super.key});

  @override
  State<MapTab> createState() => _MapTabState();
}

class _MapTabState extends State<MapTab> {
  MapLibreMapController? _controller;
  bool _styleLoaded = false;
  Circle? _me;
  LatLng? _mePosition;
  bool _locating = false;

  Typhoon? _typhoon;
  StormSignal? _signal;
  bool _loading = true;
  bool _loadFailed = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<Position?> _tryLocation() => resolvePosition();

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _loadFailed = false;
    });
    try {
      final typhoon = await TyphoonService.instance.getActiveTyphoon();
      final position = await _tryLocation();
      if (position != null) {
        _mePosition = LatLng(position.latitude, position.longitude);
      }

      StormSignal? signal;
      if (typhoon != null && typhoon.hasSignals && _mePosition != null) {
        final lookup = await ProvinceLookup.load();
        signal = StormSignalResolver(lookup).resolve(
          typhoon,
          _mePosition!.latitude,
          _mePosition!.longitude,
        );
      }

      if (!mounted) return;
      setState(() {
        _typhoon = typhoon;
        _signal = signal;
      });
      await _syncMe();
      _moveToUser();
    } catch (_) {
      if (mounted) setState(() => _loadFailed = true);
    } finally {
      if (mounted) setState(() => _loading = false);
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

  void _showMessage(String text) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(text)),
    );
  }

  void _dismiss() {
    final typhoon = _typhoon;
    if (typhoon != null) TyphoonService.instance.dismiss(typhoon);
    setState(() {});
  }

  bool get _showCard =>
      _typhoon != null && !TyphoonService.instance.isDismissed(_typhoon);

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        MapLibreMap(
          styleString: AppConfig.mapStyleUrl,
          initialCameraPosition: const CameraPosition(
            target: _phCenter,
            zoom: 5,
          ),
          tiltGesturesEnabled: false,
          rotateGesturesEnabled: false,
          compassEnabled: false,
          onMapCreated: (controller) => _controller = controller,
          onStyleLoadedCallback: () {
            _styleLoaded = true;
            _syncMe();
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
                if (_loadFailed)
                  const _Notice(
                    icon: Icons.error_outline,
                    text: 'Could not load typhoon data.',
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
        Positioned(
          right: 16,
          bottom: 24,
          child: Material(
            color: Colors.white,
            shape: const CircleBorder(),
            elevation: 3,
            shadowColor: Colors.black26,
            child: InkWell(
              customBorder: const CircleBorder(),
              onTap: _recenter,
              child: SizedBox(
                width: 48,
                height: 48,
                child: _locating
                    ? const Padding(
                        padding: EdgeInsets.all(14),
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.my_location, color: Color(0xFF3B82F6)),
              ),
            ),
          ),
        ),
      ],
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
            Flexible(
              child: Text(text, style: const TextStyle(fontSize: 13)),
            ),
          ],
        ),
      ),
    );
  }
}
