import 'package:drrm_mobile/models/typhoon.dart';
import 'package:drrm_mobile/widgets/typhoon_alert_card.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

Typhoon _typhoon() => Typhoon.fromMap('b1', {
      'typhoonName': 'Kiko',
      'category': 'Typhoon',
      'source': 'PAGASA',
      'postedAt': '2026-10-15T05:00:00+08:00',
      'active': true,
      'signals': [
        {
          'level': 3,
          'areas': ['NCR'],
        },
      ],
    });

Widget _wrap(Widget child) => MaterialApp(home: Scaffold(body: child));

void main() {
  testWidgets('collapsed by default: header + badge, no info panel',
      (tester) async {
    await tester.pumpWidget(
      _wrap(
        TyphoonAlertCard(
          typhoon: _typhoon(),
          signal: const StormSignal(level: 3, areas: ['NCR']),
          onDismiss: () {},
        ),
      ),
    );
    await tester.pump();

    expect(find.text('Typhoon Alert'), findsOneWidget);
    expect(find.text('Kiko'), findsWidgets);
    expect(find.text('Signal No. 3'), findsOneWidget);
    expect(find.text('View Details'), findsOneWidget);
    expect(find.text('CATEGORY'), findsNothing);
  });

  testWidgets('View Details expands the info panel, Collapse hides it',
      (tester) async {
    await tester.pumpWidget(
      _wrap(
        TyphoonAlertCard(
          typhoon: _typhoon(),
          signal: const StormSignal(level: 3, areas: ['NCR']),
          onDismiss: () {},
        ),
      ),
    );
    await tester.pump();

    await tester.tap(find.text('View Details'));
    await tester.pump();

    expect(find.text('CATEGORY'), findsOneWidget);
    expect(find.text('SIGNAL'), findsOneWidget);
    expect(find.text('No. 3 (your area)'), findsOneWidget);
    expect(find.text('PAGASA'), findsOneWidget);
    expect(find.text('Collapse'), findsOneWidget);

    await tester.tap(find.text('Collapse'));
    await tester.pump();
    expect(find.text('CATEGORY'), findsNothing);
  });

  testWidgets('no signal hides the badge and the SIGNAL row', (tester) async {
    await tester.pumpWidget(
      _wrap(
        TyphoonAlertCard(
          typhoon: _typhoon(),
          signal: null,
          onDismiss: () {},
        ),
      ),
    );
    await tester.pump();

    expect(find.text('Signal No. 3'), findsNothing);

    await tester.tap(find.text('View Details'));
    await tester.pump();

    expect(find.text('NAME'), findsOneWidget);
    expect(find.text('CATEGORY'), findsOneWidget);
    expect(find.text('SIGNAL'), findsNothing);
    expect(find.text('SOURCE'), findsOneWidget);
    expect(find.text('POSTED'), findsOneWidget);
  });

  testWidgets('close button invokes onDismiss', (tester) async {
    var dismissed = false;
    await tester.pumpWidget(
      _wrap(
        TyphoonAlertCard(
          typhoon: _typhoon(),
          signal: const StormSignal(level: 1, areas: ['Bulacan']),
          onDismiss: () => dismissed = true,
        ),
      ),
    );
    await tester.pump();
    await tester.tap(find.byIcon(Icons.close));
    await tester.pump();
    expect(dismissed, isTrue);
  });
}
