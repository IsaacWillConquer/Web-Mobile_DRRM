import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';
import 'package:maplibre_gl/maplibre_gl.dart';

import '../config/map_styles.dart';
import '../core/auth_service.dart';
import '../core/cloudinary_service.dart';
import '../core/rescue_service.dart';
import '../core/routing_service.dart';
import '../models/assignment.dart';
import '../models/report.dart';
import '../models/rescue_record.dart';
import '../widgets/rescue_ui.dart';

// ---------------------------------------------------------------------------
// Rescue team home: header, Active / Completed tabs, job list, popup
// ---------------------------------------------------------------------------

class RescueTeamShell extends StatefulWidget {
  const RescueTeamShell({super.key, required this.profile});

  final AppUserProfile profile;

  @override
  State<RescueTeamShell> createState() => _RescueTeamShellState();
}

class _RescueTeamShellState extends State<RescueTeamShell> {
  bool _showCompleted = false;

  StreamSubscription<List<RescueAlert>>? _alertSub;
  List<RescueAlert> _latestAlerts = [];
  final Set<String> _shownAlertIds = {};
  bool _dialogOpen = false;

  @override
  void initState() {
    super.initState();
    // Listen for "Rescue assigned" pings written by the web responder.
    _alertSub = RescueService.instance
        .watchRescueAlerts(widget.profile.uid)
        .listen((alerts) {
      _latestAlerts = alerts;
      _showNextAlert();
    }, onError: (_) {});
  }

  @override
  void dispose() {
    _alertSub?.cancel();
    super.dispose();
  }

  Future<void> _showNextAlert() async {
    if (_dialogOpen || !mounted) return;
    final pending =
        _latestAlerts.where((a) => !_shownAlertIds.contains(a.id)).toList();
    if (pending.isEmpty) return;

    final alert = pending.first;
    _shownAlertIds.add(alert.id);
    _dialogOpen = true;

    final startNow = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => _AssignedDialog(alert: alert),
    );

    _dialogOpen = false;
    try {
      await RescueService.instance.markAlertRead(alert.id);
    } catch (_) {}

    if (startNow == true && mounted && alert.assignmentId != null) {
      await _openJob(alert.assignmentId!, autoStart: true);
    }
    _showNextAlert();
  }

  Future<void> _openJob(String assignmentId, {bool autoStart = false}) async {
    final assignment = await RescueService.instance.getAssignment(assignmentId);
    if (!mounted || assignment == null) return;
    Report? report;
    if (assignment.reportId != null) {
      report = await RescueService.instance.getReport(assignment.reportId!);
    }
    if (!mounted) return;
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => RescueJobScreen(
          assignment: assignment,
          report: report,
          profile: widget.profile,
          autoStart: autoStart,
        ),
      ),
    );
  }

  Future<void> _openSummary(Assignment assignment) {
    return Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => RescueSummaryScreen(assignment: assignment),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final teamId = widget.profile.teamId;
    final name =
        widget.profile.name.isNotEmpty ? widget.profile.name : 'Rescue Responder';
    final header = _Header(name: name, onLogout: () => AuthService.instance.logout());

    return Scaffold(
      backgroundColor: RescueUi.bg,
      body: SafeArea(
        child: (teamId == null || teamId.isEmpty)
            ? Column(
                children: [
                  header,
                  const Expanded(
                    child: EmptyState(
                      icon: Icons.groups_outlined,
                      title: 'No rescue team linked yet',
                      message:
                          'Ask dispatch to add you to a rescue team, then reopen the app.',
                    ),
                  ),
                ],
              )
            : StreamBuilder<List<Assignment>>(
                stream: RescueService.instance.watchTeamAssignments(teamId),
                builder: (context, snap) {
                  final all = snap.data ?? const <Assignment>[];
                  final active = all.where((a) => !a.isDone).toList();
                  final done = all.where((a) => a.status == 'completed').toList();
                  final items = _showCompleted ? done : active;

                  Widget body;
                  if (snap.hasError) {
                    body = Center(child: Text('Error: ${snap.error}'));
                  } else if (!snap.hasData) {
                    body = const Center(child: CircularProgressIndicator());
                  } else if (items.isEmpty) {
                    body = _showCompleted
                        ? const EmptyState(
                            icon: Icons.check_circle_outline,
                            title: 'Nothing completed yet',
                            message:
                                'Finished rescues, with their notes and photos, will show up here.',
                          )
                        : const EmptyState(
                            icon: Icons.notifications_active_outlined,
                            title: 'No active rescues',
                            message:
                                'When the web responder confirms a rescue for your team, a popup will appear on this screen.',
                          );
                  } else {
                    body = ListView.separated(
                      padding: const EdgeInsets.fromLTRB(
                          RescueUi.s16, RescueUi.s16, RescueUi.s16, RescueUi.s32),
                      itemCount: items.length,
                      separatorBuilder: (_, __) =>
                          const SizedBox(height: RescueUi.s12),
                      itemBuilder: (context, i) => _AssignmentCard(
                        assignment: items[i],
                        onTap: () => items[i].status == 'completed'
                            ? _openSummary(items[i])
                            : _openJob(items[i].id),
                      ),
                    );
                  }

                  return Column(
                    children: [
                      header,
                      Padding(
                        padding: const EdgeInsets.fromLTRB(
                            RescueUi.s16, RescueUi.s12, RescueUi.s16, 0),
                        child: Row(
                          children: [
                            Expanded(
                              child: _TabTile(
                                label: 'Active',
                                count: active.length,
                                selected: !_showCompleted,
                                onTap: () => setState(() => _showCompleted = false),
                              ),
                            ),
                            const SizedBox(width: RescueUi.s12),
                            Expanded(
                              child: _TabTile(
                                label: 'Completed',
                                count: done.length,
                                selected: _showCompleted,
                                onTap: () => setState(() => _showCompleted = true),
                              ),
                            ),
                          ],
                        ),
                      ),
                      Expanded(child: body),
                    ],
                  );
                },
              ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.name, required this.onLogout});

  final String name;
  final VoidCallback onLogout;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
          RescueUi.s16, RescueUi.s16, RescueUi.s8, 0),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Rescue team', style: RescueUi.caption),
                const SizedBox(height: RescueUi.s4),
                Text(name,
                    style: RescueUi.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis),
              ],
            ),
          ),
          IconButton(
            tooltip: 'Log out',
            onPressed: onLogout,
            icon: const Icon(Icons.logout, color: RescueUi.inkSoft),
          ),
        ],
      ),
    );
  }
}

/// The big number is the value; the label is secondary.
class _TabTile extends StatelessWidget {
  const _TabTile({
    required this.label,
    required this.count,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final int count;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      decoration: BoxDecoration(
        color: selected ? RescueUi.accentSoft : RescueUi.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: selected ? RescueUi.accent : Colors.transparent,
          width: 2,
        ),
        boxShadow: selected ? null : RescueUi.softShadow,
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(
                horizontal: RescueUi.s16, vertical: RescueUi.s12),
            child: Row(
              children: [
                Text(
                  '$count',
                  style: RescueUi.title.copyWith(
                    color: selected ? RescueUi.accent : RescueUi.ink,
                  ),
                ),
                const SizedBox(width: RescueUi.s8),
                Text(
                  label,
                  style: selected
                      ? RescueUi.heading.copyWith(color: RescueUi.accent)
                      : RescueUi.body,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// "Rescue assigned" popup.
class _AssignedDialog extends StatelessWidget {
  const _AssignedDialog({required this.alert});

  final RescueAlert alert;

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: Colors.white,
      insetPadding: const EdgeInsets.all(RescueUi.s24),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      child: Padding(
        padding: const EdgeInsets.all(RescueUi.s24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: const BoxDecoration(
                color: RescueUi.urgentSoft,
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.crisis_alert, size: 36, color: RescueUi.urgent),
            ),
            const SizedBox(height: RescueUi.s16),
            Text(alert.title, style: RescueUi.title, textAlign: TextAlign.center),
            const SizedBox(height: RescueUi.s8),
            Text(alert.body, style: RescueUi.body, textAlign: TextAlign.center),
            const SizedBox(height: RescueUi.s24),
            FilledButton.icon(
              style: RescueUi.primaryButton(),
              onPressed: () => Navigator.of(context).pop(true),
              icon: const Icon(Icons.navigation),
              label: const Text('Start Tracking'),
            ),
            const SizedBox(height: RescueUi.s8),
            TextButton(
              style: TextButton.styleFrom(minimumSize: const Size.fromHeight(48)),
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text('Later'),
            ),
          ],
        ),
      ),
    );
  }
}

class _AssignmentCard extends StatelessWidget {
  const _AssignmentCard({required this.assignment, required this.onTap});

  final Assignment assignment;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final reportId = assignment.reportId;
    final completed = assignment.status == 'completed';

    return SoftCard(
      padding: const EdgeInsets.all(RescueUi.s16),
      onTap: onTap,
      child: reportId == null
          ? const Text('Assignment without a report', style: RescueUi.body)
          : StreamBuilder<Report?>(
              stream: RescueService.instance.watchReport(reportId),
              builder: (context, snap) {
                final report = snap.data;
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        IconTile(
                          icon: RescueUi.disasterIcon(report?.disasterType ?? ''),
                        ),
                        const SizedBox(width: RescueUi.s12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(report?.disasterType ?? 'Incident',
                                  style: RescueUi.heading),
                              const SizedBox(height: RescueUi.s4),
                              Text(
                                report?.lat != null
                                    ? '${report!.lat!.toStringAsFixed(4)}, ${report.lng!.toStringAsFixed(4)}'
                                    : 'Location unavailable',
                                style: RescueUi.caption,
                              ),
                            ],
                          ),
                        ),
                        StatusPill(status: assignment.status),
                      ],
                    ),
                    if (report != null && report.description.isNotEmpty) ...[
                      const SizedBox(height: RescueUi.s12),
                      Text(
                        report.description,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: RescueUi.body,
                      ),
                    ],
                    const SizedBox(height: RescueUi.s12),
                    if (completed)
                      _RecordCompact(assignmentId: assignment.id)
                    else
                      Row(
                        children: [
                          if (report != null) PriorityPill(priority: report.priority),
                          const Spacer(),
                          const Text('Open map',
                              style: TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w700,
                                  color: RescueUi.accent)),
                          const Icon(Icons.chevron_right,
                              size: 20, color: RescueUi.accent),
                        ],
                      ),
                  ],
                );
              },
            ),
    );
  }
}

// ---------------------------------------------------------------------------
// Job screen: map + route + live GPS + hold-to-confirm
// ---------------------------------------------------------------------------

class RescueJobScreen extends StatefulWidget {
  const RescueJobScreen({
    super.key,
    required this.assignment,
    required this.report,
    required this.profile,
    this.autoStart = false,
  });

  final Assignment assignment;
  final Report? report;
  final AppUserProfile profile;

  /// True when opened from the popup's "Start Tracking" button.
  final bool autoStart;

  @override
  State<RescueJobScreen> createState() => _RescueJobScreenState();
}

class _RescueJobScreenState extends State<RescueJobScreen> {
  MapLibreMapController? _map;
  String? _style;
  bool _styleLoaded = false;

  late Assignment _assignment;
  StreamSubscription<Assignment?>? _assignmentSub;

  StreamSubscription<Position>? _gpsSub;
  Position? _position;
  DateTime? _lastUpload;
  DateTime? _lastRouteAt;
  bool _routeBusy = false;
  bool _routeWarned = false;
  bool _fittedOnce = false;
  RouteResult? _route;

  Circle? _destCircle;
  Circle? _meCircle;
  Line? _routeLine;
  bool _drawing = false;

  bool _busy = false;

  Report? get _report => widget.report;

  LatLng? get _dest {
    final r = _report;
    if (r?.lat == null || r?.lng == null) return null;
    return LatLng(r!.lat!, r.lng!);
  }

  LatLng? get _me {
    final p = _position;
    if (p == null) return null;
    return LatLng(p.latitude, p.longitude);
  }

  @override
  void initState() {
    super.initState();
    _assignment = widget.assignment;

    MapStyles.resolveDefaultStyle().then((s) {
      if (mounted) setState(() => _style = s);
    });

    // Live assignment: reacts if dispatch cancels, or the web side changes status.
    _assignmentSub =
        RescueService.instance.watchAssignment(_assignment.id).listen((a) {
      if (a == null || !mounted) return;
      final wasCancelled = _assignment.status != 'cancelled' &&
          a.status == 'cancelled';
      setState(() => _assignment = a);
      if (wasCancelled) {
        _stopGps();
        _snack('Dispatch cancelled this assignment.', error: true);
      }
    });

    if (_assignment.status == 'in_progress') {
      // Re-opened mid-rescue: just resume GPS.
      _beginGps();
    } else if (widget.autoStart && _assignment.status == 'accepted') {
      // Came from the popup's "Start Tracking".
      WidgetsBinding.instance.addPostFrameCallback((_) => _startTracking());
    }
  }

  @override
  void dispose() {
    _assignmentSub?.cancel();
    _gpsSub?.cancel();
    super.dispose();
  }

  void _snack(String msg, {bool error = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(msg), backgroundColor: error ? Colors.red : null),
    );
  }

  // ---------- map drawing ----------

  Future<void> _onStyleLoaded() async {
    _styleLoaded = true;
    final dest = _dest;
    if (dest != null) {
      await _map?.animateCamera(CameraUpdate.newLatLngZoom(dest, 14));
    }
    await _drawMarkers();
  }

  Future<void> _drawMarkers() async {
    final c = _map;
    if (c == null || !_styleLoaded || _drawing) return;
    _drawing = true;
    try {
      final dest = _dest;
      if (dest != null && _destCircle == null) {
        _destCircle = await c.addCircle(CircleOptions(
          geometry: dest,
          circleColor: '#DC2626',
          circleRadius: 11,
          circleStrokeColor: '#FFFFFF',
          circleStrokeWidth: 3,
        ));
      }
      final me = _me;
      if (me != null) {
        if (_meCircle == null) {
          _meCircle = await c.addCircle(CircleOptions(
            geometry: me,
            circleColor: '#2563EB',
            circleRadius: 9,
            circleStrokeColor: '#FFFFFF',
            circleStrokeWidth: 3,
          ));
        } else {
          await c.updateCircle(_meCircle!, CircleOptions(geometry: me));
        }
      }
    } finally {
      _drawing = false;
    }
  }

  Future<void> _drawLine(List<LatLng> points) async {
    final c = _map;
    if (c == null || !_styleLoaded) return;
    if (_routeLine != null) {
      await c.removeLine(_routeLine!);
      _routeLine = null;
    }
    _routeLine = await c.addLine(LineOptions(
      geometry: points,
      lineColor: '#2563EB',
      lineWidth: 5.0,
      lineOpacity: 0.9,
    ));
  }

  Future<void> _fitTo(List<LatLng> points) async {
    final c = _map;
    if (c == null || points.length < 2) return;
    var south = points.first.latitude, north = points.first.latitude;
    var west = points.first.longitude, east = points.first.longitude;
    for (final p in points) {
      if (p.latitude < south) south = p.latitude;
      if (p.latitude > north) north = p.latitude;
      if (p.longitude < west) west = p.longitude;
      if (p.longitude > east) east = p.longitude;
    }
    await c.animateCamera(CameraUpdate.newLatLngBounds(
      LatLngBounds(
        southwest: LatLng(south, west),
        northeast: LatLng(north, east),
      ),
      left: 50,
      top: 110,
      right: 50,
      bottom: 80,
    ));
  }

  /// Fetches the road route from the responder to the incident and draws it.
  /// Falls back to a straight line if routing is unavailable.
  Future<void> _refreshRoute() async {
    final me = _me;
    final dest = _dest;
    if (me == null || dest == null || _routeBusy) return;
    _routeBusy = true;
    _lastRouteAt = DateTime.now();

    final result = await RoutingService.instance.getRoute(from: me, to: dest);
    _routeBusy = false;
    if (!mounted) return;

    if (result == null) {
      if (!_routeWarned) {
        _routeWarned = true;
        _snack('Road route unavailable (check the ORS key / internet). '
            'Showing a straight line instead.');
      }
      setState(() => _route = null);
      await _drawLine([me, dest]);
      if (!_fittedOnce) {
        _fittedOnce = true;
        await _fitTo([me, dest]);
      }
      return;
    }

    setState(() => _route = result);
    await _drawLine(result.points);
    if (!_fittedOnce) {
      _fittedOnce = true;
      await _fitTo(result.points);
    }
  }

  // ---------- GPS ----------

  Future<bool> _ensureLocationReady() async {
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied ||
        permission == LocationPermission.deniedForever) {
      _snack('Location permission denied. Tracking cannot start.', error: true);
      return false;
    }
    if (!await Geolocator.isLocationServiceEnabled()) {
      _snack('Please turn on GPS / Location Services.', error: true);
      return false;
    }
    return true;
  }

  Future<void> _beginGps() async {
    if (!await _ensureLocationReady()) return;
    await _gpsSub?.cancel();

    _gpsSub = Geolocator.getPositionStream(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 10,
      ),
    ).listen((pos) async {
      if (!mounted) return;
      setState(() => _position = pos);
      _drawMarkers();

      final now = DateTime.now();

      // Share live position with the web map (at most every 10 s).
      if (_lastUpload == null || now.difference(_lastUpload!).inSeconds >= 10) {
        _lastUpload = now;
        try {
          await RescueService.instance.updateResponderLocation(
            assignmentId: _assignment.id,
            lat: pos.latitude,
            lng: pos.longitude,
          );
        } catch (_) {}
      }

      // Re-draw the route now and then so it follows the responder.
      if (_lastRouteAt == null || now.difference(_lastRouteAt!).inSeconds >= 45) {
        _refreshRoute();
      }
    }, onError: (_) {});

    // Get the first fix quickly so the route appears right away.
    try {
      final first = await Geolocator.getCurrentPosition(
        locationSettings:
            const LocationSettings(accuracy: LocationAccuracy.high),
      );
      if (mounted && _position == null) {
        setState(() => _position = first);
        await _drawMarkers();
        await _refreshRoute();
      }
    } catch (_) {}
  }

  void _stopGps() {
    _gpsSub?.cancel();
    _gpsSub = null;
  }

  // ---------- actions ----------

  Future<void> _startTracking() async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      if (!await _ensureLocationReady()) return;
      await RescueService.instance.startTracking(
        assignmentId: _assignment.id,
        reportId: _assignment.reportId,
        uid: widget.profile.uid,
      );
      await _beginGps();
    } catch (e) {
      _snack('Could not start tracking: $e', error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }


  Future<void> _openFinishSheet() async {
    HapticFeedback.mediumImpact();
    final people = await showModalBottomSheet<int>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => _FinishSheet(
        onSubmit: (people, description, photoPaths) async {
          // 1. upload photos
          final urls = <String>[];
          for (final path in photoPaths) {
            urls.add(await CloudinaryService.instance.uploadImage(path));
          }
          // 2. save record + complete
          await RescueService.instance.finishRescue(
            assignmentId: _assignment.id,
            reportId: _assignment.reportId,
            teamId: _assignment.teamId,
            peopleRescued: people,
            description: description,
            imageUrls: urls,
            uid: widget.profile.uid,
          );
        },
      ),
    );

    if (people != null && mounted) {
      _stopGps();
      await showRescueSuccess(context, people: people); // peak moment
      if (mounted) Navigator.of(context).pop();
    }
  }

  // ---------- UI ----------

  double? get _straightDistance {
    final me = _me;
    final dest = _dest;
    if (me == null || dest == null) return null;
    return Geolocator.distanceBetween(
        me.latitude, me.longitude, dest.latitude, dest.longitude);
  }

  /// Floating route card: the distance is the headline, the label is secondary.
  Widget _banner() {
    if (_assignment.status != 'in_progress') return const SizedBox.shrink();

    final straight = _straightDistance;
    final arrived = straight != null && straight < 50;

    String headline;
    String detail;
    if (arrived) {
      headline = "You've arrived";
      detail = 'Hold the button below when the rescue is done.';
    } else if (_route != null) {
      headline = _route!.distanceText;
      detail = '${_route!.etaText} to the incident';
    } else if (straight != null) {
      headline = '${(straight / 1000).toStringAsFixed(1)} km';
      detail = 'Straight-line distance';
    } else {
      headline = 'Locating you...';
      detail = 'Waiting for a GPS signal';
    }

    final tint = arrived ? RescueUi.success : RescueUi.accent;
    final tintSoft = arrived ? RescueUi.successSoft : RescueUi.accentSoft;

    return Positioned(
      top: RescueUi.s12,
      left: RescueUi.s12,
      right: RescueUi.s12,
      child: SoftCard(
        padding: const EdgeInsets.all(RescueUi.s12),
        child: Row(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(color: tintSoft, shape: BoxShape.circle),
              child: Icon(arrived ? Icons.flag : Icons.navigation, color: tint),
            ),
            const SizedBox(width: RescueUi.s12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(headline, style: RescueUi.title),
                  const SizedBox(height: RescueUi.s4),
                  Text(detail, style: RescueUi.caption),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _actions() {
    switch (_assignment.status) {
      case 'dispatched':
        return Container(
          width: double.infinity,
          padding: const EdgeInsets.all(RescueUi.s16),
          decoration: BoxDecoration(
            color: RescueUi.accentSoft,
            borderRadius: BorderRadius.circular(16),
          ),
          child: const Row(
            children: [
              Icon(Icons.hourglass_empty, color: RescueUi.accent),
              SizedBox(width: RescueUi.s12),
              Expanded(
                child: Text(
                  "Waiting for the web responder to confirm. You'll get a popup when it's ready.",
                  style: RescueUi.body,
                ),
              ),
            ],
          ),
        );
      case 'accepted':
        return FilledButton.icon(
          style: RescueUi.primaryButton(),
          onPressed: _busy ? null : _startTracking,
          icon: _busy
              ? const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                )
              : const Icon(Icons.navigation),
          label: const Text('Start Tracking'),
        );
      case 'in_progress':
        return _HoldToConfirmButton(
          label: 'Hold to Confirm Rescue',
          onConfirmed: _openFinishSheet,
        );
      case 'completed':
        return const Row(
          children: [
            Icon(Icons.check_circle, color: RescueUi.success),
            SizedBox(width: RescueUi.s8),
            Text('Rescue completed', style: RescueUi.heading),
          ],
        );
      default:
        return Text(RescueUi.statusLabel(_assignment.status), style: RescueUi.body);
    }
  }

  @override
  Widget build(BuildContext context) {
    final report = _report;

    return Scaffold(
      backgroundColor: RescueUi.bg,
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        scrolledUnderElevation: 0,
        title: Text(report?.disasterType ?? 'Rescue job', style: RescueUi.heading),
      ),
      body: Column(
        children: [
          Expanded(
            child: Stack(
              children: [
                if (_style == null)
                  const Center(child: CircularProgressIndicator())
                else
                  MapLibreMap(
                    key: ValueKey(_style),
                    styleString: _style!,
                    initialCameraPosition: CameraPosition(
                      target: _dest ?? const LatLng(14.8433, 120.8114),
                      zoom: 13,
                    ),
                    compassEnabled: false,
                    onMapCreated: (c) => _map = c,
                    onStyleLoadedCallback: _onStyleLoaded,
                  ),
                if (_dest == null)
                  const Positioned(
                    top: RescueUi.s12,
                    left: RescueUi.s12,
                    right: RescueUi.s12,
                    child: SoftCard(
                      child: Text('This report has no coordinates.',
                          style: RescueUi.body),
                    ),
                  ),
                _banner(),
              ],
            ),
          ),
          Container(
            width: double.infinity,
            decoration: const BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
              boxShadow: RescueUi.softShadowUp,
            ),
            child: SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(
                    RescueUi.s24, RescueUi.s24, RescueUi.s24, RescueUi.s16),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        IconTile(
                          icon: RescueUi.disasterIcon(report?.disasterType ?? ''),
                          size: 40,
                        ),
                        const SizedBox(width: RescueUi.s12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(report?.disasterType ?? 'Incident',
                                  style: RescueUi.heading),
                              if (report != null && report.peopleAffected > 0)
                                Text('${report.peopleAffected} people affected',
                                    style: RescueUi.caption),
                            ],
                          ),
                        ),
                        if (report != null) PriorityPill(priority: report.priority),
                      ],
                    ),
                    const SizedBox(height: RescueUi.s16),
                    ProgressSteps(status: _assignment.status),
                    if (report != null && report.description.isNotEmpty) ...[
                      const SizedBox(height: RescueUi.s16),
                      Text(report.description,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: RescueUi.body),
                    ],
                    if (_assignment.notes != null &&
                        _assignment.notes!.isNotEmpty) ...[
                      const SizedBox(height: RescueUi.s12),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(RescueUi.s12),
                        decoration: BoxDecoration(
                          color: RescueUi.accentSoft,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Dispatcher note',
                                style: RescueUi.captionBold
                                    .copyWith(color: RescueUi.accent)),
                            const SizedBox(height: RescueUi.s4),
                            Text(_assignment.notes!, style: RescueUi.body),
                          ],
                        ),
                      ),
                    ],
                    const SizedBox(height: RescueUi.s24),
                    _actions(),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Hold-to-confirm button (press and hold ~1.5 s)
// ---------------------------------------------------------------------------

class _HoldToConfirmButton extends StatefulWidget {
  const _HoldToConfirmButton({required this.label, required this.onConfirmed});

  final String label;
  final VoidCallback onConfirmed;

  @override
  State<_HoldToConfirmButton> createState() => _HoldToConfirmButtonState();
}

class _HoldToConfirmButtonState extends State<_HoldToConfirmButton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _progress;

  @override
  void initState() {
    super.initState();
    _progress = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..addStatusListener((status) {
        if (status == AnimationStatus.completed) {
          _progress.reset();
          widget.onConfirmed();
        }
      });
  }

  @override
  void dispose() {
    _progress.dispose();
    super.dispose();
  }

  void _release() {
    if (_progress.status != AnimationStatus.completed) _progress.reverse();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Listener(
          onPointerDown: (_) {
            HapticFeedback.selectionClick();
            _progress.forward();
          },
          onPointerUp: (_) => _release(),
          onPointerCancel: (_) => _release(),
          child: AnimatedBuilder(
            animation: _progress,
            builder: (context, _) {
              final filled = _progress.value > 0.5;
              final fg = filled ? Colors.white : RescueUi.success;
              return ClipRRect(
                borderRadius: BorderRadius.circular(16),
                child: Container(
                  height: 56,
                  color: RescueUi.successSoft,
                  child: Stack(
                    children: [
                      FractionallySizedBox(
                        widthFactor: _progress.value,
                        child: Container(color: RescueUi.success),
                      ),
                      Center(
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.touch_app_rounded, color: fg, size: 24),
                            const SizedBox(width: RescueUi.s8),
                            Text(widget.label,
                                style: RescueUi.heading.copyWith(color: fg)),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
        const SizedBox(height: RescueUi.s8),
        const Text('Press and hold to confirm the rescue is done',
            style: RescueUi.caption),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Finish form: people saved, description, photos
// ---------------------------------------------------------------------------

class _FinishSheet extends StatefulWidget {
  const _FinishSheet({required this.onSubmit});

  final Future<void> Function(
    int peopleRescued,
    String description,
    List<String> photoPaths,
  ) onSubmit;

  @override
  State<_FinishSheet> createState() => _FinishSheetState();
}

class _FinishSheetState extends State<_FinishSheet> {
  static const int _maxPhotos = 5;

  final _people = TextEditingController(text: '0');
  final _description = TextEditingController();
  final List<String> _photos = [];
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _people.dispose();
    _description.dispose();
    super.dispose();
  }

  void _bump(int delta) {
    final current = int.tryParse(_people.text.trim()) ?? 0;
    final next = (current + delta) < 0 ? 0 : current + delta;
    setState(() => _people.text = '$next');
  }

  Future<void> _pickPhotos() async {
    final room = _maxPhotos - _photos.length;
    if (room <= 0) return;
    final picked = await ImagePicker().pickMultiImage(
      imageQuality: 80,
      maxWidth: 1600,
      limit: room < 2 ? 2 : room,
    );
    if (picked.isEmpty) return;

    final problems = <String>[];
    for (final file in picked) {
      if (_photos.length >= _maxPhotos) break;
      final problem = await CloudinaryService.validateImage(file.path);
      if (problem != null) {
        problems.add(problem);
      } else {
        _photos.add(file.path);
      }
    }
    if (!mounted) return;
    setState(() => _error = problems.isEmpty ? null : problems.first);
  }

  Future<void> _submit() async {
    final people = int.tryParse(_people.text.trim());
    if (people == null || people < 0) {
      setState(() => _error = 'Enter how many people were saved (0 or more).');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await widget.onSubmit(people, _description.text.trim(), _photos);
      if (mounted) Navigator.of(context).pop(people);
    } catch (e) {
      if (mounted) {
        setState(() {
          _saving = false;
          _error = 'Could not save: $e';
        });
      }
    }
  }

  Widget _stepButton(IconData icon, VoidCallback onTap) {
    return Material(
      color: RescueUi.accentSoft,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: _saving ? null : onTap,
        child: SizedBox(
          width: 56,
          height: 56,
          child: Icon(icon, color: RescueUi.accent),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final fieldDecoration = InputDecoration(
      filled: true,
      fillColor: RescueUi.bg,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: BorderSide.none,
      ),
    );

    return Padding(
      padding: EdgeInsets.fromLTRB(
        RescueUi.s24,
        0,
        RescueUi.s24,
        MediaQuery.of(context).viewInsets.bottom + RescueUi.s24,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Complete rescue', style: RescueUi.title),
            const SizedBox(height: RescueUi.s4),
            const Text('Record what happened before closing this job.',
                style: RescueUi.caption),
            const SizedBox(height: RescueUi.s24),

            const Text('People saved', style: RescueUi.heading),
            const SizedBox(height: RescueUi.s8),
            Row(
              children: [
                _stepButton(Icons.remove, () => _bump(-1)),
                const SizedBox(width: RescueUi.s12),
                Expanded(
                  child: TextField(
                    controller: _people,
                    enabled: !_saving,
                    keyboardType: TextInputType.number,
                    textAlign: TextAlign.center,
                    style: RescueUi.title,
                    decoration: fieldDecoration,
                  ),
                ),
                const SizedBox(width: RescueUi.s12),
                _stepButton(Icons.add, () => _bump(1)),
              ],
            ),
            const SizedBox(height: RescueUi.s24),

            const Text('Description', style: RescueUi.heading),
            const SizedBox(height: RescueUi.s8),
            TextField(
              controller: _description,
              maxLines: 4,
              enabled: !_saving,
              style: RescueUi.body,
              decoration: fieldDecoration.copyWith(
                hintText: 'Condition of victims, actions taken, hand-over info...',
                hintStyle: RescueUi.caption.copyWith(fontSize: 14),
              ),
            ),
            const SizedBox(height: RescueUi.s24),

            Row(
              children: [
                const Text('Photos', style: RescueUi.heading),
                const SizedBox(width: RescueUi.s8),
                Text('${_photos.length}/$_maxPhotos', style: RescueUi.caption),
              ],
            ),
            const SizedBox(height: RescueUi.s8),
            SizedBox(
              height: 80,
              child: ListView(
                scrollDirection: Axis.horizontal,
                children: [
                  if (_photos.length < _maxPhotos)
                    GestureDetector(
                      onTap: _saving ? null : _pickPhotos,
                      child: Container(
                        width: 80,
                        height: 80,
                        margin: const EdgeInsets.only(right: RescueUi.s8),
                        decoration: BoxDecoration(
                          color: RescueUi.accentSoft,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.add_a_photo_outlined, color: RescueUi.accent),
                            SizedBox(height: RescueUi.s4),
                            Text('Add',
                                style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                    color: RescueUi.accent)),
                          ],
                        ),
                      ),
                    ),
                  for (var i = 0; i < _photos.length; i++)
                    Padding(
                      padding: const EdgeInsets.only(right: RescueUi.s8),
                      child: Stack(
                        children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(12),
                            child: Image.file(File(_photos[i]),
                                width: 80, height: 80, fit: BoxFit.cover),
                          ),
                          Positioned(
                            top: 4,
                            right: 4,
                            child: GestureDetector(
                              onTap: _saving
                                  ? null
                                  : () => setState(() => _photos.removeAt(i)),
                              child: const CircleAvatar(
                                radius: 12,
                                backgroundColor: Colors.black54,
                                child: Icon(Icons.close, size: 14, color: Colors.white),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),

            if (_error != null) ...[
              const SizedBox(height: RescueUi.s16),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(RescueUi.s12),
                decoration: BoxDecoration(
                  color: RescueUi.urgentSoft,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(_error!,
                    style: RescueUi.body.copyWith(color: RescueUi.urgent)),
              ),
            ],
            const SizedBox(height: RescueUi.s24),
            FilledButton.icon(
              style: RescueUi.primaryButton(color: RescueUi.success),
              onPressed: _saving ? null : _submit,
              icon: _saving
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white),
                    )
                  : const Icon(Icons.check),
              label: Text(_saving ? 'Saving...' : 'Save & finish'),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Completed jobs: card summary + full summary screen
// ---------------------------------------------------------------------------

/// Short version shown on the Completed list card.
class _RecordCompact extends StatelessWidget {
  const _RecordCompact({required this.assignmentId});

  final String assignmentId;

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<RescueRecord?>(
      stream: RescueService.instance.watchRescueRecord(assignmentId),
      builder: (context, snap) {
        if (snap.connectionState == ConnectionState.waiting && !snap.hasData) {
          return const LinearProgressIndicator(minHeight: 2);
        }
        final record = snap.data;
        if (record == null) {
          return const Text('No rescue record was saved for this job.',
              style: RescueUi.caption);
        }

        final photos = record.imageUrls;
        final shown = photos.length > 4 ? 4 : photos.length;
        final extra = photos.length - shown;

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(RescueUi.s12),
              decoration: BoxDecoration(
                color: RescueUi.successSoft,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Text('${record.peopleRescued}',
                      style: RescueUi.title.copyWith(color: RescueUi.success)),
                  const SizedBox(width: RescueUi.s8),
                  Text(
                    record.peopleRescued == 1 ? 'person saved' : 'people saved',
                    style: RescueUi.body.copyWith(color: RescueUi.success),
                  ),
                  const Spacer(),
                  if (record.createdAt != null)
                    Text(formatRescueDate(record.createdAt!),
                        style: RescueUi.caption),
                ],
              ),
            ),
            const SizedBox(height: RescueUi.s12),
            Text(
              record.notes.isEmpty ? 'No description provided.' : record.notes,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: record.notes.isEmpty
                  ? RescueUi.caption.copyWith(fontStyle: FontStyle.italic)
                  : RescueUi.body,
            ),
            if (photos.isNotEmpty) ...[
              const SizedBox(height: RescueUi.s12),
              Row(
                children: [
                  for (var i = 0; i < shown; i++) ...[
                    Stack(
                      children: [
                        rescueThumb(photos[i], size: 56),
                        if (i == shown - 1 && extra > 0)
                          Positioned.fill(
                            child: Container(
                              decoration: BoxDecoration(
                                color: Colors.black54,
                                borderRadius: BorderRadius.circular(12),
                              ),
                              alignment: Alignment.center,
                              child: Text('+$extra',
                                  style: const TextStyle(
                                      color: Colors.white,
                                      fontWeight: FontWeight.w700)),
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(width: RescueUi.s8),
                  ],
                ],
              ),
            ],
          ],
        );
      },
    );
  }
}

/// Full summary of a finished rescue: results first, original report last.
class RescueSummaryScreen extends StatelessWidget {
  const RescueSummaryScreen({super.key, required this.assignment});

  final Assignment assignment;

  @override
  Widget build(BuildContext context) {
    final reportId = assignment.reportId;
    return Scaffold(
      backgroundColor: RescueUi.bg,
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        scrolledUnderElevation: 0,
        title: const Text('Rescue summary', style: RescueUi.heading),
      ),
      body: ListView(
        padding: const EdgeInsets.all(RescueUi.s16),
        children: [
          StreamBuilder<RescueRecord?>(
            stream: RescueService.instance.watchRescueRecord(assignment.id),
            builder: (context, snap) {
              if (snap.connectionState == ConnectionState.waiting &&
                  !snap.hasData) {
                return const Padding(
                  padding: EdgeInsets.all(RescueUi.s24),
                  child: Center(child: CircularProgressIndicator()),
                );
              }
              final record = snap.data;
              if (record == null) {
                return const SoftCard(
                  child: Text('No rescue record was saved for this job.',
                      style: RescueUi.body),
                );
              }
              final photos = record.imageUrls;
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // End-of-journey summary card
                  SoftCard(
                    color: RescueUi.successSoft,
                    padding: const EdgeInsets.all(RescueUi.s24),
                    child: Row(
                      children: [
                        Container(
                          width: 56,
                          height: 56,
                          decoration: const BoxDecoration(
                            color: Colors.white,
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(Icons.check_rounded,
                              color: RescueUi.success, size: 32),
                        ),
                        const SizedBox(width: RescueUi.s16),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                '${record.peopleRescued} '
                                '${record.peopleRescued == 1 ? 'person' : 'people'} saved',
                                style: RescueUi.title
                                    .copyWith(color: RescueUi.success),
                              ),
                              const SizedBox(height: RescueUi.s4),
                              Text(
                                record.createdAt != null
                                    ? 'Completed ${formatRescueDate(record.createdAt!)}'
                                    : 'Rescue completed',
                                style: RescueUi.caption,
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: RescueUi.s16),
                  SoftCard(
                    padding: const EdgeInsets.all(RescueUi.s24),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Rescue notes', style: RescueUi.heading),
                        const SizedBox(height: RescueUi.s8),
                        Text(
                          record.notes.isEmpty
                              ? 'No description provided.'
                              : record.notes,
                          style: record.notes.isEmpty
                              ? RescueUi.caption
                                  .copyWith(fontStyle: FontStyle.italic, fontSize: 14)
                              : RescueUi.body,
                        ),
                        if (photos.isNotEmpty) ...[
                          const SizedBox(height: RescueUi.s24),
                          Text('Photos (${photos.length})',
                              style: RescueUi.heading),
                          const SizedBox(height: RescueUi.s12),
                          Wrap(
                            spacing: RescueUi.s8,
                            runSpacing: RescueUi.s8,
                            children: [
                              for (final url in photos)
                                rescueThumb(url,
                                    size: 88,
                                    onTap: () => showRescueImage(context, url)),
                            ],
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              );
            },
          ),
          const SizedBox(height: RescueUi.s16),
          if (reportId != null)
            StreamBuilder<Report?>(
              stream: RescueService.instance.watchReport(reportId),
              builder: (context, snap) {
                final report = snap.data;
                if (report == null) return const SizedBox.shrink();
                return SoftCard(
                  padding: const EdgeInsets.all(RescueUi.s24),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          IconTile(
                              icon: RescueUi.disasterIcon(report.disasterType),
                              size: 40),
                          const SizedBox(width: RescueUi.s12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text('Original report',
                                    style: RescueUi.caption),
                                Text(report.disasterType,
                                    style: RescueUi.heading),
                              ],
                            ),
                          ),
                          PriorityPill(priority: report.priority),
                        ],
                      ),
                      if (report.description.isNotEmpty) ...[
                        const SizedBox(height: RescueUi.s16),
                        Text(report.description, style: RescueUi.body),
                      ],
                      const SizedBox(height: RescueUi.s12),
                      Row(
                        children: [
                          const Icon(Icons.place_outlined,
                              size: 16, color: RescueUi.inkMuted),
                          const SizedBox(width: RescueUi.s4),
                          Text(
                            report.lat != null && report.lng != null
                                ? '${report.lat!.toStringAsFixed(4)}, ${report.lng!.toStringAsFixed(4)}'
                                : 'Location unavailable',
                            style: RescueUi.caption,
                          ),
                          if (report.peopleAffected > 0) ...[
                            const SizedBox(width: RescueUi.s16),
                            const Icon(Icons.groups_outlined,
                                size: 16, color: RescueUi.inkMuted),
                            const SizedBox(width: RescueUi.s4),
                            Text('${report.peopleAffected} affected',
                                style: RescueUi.caption),
                          ],
                        ],
                      ),
                      if (report.imageUrls.isNotEmpty) ...[
                        const SizedBox(height: RescueUi.s16),
                        const Text('Photos from the reporter',
                            style: RescueUi.captionBold),
                        const SizedBox(height: RescueUi.s8),
                        Wrap(
                          spacing: RescueUi.s8,
                          runSpacing: RescueUi.s8,
                          children: [
                            for (final url in report.imageUrls)
                              rescueThumb(url,
                                  size: 72,
                                  onTap: () => showRescueImage(context, url)),
                          ],
                        ),
                      ],
                    ],
                  ),
                );
              },
            ),
        ],
      ),
    );
  }
}
