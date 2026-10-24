import 'package:flutter/material.dart';

import '../config/app_config.dart';
import '../models/typhoon.dart';

const Color _navy = Color(0xFF1F2937);
const Color _darkRed = Color(0xFF9B1C1C);
const Color _pinkPill = Color(0xFFFEE2E2);
const Color _lightGray = Color(0xFFF3F4F6);
const Color _panelPink = Color(0xFFFEF2F2);
const Color _divider = Color(0xFFFECACA);
const Color _fallbackAccent = Color(0xFFE53935);

Color signalColor(int? level) {
  switch (level) {
    case 1:
      return const Color(0xFF1E88E5);
    case 2:
      return const Color(0xFFF9A825);
    case 3:
      return const Color(0xFFEF6C00);
    case 4:
      return const Color(0xFFD32F2F);
    case 5:
      return const Color(0xFFC2185B);
    default:
      return _fallbackAccent;
  }
}

class TyphoonAlertCard extends StatefulWidget {
  const TyphoonAlertCard({
    super.key,
    required this.typhoon,
    required this.signal,
    required this.onDismiss,
    this.initiallyExpanded = false,
  });

  final Typhoon typhoon;
  final StormSignal? signal;
  final VoidCallback onDismiss;
  final bool initiallyExpanded;

  @override
  State<TyphoonAlertCard> createState() => _TyphoonAlertCardState();
}

class _TyphoonAlertCardState extends State<TyphoonAlertCard> {
  late bool _expanded = widget.initiallyExpanded;

  void _showSafetyTips(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => const _SafetyTips(),
    );
  }

  @override
  Widget build(BuildContext context) {
    final accent = signalColor(widget.signal?.level);

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.10),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(24),
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(width: 6, color: accent),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _PulsingIcon(color: accent),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'Typhoon Alert',
                                  style: TextStyle(
                                    fontSize: 18,
                                    fontWeight: FontWeight.bold,
                                    color: _navy,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  widget.typhoon.name,
                                  style: const TextStyle(
                                    fontSize: 15,
                                    fontWeight: FontWeight.bold,
                                    color: _darkRed,
                                  ),
                                ),
                                if (widget.typhoon.isSimulation) ...[
                                  const SizedBox(height: 6),
                                  const _SimulationBadge(),
                                ],
                                if (widget.signal != null) ...[
                                  const SizedBox(height: 8),
                                  _SignalBadge(level: widget.signal!.level),
                                ],
                              ],
                            ),
                          ),
                          _CloseButton(onPressed: widget.onDismiss),
                        ],
                      ),
                      const SizedBox(height: 12),
                      if (_expanded) ...[
                        _InfoPanel(
                          typhoon: widget.typhoon,
                          signal: widget.signal,
                        ),
                        const SizedBox(height: 12),
                      ],
                      Row(
                        children: [
                          Expanded(
                            child: _OutlineButton(
                              icon: _expanded
                                  ? Icons.keyboard_arrow_up
                                  : Icons.info_outline,
                              label: _expanded ? 'Collapse' : 'View Details',
                              onPressed: () =>
                                  setState(() => _expanded = !_expanded),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: _SolidButton(
                              icon: Icons.health_and_safety_outlined,
                              label: 'Safety Tips',
                              onPressed: () => _showSafetyTips(context),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PulsingIcon extends StatefulWidget {
  const _PulsingIcon({required this.color});

  final Color color;

  @override
  State<_PulsingIcon> createState() => _PulsingIconState();
}

class _PulsingIconState extends State<_PulsingIcon>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1400),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 56,
      height: 56,
      child: AnimatedBuilder(
        animation: _controller,
        builder: (context, child) {
          final t = Curves.easeInOut.transform(_controller.value);
          return Stack(
            alignment: Alignment.center,
            children: [
              Container(
                width: 44 + t * 12,
                height: 44 + t * 12,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: widget.color.withValues(alpha: 0.25 * (1 - t)),
                ),
              ),
              child!,
            ],
          );
        },
        child: Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: widget.color,
          ),
          child: const Icon(Icons.thunderstorm, color: Colors.white, size: 24),
        ),
      ),
    );
  }
}

class _SignalBadge extends StatelessWidget {
  const _SignalBadge({required this.level});

  final int level;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: _pinkPill,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 8,
            height: 8,
            decoration: const BoxDecoration(
              shape: BoxShape.circle,
              color: _fallbackAccent,
            ),
          ),
          const SizedBox(width: 6),
          Text(
            'Signal No. $level',
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.bold,
              color: _darkRed,
            ),
          ),
        ],
      ),
    );
  }
}

class _CloseButton extends StatelessWidget {
  const _CloseButton({required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: _lightGray,
      shape: const CircleBorder(),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onPressed,
        child: const SizedBox(
          width: 36,
          height: 36,
          child: Icon(Icons.close, size: 20, color: _navy),
        ),
      ),
    );
  }
}

class _OutlineButton extends StatelessWidget {
  const _OutlineButton({
    required this.icon,
    required this.label,
    required this.onPressed,
  });

  final IconData icon;
  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 48,
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        child: InkWell(
          borderRadius: BorderRadius.circular(24),
          onTap: onPressed,
          child: Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: const Color(0xFFD1D5DB)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(icon, size: 20, color: _navy),
                const SizedBox(width: 8),
                Text(
                  label,
                  style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    color: _navy,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _SolidButton extends StatelessWidget {
  const _SolidButton({
    required this.icon,
    required this.label,
    required this.onPressed,
  });

  final IconData icon;
  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 48,
      child: Material(
        color: _fallbackAccent,
        borderRadius: BorderRadius.circular(24),
        child: InkWell(
          borderRadius: BorderRadius.circular(24),
          onTap: onPressed,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 20, color: Colors.white),
              const SizedBox(width: 8),
              Text(
                label,
                style: const TextStyle(
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SafetyTips extends StatelessWidget {
  const _SafetyTips();

  static const _tips = [
    'Stay indoors, away from windows and loose objects.',
    'Avoid floodwaters, downed power lines, and damaged structures.',
    'Prepare a go-bag: water, food, medicines, flashlight, radio, IDs.',
    'Follow official evacuation orders from your barangay / LGU.',
    'Keep your phone charged and monitor PAGASA / LDRRMO updates.',
  ];

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Typhoon Safety Tips',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: _navy,
              ),
            ),
            const SizedBox(height: 16),
            for (final tip in _tips)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.circle, size: 8, color: _fallbackAccent),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        tip,
                        style: const TextStyle(fontSize: 14, color: _navy),
                      ),
                    ),
                  ],
                ),
              ),
            const SizedBox(height: 8),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: _pinkPill,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                'Emergency hotline: ${AppConfig.ldrrmoHotline}',
                style: const TextStyle(
                  fontWeight: FontWeight.bold,
                  color: _darkRed,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _InfoPanel extends StatelessWidget {
  const _InfoPanel({required this.typhoon, required this.signal});

  final Typhoon typhoon;
  final StormSignal? signal;

  @override
  Widget build(BuildContext context) {
    final rows = <_InfoRowData>[
      _InfoRowData(Icons.warning_amber_rounded, 'Name', typhoon.name),
      _InfoRowData(Icons.local_offer_outlined, 'Category', typhoon.category),
      if (typhoon.maxWindsKph != null)
        _InfoRowData(Icons.air, 'Winds', _formatWinds(typhoon)),
      if (signal != null)
        _InfoRowData(
          Icons.speed,
          'Signal',
          'No. ${signal!.level} (your area)',
        ),
      _InfoRowData(Icons.info_outline, 'Source', typhoon.source),
      _InfoRowData(Icons.schedule, 'Posted', _formatPosted(typhoon.postedAt)),
    ];

    return Container(
      decoration: BoxDecoration(
        color: _panelPink,
        borderRadius: BorderRadius.circular(20),
      ),
      padding: const EdgeInsets.all(12),
      child: Column(
        children: [
          for (var i = 0; i < rows.length; i++) ...[
            _InfoRow(data: rows[i]),
            if (i != rows.length - 1)
              const Divider(height: 1, thickness: 1, color: _divider),
          ],
        ],
      ),
    );
  }
}

String _formatWinds(Typhoon typhoon) {
  final gust = typhoon.gustKph;
  final winds = '${typhoon.maxWindsKph} km/h';
  return gust == null ? winds : '$winds · gusts $gust';
}

class _SimulationBadge extends StatelessWidget {
  const _SimulationBadge();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: const Color(0xFFFEF3C7),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFFF59E0B)),
      ),
      child: const Text(
        'SIMULATION',
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.bold,
          letterSpacing: 0.5,
          color: Color(0xFF92400E),
        ),
      ),
    );
  }
}

class _InfoRowData {
  const _InfoRowData(this.icon, this.label, this.value);

  final IconData icon;
  final String label;
  final String value;
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.data});

  final _InfoRowData data;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: const BoxDecoration(
              shape: BoxShape.circle,
              color: Colors.white,
            ),
            child: Icon(data.icon, size: 18, color: _fallbackAccent),
          ),
          const SizedBox(width: 12),
          SizedBox(
            width: 90,
            child: Text(
              data.label.toUpperCase(),
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.bold,
                letterSpacing: 0.5,
                color: _darkRed,
              ),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              data.value,
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: _navy,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

String _formatPosted(DateTime date) {
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  final local = date.toLocal();
  final hour12 = local.hour % 12 == 0 ? 12 : local.hour % 12;
  final ampm = local.hour < 12 ? 'AM' : 'PM';
  final minute = local.minute.toString().padLeft(2, '0');
  return '${months[local.month - 1]} ${local.day}, ${local.year} · '
      '$hour12:$minute $ampm';
}
