import 'package:flutter/material.dart';

import '../widgets/bottom_nav_bar.dart';
import 'map_tab.dart';
import 'profile_tab.dart';
import 'report_screen.dart';

class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;

  void _openReport() {
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => const ReportScreen()),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _index,
        children: const [MapTab(), ProfileTab()],
      ),
      floatingActionButton: _ReportButton(onTap: _openReport),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerDocked,
      bottomNavigationBar: AppBottomBar(
        currentIndex: _index,
        onTabSelected: (index) => setState(() => _index = index),
      ),
    );
  }
}

class _ReportButton extends StatelessWidget {
  const _ReportButton({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 64,
      height: 64,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: Colors.white,
        border: Border.all(color: Colors.white, width: 4),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFFE53935).withValues(alpha: 0.45),
            blurRadius: 20,
            spreadRadius: 1,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Material(
        color: const Color(0xFFE53935),
        shape: const CircleBorder(),
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: onTap,
          child: const Icon(Icons.campaign, color: Colors.white, size: 30),
        ),
      ),
    );
  }
}
