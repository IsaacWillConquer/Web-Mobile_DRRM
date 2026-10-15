import 'package:flutter/material.dart';

import '../models/map_overlay.dart';

const Color _navy = Color(0xFF1F2937);
const Color _red = Color(0xFFE53935);

class MapLayersSheet extends StatefulWidget {
  const MapLayersSheet({super.key, required this.active});

  final MapOverlay active;

  @override
  State<MapLayersSheet> createState() => _MapLayersSheetState();
}

class _MapLayersSheetState extends State<MapLayersSheet> {
  int _tab = 1;
  late MapOverlay _active = widget.active;

  void _select(MapOverlay overlay) {
    setState(() => _active = _active == overlay ? MapOverlay.none : overlay);
    Navigator.of(context).pop(_active);
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 4, 8, 0),
            child: Row(
              children: [
                const Text(
                  'Map Layers',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: _navy),
                ),
                const Spacer(),
                IconButton(
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.close),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Container(
              decoration: BoxDecoration(
                color: const Color(0xFFF3F4F6),
                borderRadius: BorderRadius.circular(12),
              ),
              padding: const EdgeInsets.all(4),
              child: Row(
                children: [
                  _tabButton('Hazards', 0),
                  _tabButton('Map layers', 1),
                ],
              ),
            ),
          ),
          const SizedBox(height: 8),
          Flexible(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
              child: _tab == 0 ? const _HazardsTab() : _MapLayersTab(active: _active, onSelect: _select),
            ),
          ),
        ],
      ),
    );
  }

  Widget _tabButton(String label, int index) {
    final selected = _tab == index;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _tab = index),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: selected ? Colors.white : Colors.transparent,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontWeight: selected ? FontWeight.bold : FontWeight.w500,
              color: selected ? _navy : const Color(0xFF6B7280),
            ),
          ),
        ),
      ),
    );
  }
}

class _MapLayersTab extends StatelessWidget {
  const _MapLayersTab({required this.active, required this.onSelect});

  final MapOverlay active;
  final ValueChanged<MapOverlay> onSelect;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Only one map overlay at a time — turning one on turns the others off.',
          style: TextStyle(fontSize: 12.5, color: Color(0xFF6B7280)),
        ),
        const SizedBox(height: 12),
        _layerTile(
          icon: Icons.cyclone,
          iconColor: _red,
          title: 'Typhoons',
          subtitle: 'Active typhoon track and forecast (JMA).',
          overlay: MapOverlay.typhoons,
        ),
        _layerTile(
          icon: Icons.warning_amber_rounded,
          iconColor: const Color(0xFFF59E0B),
          title: 'Storm Signals',
          subtitle: 'PAGASA TCWS wind signal per province.',
          overlay: MapOverlay.stormSignals,
        ),
        _layerTile(
          icon: Icons.water_drop_outlined,
          iconColor: const Color(0xFF3B82F6),
          title: 'Rain Forecast',
          subtitle: 'Weekly rainfall forecast per region (Open-Meteo).',
          overlay: MapOverlay.rainForecast,
        ),
      ],
    );
  }

  Widget _layerTile({
    required IconData icon,
    required Color iconColor,
    required String title,
    required String subtitle,
    required MapOverlay overlay,
  }) {
    final on = active == overlay;
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: SwitchListTile.adaptive(
        value: on,
        activeThumbColor: _red,
        onChanged: (_) => onSelect(overlay),
        secondary: CircleAvatar(
          backgroundColor: iconColor.withValues(alpha: 0.12),
          child: Icon(icon, color: iconColor, size: 20),
        ),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.bold, color: _navy)),
        subtitle: Text(subtitle, style: const TextStyle(fontSize: 12.5)),
      ),
    );
  }
}

class _HazardsTab extends StatelessWidget {
  const _HazardsTab();

  static const _items = <({String title, String desc, String size})>[
    (
      title: 'Flood Risk (5-Year Return Period)',
      desc: 'Areas likely flooded roughly once every 5 years.',
      size: '~486 MB · stream',
    ),
    (
      title: 'Flood Risk (25-Year Return Period)',
      desc: 'Areas likely flooded once every 25 years.',
      size: '~563 MB · stream',
    ),
    (
      title: 'Flood Risk (100-Year Return Period)',
      desc: 'Areas likely flooded once every 100 years.',
      size: '~969 MB · stream',
    ),
    (
      title: 'Landslide Susceptibility',
      desc: 'Areas prone to landslides during heavy rain.',
      size: '~2713 MB · stream',
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: const Color(0xFFF3F4F6),
            borderRadius: BorderRadius.circular(12),
          ),
          child: const Row(
            children: [
              Icon(Icons.schedule, size: 18, color: Color(0xFF6B7280)),
              SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Hazard overlays are coming soon. No data is bundled yet.',
                  style: TextStyle(fontSize: 13, color: Color(0xFF6B7280)),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        for (final item in _items) _hazardTile(item),
      ],
    );
  }

  Widget _hazardTile(({String title, String desc, String size}) item) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Row(
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: const Color(0xFFF3F4F6),
              borderRadius: BorderRadius.circular(8),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        item.title,
                        style: const TextStyle(fontWeight: FontWeight.bold, color: _navy),
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF3F4F6),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: const Text(
                        'Coming soon',
                        style: TextStyle(fontSize: 11, color: Color(0xFF6B7280)),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(item.desc, style: const TextStyle(fontSize: 12.5, color: Color(0xFF6B7280))),
                const SizedBox(height: 4),
                Text(item.size, style: const TextStyle(fontSize: 12, color: Color(0xFF9CA3AF))),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
