import 'dart:io';

import 'package:flutter/material.dart';

/// Heading above a group of profile rows or form fields.
class ProfileSectionHeader extends StatelessWidget {
  const ProfileSectionHeader(this.text, {super.key});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Text(
        text,
        style: Theme.of(context).textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w700,
            ),
      ),
    );
  }
}

/// A label and its value on one line; stacked on very narrow screens.
/// Empty values show a dash.
class ProfileInfoRow extends StatelessWidget {
  const ProfileInfoRow(this.label, this.value, {super.key});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final empty = value.trim().isEmpty;

    final labelWidget = Text(
      label,
      style: TextStyle(fontSize: 13, color: scheme.onSurfaceVariant),
    );
    final valueWidget = Text(
      empty ? '—' : value,
      style: TextStyle(
        fontSize: 14,
        fontWeight: FontWeight.w600,
        color: empty ? scheme.outline : scheme.onSurface,
      ),
    );

    return LayoutBuilder(
      builder: (context, constraints) {
        final stacked = constraints.maxWidth < 340;
        final content = stacked
            ? Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [labelWidget, const SizedBox(height: 2), valueWidget],
              )
            : Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(width: 132, child: labelWidget),
                  Expanded(child: valueWidget),
                ],
              );
        return Padding(
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: SizedBox(width: double.infinity, child: content),
        );
      },
    );
  }
}

/// Round profile photo that falls back to the person's initials.
///
/// [localPath] (a photo just picked, not yet saved) wins over [photoUrl]
/// (the saved photo).
class ProfileAvatar extends StatelessWidget {
  const ProfileAvatar({
    super.key,
    required this.initials,
    this.photoUrl,
    this.localPath,
    this.size = 54,
  });

  final String initials;
  final String? photoUrl;
  final String? localPath;
  final double size;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;

    final initialsBlock = Center(
      child: Text(
        initials.isEmpty ? '?' : initials,
        style: TextStyle(
          color: scheme.onPrimary,
          fontSize: size * 0.33,
          fontWeight: FontWeight.w700,
        ),
      ),
    );

    Widget child;
    final url = photoUrl?.trim() ?? '';
    if (localPath != null) {
      child = Image.file(
        File(localPath!),
        width: size,
        height: size,
        fit: BoxFit.cover,
        errorBuilder: (_, __, ___) => initialsBlock,
      );
    } else if (url.isNotEmpty) {
      child = Image.network(
        url,
        width: size,
        height: size,
        fit: BoxFit.cover,
        errorBuilder: (_, __, ___) => initialsBlock,
      );
    } else {
      child = initialsBlock;
    }

    return ClipOval(
      child: SizedBox(
        width: size,
        height: size,
        child: ColoredBox(color: scheme.primary, child: child),
      ),
    );
  }
}
