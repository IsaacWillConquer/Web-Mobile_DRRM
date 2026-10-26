import 'package:flutter/material.dart';

import '../config/app_config.dart';

/// Full Terms of Use & Privacy, reachable from the login screen.
class TermsScreen extends StatelessWidget {
  const TermsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final accent = Theme.of(context).colorScheme.primary;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Terms of Use & Privacy'),
        backgroundColor: Theme.of(context).scaffoldBackgroundColor,
        surfaceTintColor: Colors.transparent,
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
          children: [
            Text(
              AppConfig.appTagline,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Colors.black54,
                  ),
            ),
            const SizedBox(height: 20),
            for (final section in AppConfig.termsOfUse) ...[
              Text(
                section.title,
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
              ),
              const SizedBox(height: 4),
              Text(
                section.body,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: Colors.black87,
                      height: 1.45,
                    ),
              ),
              const SizedBox(height: 20),
            ],
            const Divider(height: 32),
            Text(
              '${AppConfig.developerCredit} · ${AppConfig.creditsLine}',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: accent.withValues(alpha: 0.8),
                  ),
            ),
          ],
        ),
      ),
    );
  }
}
