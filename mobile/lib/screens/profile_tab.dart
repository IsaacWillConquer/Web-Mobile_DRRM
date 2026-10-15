import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import '../core/auth_service.dart';
import '../core/report_service.dart';
import '../models/report.dart';

class ProfileTab extends StatefulWidget {
  const ProfileTab({super.key});

  @override
  State<ProfileTab> createState() => _ProfileTabState();
}

class _ProfileTabState extends State<ProfileTab> {
  late Future<AppUserProfile?> _profile;

  @override
  void initState() {
    super.initState();
    final uid = FirebaseAuth.instance.currentUser?.uid;
    _profile =
        uid == null ? Future.value(null) : AuthService.instance.getProfile(uid);
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
            child: StreamBuilder<List<Report>>(
              stream: ReportService.instance.myReports(),
              builder: (context, snapshot) {
                return ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    FutureBuilder<AppUserProfile?>(
                      future: _profile,
                      builder: (context, snap) {
                        final profile = snap.data;
                        return Card(
                          child: ListTile(
                            leading: const CircleAvatar(child: Icon(Icons.person)),
                            title: Text(profile?.name.isNotEmpty == true
                                ? profile!.name
                                : (profile?.phone ?? 'Resident')),
                            subtitle: Text('Role: ${profile?.role ?? 'resident'}'),
                          ),
                        );
                      },
                    ),
                    const SizedBox(height: 16),
                    const Text(
                      'My Reports',
                      style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
                    ),
                    const SizedBox(height: 8),
                    if (snapshot.connectionState == ConnectionState.waiting)
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 24),
                        child: Center(child: CircularProgressIndicator()),
                      )
                    else if (snapshot.hasError)
                      Text(
                        'Could not load reports: ${snapshot.error}',
                        style: const TextStyle(color: Colors.red, fontSize: 13),
                      )
                    else if ((snapshot.data ?? const []).isEmpty)
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 24),
                        child: Text(
                          'No reports yet. Tap the Report button to send one.',
                          style: TextStyle(color: Colors.black54),
                        ),
                      )
                    else
                      for (final report in snapshot.data!)
                        _ReportCard(report: report),
                  ],
                );
              },
            ),
          ),
        ],
      ),
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
