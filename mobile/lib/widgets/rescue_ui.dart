import 'package:flutter/material.dart';

/// Shared look for the rescue-team screens.
///
/// Design rules used here (mobile UI skill):
///  - 60 / 30 / 10 colour: light neutral base, dark ink, ONE accent (the app's blue).
///    Red is kept for urgency only, green for success only.
///  - 8-point spacing (4, 8, 12, 16, 24, 32).
///  - Type: 4 sizes (12, 14, 16, 22) and 2 weights (regular, bold).
///  - Soft shadows tinted with the accent colour, never pure grey/black.
class RescueUi {
  RescueUi._();

  // ---- colour ----
  static const Color bg = Color(0xFFF5F7FB); // 60% neutral base
  static const Color surface = Colors.white;
  static const Color ink = Color(0xFF0F172A); // 30% text / dark
  static const Color inkSoft = Color(0xFF334155); // ~80% body text
  static const Color inkMuted = Color(0xFF64748B); // ~60% secondary text
  static const Color line = Color(0xFFCBD5E1);

  static const Color accent = Color(0xFF1D4ED8); // 10% brand accent
  static const Color accentSoft = Color(0xFFEEF3FF); // accent at ~5%

  static const Color urgent = Color(0xFFDC2626); // only for danger / high priority
  static const Color urgentSoft = Color(0xFFFEECEC);
  static const Color success = Color(0xFF15803D); // only for completed things
  static const Color successSoft = Color(0xFFE8F6EC);
  static const Color warn = Color(0xFFB45309); // en route / medium
  static const Color warnSoft = Color(0xFFFFF3E0);

  // ---- spacing (8-point grid) ----
  static const double s4 = 4;
  static const double s8 = 8;
  static const double s12 = 12;
  static const double s16 = 16;
  static const double s24 = 24;
  static const double s32 = 32;

  // ---- type: 4 sizes, 2 weights ----
  static const TextStyle title =
      TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: ink, height: 1.2);
  static const TextStyle heading =
      TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: ink);
  static const TextStyle body =
      TextStyle(fontSize: 14, fontWeight: FontWeight.w400, color: inkSoft, height: 1.4);
  static const TextStyle caption =
      TextStyle(fontSize: 12, fontWeight: FontWeight.w400, color: inkMuted);
  static const TextStyle captionBold =
      TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: inkMuted);

  // ---- soft shadow, tinted with the accent ----
  static const List<BoxShadow> softShadow = [
    BoxShadow(color: Color(0x141D4ED8), blurRadius: 16, offset: Offset(0, 4)),
  ];
  static const List<BoxShadow> softShadowUp = [
    BoxShadow(color: Color(0x1A1D4ED8), blurRadius: 24, offset: Offset(0, -6)),
  ];

  // ---- status helpers ----
  static String statusLabel(String status) {
    switch (status) {
      case 'dispatched':
        return 'Pending';
      case 'accepted':
        return 'Ready';
      case 'in_progress':
        return 'En route';
      case 'completed':
        return 'Completed';
      case 'declined':
        return 'Declined';
      case 'cancelled':
        return 'Cancelled';
      default:
        return status;
    }
  }

  static ({Color fg, Color bg}) statusColors(String status) {
    switch (status) {
      case 'dispatched':
      case 'accepted':
        return (fg: accent, bg: accentSoft);
      case 'in_progress':
        return (fg: warn, bg: warnSoft);
      case 'completed':
        return (fg: success, bg: successSoft);
      default:
        return (fg: inkMuted, bg: const Color(0xFFEEF1F6));
    }
  }

  static IconData disasterIcon(String type) {
    final t = type.toLowerCase();
    if (t.contains('flood')) return Icons.water_drop_outlined;
    if (t.contains('fire')) return Icons.local_fire_department_outlined;
    if (t.contains('typhoon') || t.contains('storm')) return Icons.air;
    if (t.contains('earthquake')) return Icons.vibration;
    if (t.contains('landslide')) return Icons.terrain;
    return Icons.warning_amber_rounded;
  }

  /// Primary (thumb-zone) button: tall, rounded.
  static ButtonStyle primaryButton({Color? color}) => FilledButton.styleFrom(
        minimumSize: const Size.fromHeight(56),
        backgroundColor: color ?? accent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        textStyle: heading,
      );
}

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

class SoftCard extends StatelessWidget {
  const SoftCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.onTap,
    this.color = RescueUi.surface,
  });

  final Widget child;
  final EdgeInsets padding;
  final VoidCallback? onTap;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(16),
        boxShadow: RescueUi.softShadow,
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: onTap,
          child: Padding(padding: padding, child: child),
        ),
      ),
    );
  }
}

class StatusPill extends StatelessWidget {
  const StatusPill({super.key, required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final c = RescueUi.statusColors(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      decoration: BoxDecoration(
        color: c.bg,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        RescueUi.statusLabel(status),
        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: c.fg),
      ),
    );
  }
}

/// Red is saved for HIGH priority only; the other levels stay soft.
class PriorityPill extends StatelessWidget {
  const PriorityPill({super.key, required this.priority});

  final String priority;

  @override
  Widget build(BuildContext context) {
    final label = priority.isEmpty
        ? ''
        : '${priority[0].toUpperCase()}${priority.substring(1)} priority';
    Color fg;
    Color bg;
    switch (priority) {
      case 'high':
        fg = Colors.white;
        bg = RescueUi.urgent;
        break;
      case 'medium':
        fg = RescueUi.warn;
        bg = RescueUi.warnSoft;
        break;
      default:
        fg = RescueUi.success;
        bg = RescueUi.successSoft;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(20)),
      child: Text(
        label,
        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: fg),
      ),
    );
  }
}

class IconTile extends StatelessWidget {
  const IconTile({super.key, required this.icon, this.size = 48});

  final IconData icon;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: RescueUi.accentSoft,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Icon(icon, color: RescueUi.accent, size: 24),
    );
  }
}

/// Empty states that explain what will happen next.
class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.icon,
    required this.title,
    required this.message,
  });

  final IconData icon;
  final String title;
  final String message;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(RescueUi.s32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: const BoxDecoration(
                color: RescueUi.accentSoft,
                shape: BoxShape.circle,
              ),
              child: Icon(icon, size: 32, color: RescueUi.accent),
            ),
            const SizedBox(height: RescueUi.s16),
            Text(title, style: RescueUi.heading, textAlign: TextAlign.center),
            const SizedBox(height: RescueUi.s8),
            Text(message, style: RescueUi.body, textAlign: TextAlign.center),
          ],
        ),
      ),
    );
  }
}

/// Visual timeline: Confirmed -> En route -> Completed.
class ProgressSteps extends StatelessWidget {
  const ProgressSteps({super.key, required this.status});

  final String status;

  static const _labels = ['Confirmed', 'En route', 'Completed'];

  int get _reached {
    switch (status) {
      case 'accepted':
        return 1;
      case 'in_progress':
        return 2;
      case 'completed':
        return 3;
      default:
        return 0;
    }
  }

  Widget _segment(bool filled, Color color) => Container(
        height: 2,
        color: filled ? color : RescueUi.line,
      );

  Widget _dot(int i, int reached) {
    final done = i < reached;
    final isLatest = i == reached - 1;
    final color = reached == 3 ? RescueUi.success : RescueUi.accent;
    return Container(
      width: 24,
      height: 24,
      decoration: BoxDecoration(
        color: done ? color : Colors.white,
        shape: BoxShape.circle,
        border: done ? null : Border.all(color: RescueUi.line, width: 2),
        boxShadow: done && isLatest && reached < 3
            ? [BoxShadow(color: color.withValues(alpha: 0.25), blurRadius: 8, spreadRadius: 3)]
            : null,
      ),
      child: done ? const Icon(Icons.check, size: 16, color: Colors.white) : null,
    );
  }

  @override
  Widget build(BuildContext context) {
    final reached = _reached;
    final color = reached == 3 ? RescueUi.success : RescueUi.accent;
    return Stack(
      children: [
        Positioned(
          top: 11,
          left: 0,
          right: 0,
          child: FractionallySizedBox(
            widthFactor: 2 / 3,
            child: Row(
              children: [
                Expanded(child: _segment(reached >= 2, color)),
                Expanded(child: _segment(reached >= 3, color)),
              ],
            ),
          ),
        ),
        Row(
          children: [
            for (var i = 0; i < 3; i++)
              Expanded(
                child: Column(
                  children: [
                    _dot(i, reached),
                    const SizedBox(height: RescueUi.s8),
                    Text(
                      _labels[i],
                      style: i < reached
                          ? const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: RescueUi.ink)
                          : RescueUi.caption,
                    ),
                  ],
                ),
              ),
          ],
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Photos + dates
// ---------------------------------------------------------------------------

String formatRescueDate(DateTime date) {
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  final d = date.toLocal();
  final hour = d.hour % 12 == 0 ? 12 : d.hour % 12;
  final minute = d.minute.toString().padLeft(2, '0');
  final ampm = d.hour >= 12 ? 'PM' : 'AM';
  return '${months[d.month - 1]} ${d.day}, ${d.year}  -  $hour:$minute $ampm';
}

Widget rescueThumb(String url, {double size = 64, VoidCallback? onTap}) {
  return GestureDetector(
    onTap: onTap,
    child: ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: Image.network(
        url,
        width: size,
        height: size,
        fit: BoxFit.cover,
        errorBuilder: (_, __, ___) => Container(
          width: size,
          height: size,
          color: const Color(0xFFEEF1F6),
          child: const Icon(Icons.broken_image_outlined, color: RescueUi.inkMuted),
        ),
      ),
    ),
  );
}

void showRescueImage(BuildContext context, String url) {
  showDialog<void>(
    context: context,
    builder: (ctx) => GestureDetector(
      onTap: () => Navigator.of(ctx).pop(),
      child: Dialog(
        backgroundColor: Colors.black,
        insetPadding: const EdgeInsets.all(RescueUi.s8),
        child: InteractiveViewer(
          child: Image.network(
            url,
            fit: BoxFit.contain,
            errorBuilder: (_, __, ___) => const Padding(
              padding: EdgeInsets.all(40),
              child: Icon(Icons.broken_image_outlined, color: Colors.white54, size: 48),
            ),
          ),
        ),
      ),
    ),
  );
}

// ---------------------------------------------------------------------------
// Peak moment: the rescue-completed celebration
// ---------------------------------------------------------------------------

Future<void> showRescueSuccess(BuildContext context, {required int people}) {
  final message = people <= 0
      ? 'Your rescue report has been saved.'
      : people == 1
          ? '1 person brought to safety.'
          : '$people people brought to safety.';

  return showDialog<void>(
    context: context,
    barrierDismissible: false,
    builder: (ctx) => Dialog(
      backgroundColor: Colors.white,
      insetPadding: const EdgeInsets.all(RescueUi.s24),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      child: Padding(
        padding: const EdgeInsets.all(RescueUi.s24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TweenAnimationBuilder<double>(
              tween: Tween(begin: 0.5, end: 1),
              duration: const Duration(milliseconds: 700),
              curve: Curves.elasticOut,
              builder: (context, scale, child) =>
                  Transform.scale(scale: scale, child: child),
              child: Container(
                width: 96,
                height: 96,
                decoration: BoxDecoration(
                  color: RescueUi.successSoft,
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: RescueUi.success.withValues(alpha: 0.25),
                      blurRadius: 32,
                      spreadRadius: 4,
                    ),
                  ],
                ),
                child: const Icon(Icons.check_rounded, size: 56, color: RescueUi.success),
              ),
            ),
            const SizedBox(height: RescueUi.s24),
            const Text('Rescue completed', style: RescueUi.title),
            const SizedBox(height: RescueUi.s8),
            Text(message, style: RescueUi.body, textAlign: TextAlign.center),
            const SizedBox(height: RescueUi.s4),
            const Text('Thank you for your service.', style: RescueUi.caption),
            const SizedBox(height: RescueUi.s24),
            FilledButton(
              style: RescueUi.primaryButton(color: RescueUi.success),
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text('Back to jobs'),
            ),
          ],
        ),
      ),
    ),
  );
}
