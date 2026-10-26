import 'package:drrm_mobile/widgets/map_legend.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('colorFromHex parses #RRGGBB as an opaque colour', () {
    expect(colorFromHex('#1E88E5'), const Color(0xFF1E88E5));
    expect(colorFromHex('D32F2F'), const Color(0xFFD32F2F));
  });

  testWidgets('MapLegend shows its title and every row', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: MapLegend(
            title: 'Wind signal',
            items: [
              LegendItem(color: Color(0xFF1E88E5), label: 'No. 1 · 39–61 km/h'),
              LegendItem(color: Color(0xFFF9A825), label: 'No. 2 · 62–88 km/h'),
            ],
          ),
        ),
      ),
    );

    expect(find.text('Wind signal'), findsOneWidget);
    expect(find.text('No. 1 · 39–61 km/h'), findsOneWidget);
    expect(find.text('No. 2 · 62–88 km/h'), findsOneWidget);
  });
}
