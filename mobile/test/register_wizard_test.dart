import 'package:drrm_mobile/screens/register_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('step 1 shows account fields and validates empty input',
      (tester) async {
    await tester.pumpWidget(const MaterialApp(home: RegisterScreen()));
    await tester.pump();

    expect(find.textContaining('Step 1 of 3'), findsOneWidget);
    expect(find.text('Email'), findsOneWidget);
    expect(find.text('Password'), findsOneWidget);
    expect(find.text('Confirm password'), findsOneWidget);

    await tester.tap(find.text('Next'));
    await tester.pump();
    expect(
      find.text('Enter a valid 10-digit mobile number (9XXXXXXXXX).'),
      findsOneWidget,
    );
  });

  testWidgets('valid step 1 advances to step 2', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: RegisterScreen()));
    await tester.pump();

    final fields = find.byType(TextField);
    await tester.enterText(fields.at(0), '9171234567');
    await tester.enterText(fields.at(1), 'juan@example.com');
    await tester.enterText(fields.at(2), 'secret1');
    await tester.enterText(fields.at(3), 'secret1');

    await tester.tap(find.text('Next'));
    await tester.pump();

    expect(find.textContaining('Step 2 of 3'), findsOneWidget);
    expect(find.text('First name'), findsOneWidget);
    expect(find.text('Birthdate'), findsOneWidget);
  });

  testWidgets('mismatched passwords are rejected', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: RegisterScreen()));
    await tester.pump();

    final fields = find.byType(TextField);
    await tester.enterText(fields.at(0), '9171234567');
    await tester.enterText(fields.at(1), 'juan@example.com');
    await tester.enterText(fields.at(2), 'secret1');
    await tester.enterText(fields.at(3), 'secret2');

    await tester.tap(find.text('Next'));
    await tester.pump();

    expect(find.text('Passwords do not match.'), findsOneWidget);
    expect(find.textContaining('Step 1 of 3'), findsOneWidget);
  });
}
