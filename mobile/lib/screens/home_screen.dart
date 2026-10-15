import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import '../config/app_config.dart';
import '../core/auth_service.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  late Future<AppUserProfile?> _profile;

  @override
  void initState() {
    super.initState();
    final uid = FirebaseAuth.instance.currentUser?.uid;
    _profile = uid == null ? Future.value(null) : AuthService.instance.getProfile(uid);
  }

  @override
  Widget build(BuildContext context) {
    final user = FirebaseAuth.instance.currentUser;

    return Scaffold(
      appBar: AppBar(
        title: const Text(AppConfig.appName),
        actions: [
          IconButton(
            tooltip: 'Sign out',
            onPressed: () => AuthService.instance.logout(),
            icon: const Icon(Icons.logout),
          ),
        ],
      ),
      body: FutureBuilder<AppUserProfile?>(
        future: _profile,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          final profile = snapshot.data;
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Card(
                child: ListTile(
                  title: Text(profile?.name.isNotEmpty == true
                      ? profile!.name
                      : (user?.email ?? 'Resident')),
                  subtitle: Text('Role: ${profile?.role ?? 'not set'}'),
                ),
              ),
              const SizedBox(height: 16),
              const Text('P1 scaffold — reporting, map, and tracking land in P4.'),
            ],
          );
        },
      ),
    );
  }
}
