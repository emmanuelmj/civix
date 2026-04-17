import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/app_state.dart';
import '../theme/app_theme.dart';

class LiveFeedScreen extends StatelessWidget {
  const LiveFeedScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();

    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Live Feed'),
          actions: [
            // Demo burst button
            IconButton(
              icon: const Icon(Icons.bolt),
              tooltip: 'Trigger Demo Burst',
              onPressed: () async {
                final count = await state.triggerDemoBurst(count: 5);
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('⚡ Demo burst: $count events fired'),
                      backgroundColor: AppTheme.accent,
                    ),
                  );
                }
              },
            ),
          ],
          bottom: const TabBar(
            indicatorColor: Colors.white,
            labelColor: Colors.white,
            unselectedLabelColor: Colors.white70,
            tabs: [
              Tab(icon: Icon(Icons.cell_tower), text: 'Events'),
              Tab(icon: Icon(Icons.hub), text: 'Swarm Log'),
            ],
          ),
        ),
        body: TabBarView(
          children: [
            // Events tab
            _EventsList(events: state.liveFeed),
            // Swarm logs tab
            _SwarmLogList(logs: state.swarmLogs),
          ],
        ),
      ),
    );
  }
}

class _EventsList extends StatelessWidget {
  final List events;
  const _EventsList({required this.events});

  @override
  Widget build(BuildContext context) {
    if (events.isEmpty) {
      return const Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.cell_tower, size: 64, color: Colors.grey),
            SizedBox(height: 12),
            Text('No events yet', style: TextStyle(color: AppTheme.textSecondary)),
            SizedBox(height: 4),
            Text(
              'Tap ⚡ to fire a demo burst',
              style: TextStyle(fontSize: 12, color: AppTheme.textSecondary),
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.symmetric(vertical: 8),
      itemCount: events.length,
      itemBuilder: (context, i) {
        final g = events[i];
        return Card(
          child: ListTile(
            leading: CircleAvatar(
              backgroundColor: _domainColor(g.domain).withValues(alpha: 0.12),
              child: Icon(_domainIcon(g.domain), color: _domainColor(g.domain), size: 20),
            ),
            title: Text(
              g.description.isEmpty ? g.domain : g.description,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 14),
            ),
            subtitle: Row(
              children: [
                _MiniChip(label: g.domain, color: _domainColor(g.domain)),
                const SizedBox(width: 6),
                _MiniChip(label: g.status, color: _statusColor(g.status)),
              ],
            ),
            trailing: g.assignedOfficer != null
                ? Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.badge, size: 16, color: AppTheme.success),
                      Text(g.assignedOfficer!, style: const TextStyle(fontSize: 10)),
                    ],
                  )
                : null,
            isThreeLine: true,
          ),
        );
      },
    );
  }

  static Color _domainColor(String domain) {
    switch (domain.toUpperCase()) {
      case 'TRAFFIC':
        return Colors.orange;
      case 'WATER':
        return Colors.blue;
      case 'ELECTRICITY':
        return Colors.amber;
      case 'CONSTRUCTION':
        return Colors.brown;
      case 'EMERGENCY':
        return Colors.red;
      default:
        return AppTheme.primary;
    }
  }

  static IconData _domainIcon(String domain) {
    switch (domain.toUpperCase()) {
      case 'TRAFFIC':
        return Icons.traffic;
      case 'WATER':
        return Icons.water_drop;
      case 'ELECTRICITY':
        return Icons.bolt;
      case 'CONSTRUCTION':
        return Icons.construction;
      case 'EMERGENCY':
        return Icons.emergency;
      default:
        return Icons.location_city;
    }
  }

  static Color _statusColor(String status) {
    switch (status) {
      case 'DISPATCHED':
        return AppTheme.success;
      case 'ANALYZING':
        return AppTheme.warning;
      default:
        return AppTheme.primary;
    }
  }
}

class _SwarmLogList extends StatelessWidget {
  final List<Map<String, dynamic>> logs;
  const _SwarmLogList({required this.logs});

  @override
  Widget build(BuildContext context) {
    if (logs.isEmpty) {
      return const Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.hub, size: 64, color: Colors.grey),
            SizedBox(height: 12),
            Text('No swarm activity', style: TextStyle(color: AppTheme.textSecondary)),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.symmetric(vertical: 8),
      itemCount: logs.length,
      itemBuilder: (context, i) {
        final log = logs[i];
        final type = log['type']?.toString() ?? 'system';
        final message = log['message']?.toString() ?? '';

        return Card(
          child: ListTile(
            leading: CircleAvatar(
              radius: 16,
              backgroundColor: _logColor(type).withValues(alpha: 0.12),
              child: Icon(_logIcon(type), size: 16, color: _logColor(type)),
            ),
            title: Text(
              message,
              style: const TextStyle(fontSize: 13),
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
            ),
            subtitle: Text(
              type.toUpperCase(),
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.bold,
                color: _logColor(type),
              ),
            ),
          ),
        );
      },
    );
  }

  static Color _logColor(String type) {
    switch (type) {
      case 'analysis':
        return Colors.purple;
      case 'dispatch':
        return AppTheme.success;
      case 'escalation':
        return AppTheme.danger;
      default:
        return AppTheme.textSecondary;
    }
  }

  static IconData _logIcon(String type) {
    switch (type) {
      case 'analysis':
        return Icons.psychology;
      case 'dispatch':
        return Icons.send;
      case 'escalation':
        return Icons.warning;
      default:
        return Icons.terminal;
    }
  }
}

class _MiniChip extends StatelessWidget {
  final String label;
  final Color color;
  const _MiniChip({required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        label,
        style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: color),
      ),
    );
  }
}
