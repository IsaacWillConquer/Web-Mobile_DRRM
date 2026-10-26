import 'package:flutter/material.dart';

/// Parses `#RRGGBB` into an opaque [Color].
Color colorFromHex(String hex) {
  final digits = hex.replaceFirst('#', '');
  return Color(0xFF000000 | int.parse(digits, radix: 16));
}

class LegendItem {
  const LegendItem({required this.color, required this.label});

  final Color color;
  final String label;
}

/// Small card explaining the colours of the active map layer.
class MapLegend extends StatelessWidget {
  const MapLegend({super.key, required this.title, required this.items});

  final String title;
  final List<LegendItem> items;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      elevation: 3,
      shadowColor: Colors.black26,
      borderRadius: BorderRadius.circular(14),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.bold,
                color: Color(0xFF1F2937),
              ),
            ),
            for (final item in items)
              Padding(
                padding: const EdgeInsets.only(top: 5),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 12,
                      height: 12,
                      decoration: BoxDecoration(
                        color: item.color,
                        borderRadius: BorderRadius.circular(3),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      item.label,
                      style: const TextStyle(
                        fontSize: 11,
                        color: Color(0xFF374151),
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}
