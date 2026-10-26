import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import '../core/auth_service.dart';
import '../core/profile_validators.dart';
import '../core/report_service.dart';
import '../models/report.dart';
import '../widgets/profile_widgets.dart';
import 'edit_profile_screen.dart';

class ProfileTab extends StatefulWidget {
  const ProfileTab({super.key});

  @override
  State<ProfileTab> createState() => _ProfileTabState();
}

class _ProfileTabState extends State<ProfileTab> {
  late final Stream<AppUserProfile?> _profile;
  late final Stream<List<Report>> _reports;

  @override
  void initState() {
    super.initState();
    final uid = FirebaseAuth.instance.currentUser?.uid;
    _profile = uid == null
        ? Stream.value(null)
        : AuthService.instance.watchProfile(uid);
    _reports = ReportService.instance.myReports();
  }

  /// The profile is a live stream, so there is nothing to reload; pulling
  /// down just does a quick server read to confirm the connection.
  Future<void> _refresh() async {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid == null) return;
    try {
      await AuthService.instance.getProfile(uid);
    } catch (_) {}
  }

  Future<void> _edit(AppUserProfile profile) async {
    final saved = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => EditProfileScreen(current: profile)),
    );
    if (saved != true || !mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        const SnackBar(
          content: Text('Profile updated.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 8, 0),
            child: Row(
              children: [
                const Text(
                  'Profile',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                ),
                const Spacer(),
                IconButton(
                  tooltip: 'Sign out',
                  onPressed: () => AuthService.instance.logout(),
                  icon: const Icon(Icons.logout),
                ),
              ],
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: _refresh,
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(16),
                children: [
                  StreamBuilder<AppUserProfile?>(
                    stream: _profile,
                    builder: (context, snap) {
                      if (snap.connectionState == ConnectionState.waiting &&
                          !snap.hasData &&
                          !snap.hasError) {
                        return const Padding(
                          padding: EdgeInsets.symmetric(vertical: 32),
                          child: Center(child: CircularProgressIndicator()),
                        );
                      }
                      return _ProfileDetails(
                        profile: snap.data,
                        onEdit: _edit,
                      );
                    },
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'My Reports',
                    style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
                  ),
                  const SizedBox(height: 8),
                  StreamBuilder<List<Report>>(
                    stream: _reports,
                    builder: (context, snapshot) {
                      if (snapshot.connectionState == ConnectionState.waiting) {
                        return const Padding(
                          padding: EdgeInsets.symmetric(vertical: 24),
                          child: Center(child: CircularProgressIndicator()),
                        );
                      }
                      if (snapshot.hasError) {
                        return Text(
                          'Could not load reports: ${snapshot.error}',
                          style: const TextStyle(color: Colors.red, fontSize: 13),
                        );
                      }
                      final reports = snapshot.data ?? const <Report>[];
                      if (reports.isEmpty) {
                        return const Padding(
                          padding: EdgeInsets.symmetric(vertical: 24),
                          child: Text(
                            'No reports yet. Tap the Report button to send one.',
                            style: TextStyle(color: Colors.black54),
                          ),
                        );
                      }
                      return Column(
                        children: [
                          for (final report in reports)
                            _ReportCard(report: report),
                        ],
                      );
                    },
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// The signed-in resident's details, with the Edit profile button.
class _ProfileDetails extends StatelessWidget {
  const _ProfileDetails({required this.profile, required this.onEdit});

  final AppUserProfile? profile;
  final Future<void> Function(AppUserProfile profile) onEdit;

  String _initials(AppUserProfile p) {
    final source = p.firstName.isNotEmpty || p.lastName.isNotEmpty
        ? '${p.firstName.isEmpty ? '' : p.firstName[0]}'
            '${p.lastName.isEmpty ? '' : p.lastName[0]}'
        : (p.name.isEmpty ? '' : p.name[0]);
    return source.toUpperCase();
  }

  String _text(Map<String, dynamic> map, String key) =>
      (map[key] ?? '') as String;

  @override
  Widget build(BuildContext context) {
    final p = profile;
    if (p == null) {
      return const Card(
        child: ListTile(
          leading: CircleAvatar(child: Icon(Icons.person)),
          title: Text('Resident'),
          subtitle: Text('Role: resident'),
        ),
      );
    }

    final age = ageFromBirthdate(p.birthdate);
    final disability = p.disability.join(', ');
    final scheme = Theme.of(context).colorScheme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Row(
              children: [
                ProfileAvatar(
                  initials: _initials(p),
                  photoUrl: p.photoUrl,
                  size: 54,
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        p.name.isNotEmpty ? p.name : (p.phone.isNotEmpty ? p.phone : 'Resident'),
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Role: ${p.role ?? 'resident'}',
                        style: TextStyle(
                          fontSize: 13,
                          color: scheme.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        FilledButton.icon(
          onPressed: () => onEdit(p),
          icon: const Icon(Icons.edit_outlined, size: 18),
          label: const Text('Edit profile'),
        ),
        const SizedBox(height: 20),

        const ProfileSectionHeader('Personal'),
        Card(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            child: Column(
              children: [
                ProfileInfoRow('First name', p.firstName),
                ProfileInfoRow('Middle name', p.middleName),
                ProfileInfoRow('Last name', p.lastName),
                ProfileInfoRow('Suffix', p.suffix),
                ProfileInfoRow(
                  'Birthdate',
                  p.birthdate == null ? '' : formatDisplayDate(p.birthdate!),
                ),
                ProfileInfoRow('Age', age == null ? '' : '$age'),
                ProfileInfoRow('Disability', disability),
              ],
            ),
          ),
        ),

        const SizedBox(height: 20),
        const ProfileSectionHeader('Contact'),
        Card(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            child: Column(
              children: [
                ProfileInfoRow('Mobile number', p.phone),
                ProfileInfoRow('Email', p.email),
              ],
            ),
          ),
        ),

        const SizedBox(height: 20),
        const ProfileSectionHeader('Home'),
        Card(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            child: Column(
              children: [
                ProfileInfoRow('City / Municipality', _text(p.address, 'city')),
                ProfileInfoRow('Barangay', _text(p.address, 'barangay')),
                ProfileInfoRow('Street', _text(p.address, 'street')),
                ProfileInfoRow('Address', _text(p.address, 'line')),
              ],
            ),
          ),
        ),

        const SizedBox(height: 20),
        const ProfileSectionHeader('Household'),
        Card(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            child: Column(
              children: [
                ProfileInfoRow('House floor', _text(p.household, 'houseFloor')),
                ProfileInfoRow('Pets', _text(p.household, 'pets')),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _ReportCard extends StatelessWidget {
  const _ReportCard({required this.report});

  final Report report;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        leading: report.imageUrls.isNotEmpty
            ? ClipRRect(
                borderRadius: BorderRadius.circular(6),
                child: Image.network(
                  report.imageUrls.first,
                  width: 48,
                  height: 48,
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) =>
                      const Icon(Icons.broken_image, size: 32),
                ),
              )
            : const CircleAvatar(child: Icon(Icons.warning_amber)),
        title: Text(report.disasterType),
        subtitle: Text('${report.status} · ${_formatDate(report.createdAt)}'),
        trailing: _StatusChip(status: report.status),
        isThreeLine: report.description.isNotEmpty,
      ),
    );
  }

  static String _formatDate(DateTime? date) {
    if (date == null) return 'just now';
    final local = date.toLocal();
    final d = local.toIso8601String().split('T');
    return '${d[0]} ${d[1].substring(0, 5)}';
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final color = switch (status) {
      'Resolved' || 'Closed' => Colors.green,
      'Rejected' || 'Cancelled' || 'Duplicate' => Colors.red,
      'Under Verification' || 'Verified' || 'Awaiting Assignment' => Colors.orange,
      _ => Colors.blueGrey,
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        status,
        style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w600),
      ),
    );
  }
}
