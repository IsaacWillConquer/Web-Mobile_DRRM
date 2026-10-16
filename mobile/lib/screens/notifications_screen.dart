import 'package:flutter/material.dart';

import '../core/notification_service.dart';
import '../models/app_notification.dart';

class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          StreamBuilder<List<AppNotification>>(
            stream: NotificationService.instance.watchMine(),
            builder: (context, snapshot) {
              final unread =
                  (snapshot.data ?? const []).where((n) => !n.read).toList();
              if (unread.isEmpty) return const SizedBox.shrink();
              return TextButton(
                onPressed: () =>
                    NotificationService.instance.markAllRead(unread),
                child: const Text('Mark all read'),
              );
            },
          ),
        ],
      ),
      body: StreamBuilder<List<AppNotification>>(
        stream: NotificationService.instance.watchMine(),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text(
                  'Could not load notifications: ${snapshot.error}',
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Colors.red),
                ),
              ),
            );
          }
          final items = snapshot.data ?? const [];
          if (items.isEmpty) {
            return const Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.notifications_off_outlined,
                      size: 48, color: Colors.black26),
                  SizedBox(height: 12),
                  Text(
                    'No notifications yet.\nStatus updates about your reports will appear here.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.black54),
                  ),
                ],
              ),
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.all(12),
            itemCount: items.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (context, i) => _NotificationTile(
              notification: items[i],
              onTap: items[i].read
                  ? null
                  : () => NotificationService.instance.markRead(items[i].id),
            ),
          );
        },
      ),
    );
  }
}

class _NotificationTile extends StatelessWidget {
  const _NotificationTile({required this.notification, this.onTap});

  final AppNotification notification;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final unread = !notification.read;
    final accent = notification.type == 'new_report'
        ? const Color(0xFFE53935)
        : const Color(0xFF1D4ED8);
    return Card(
      margin: EdgeInsets.zero,
      child: ListTile(
        onTap: onTap,
        leading: CircleAvatar(
          backgroundColor: accent.withValues(alpha: unread ? 0.15 : 0.08),
          child: Icon(
            notification.type == 'new_report'
                ? Icons.campaign
                : Icons.notifications_outlined,
            color: unread ? accent : Colors.black38,
          ),
        ),
        title: Text(
          notification.title,
          style: TextStyle(
            fontWeight: unread ? FontWeight.bold : FontWeight.w500,
            color: unread ? Colors.black87 : Colors.black54,
          ),
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (notification.body.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 2),
                child: Text(
                  notification.body,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                      color: unread ? Colors.black54 : Colors.black38),
                ),
              ),
            const SizedBox(height: 4),
            Text(
              _relativeTime(notification.createdAt),
              style: const TextStyle(fontSize: 11, color: Colors.black38),
            ),
          ],
        ),
        trailing: unread
            ? Container(
                width: 10,
                height: 10,
                decoration:
                    BoxDecoration(shape: BoxShape.circle, color: accent),
              )
            : null,
      ),
    );
  }

  static String _relativeTime(DateTime? date) {
    if (date == null) return '';
    final diff = DateTime.now().difference(date.toLocal());
    if (diff.inMinutes < 1) return 'just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    if (diff.inDays < 7) return '${diff.inDays}d ago';
    final d = date.toLocal().toIso8601String().split('T');
    return d[0];
  }
}
