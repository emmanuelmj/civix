import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/app_state.dart';
import '../theme/app_theme.dart';
import '../widgets/status_badge.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Civix Pulse'),
        actions: [
          StatusBadge(connected: state.connected),
          const SizedBox(width: 12),
        ],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Greeting
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Row(
                    children: [
                      const CircleAvatar(
                        radius: 28,
                        backgroundColor: AppTheme.primaryLight,
                        child: Icon(Icons.person, size: 30, color: AppTheme.primary),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Welcome, ${state.officerName}',
                              style: const TextStyle(
                                fontSize: 20,
                                fontWeight: FontWeight.bold,
                                color: AppTheme.textPrimary,
                              ),
                            ),
                            Text(
                              'ID: ${state.officerId} • Field Worker',
                              style: const TextStyle(color: AppTheme.textSecondary),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              const SizedBox(height: 12),

              // Quick stats
              Row(
                children: [
                  Expanded(
                    child: _StatCard(
                      icon: Icons.report_problem,
                      label: 'My Reports',
                      value: '${state.myComplaints.length}',
                      color: AppTheme.primary,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _StatCard(
                      icon: Icons.stream,
                      label: 'Live Events',
                      value: '${state.liveFeed.length}',
                      color: AppTheme.success,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _StatCard(
                      icon: Icons.hub,
                      label: 'Swarm Logs',
                      value: '${state.swarmLogs.length}',
                      color: AppTheme.accent,
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 24),

              // Action buttons
              const Text(
                'Quick Actions',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.textPrimary,
                ),
              ),
              const SizedBox(height: 12),

              _ActionTile(
                icon: Icons.add_circle,
                title: 'Report Grievance',
                subtitle: 'Submit a new complaint from the field',
                color: AppTheme.primary,
                onTap: () => Navigator.pushNamed(context, '/submit'),
              ),
              _ActionTile(
                icon: Icons.list_alt,
                title: 'My Complaints',
                subtitle: 'Track status of your submitted reports',
                color: AppTheme.accent,
                onTap: () => Navigator.pushNamed(context, '/my-complaints'),
              ),
              _ActionTile(
                icon: Icons.cell_tower,
                title: 'Live Feed',
                subtitle: 'Real-time events from the swarm',
                color: AppTheme.success,
                onTap: () => Navigator.pushNamed(context, '/live-feed'),
              ),
              _ActionTile(
                icon: Icons.settings,
                title: 'Profile & Settings',
                subtitle: 'Configure your officer profile & backend URL',
                color: AppTheme.textSecondary,
                onTap: () => Navigator.pushNamed(context, '/profile'),
              ),

              const SizedBox(height: 24),

              // Recent activity
              if (state.liveFeed.isNotEmpty) ...[
                const Text(
                  'Recent Activity',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: AppTheme.textPrimary,
                  ),
                ),
                const SizedBox(height: 8),
                ...state.liveFeed.take(3).map((g) => Card(
                      child: ListTile(
                        leading: CircleAvatar(
                          backgroundColor: _statusColor(g.status).withValues(alpha: 0.15),
                          child: Icon(
                            _statusIcon(g.status),
                            color: _statusColor(g.status),
                            size: 20,
                          ),
                        ),
                        title: Text(
                          g.description.isEmpty ? g.domain : g.description,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        subtitle: Text('${g.domain} • ${g.status}'),
                        trailing: Text(
                          _timeAgo(g.timestamp),
                          style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                        ),
                      ),
                    )),
              ],
            ],
          ),
        ),
      ),
    );
  }

  static Color _statusColor(String status) {
    switch (status) {
      case 'DISPATCHED':
        return AppTheme.success;
      case 'ANALYZING':
        return AppTheme.accent;
      case 'NEW':
        return AppTheme.primary;
      default:
        return AppTheme.textSecondary;
    }
  }

  static IconData _statusIcon(String status) {
    switch (status) {
      case 'DISPATCHED':
        return Icons.check_circle;
      case 'ANALYZING':
        return Icons.hourglass_top;
      case 'NEW':
        return Icons.fiber_new;
      default:
        return Icons.info;
    }
  }

  static String _timeAgo(int timestamp) {
    final diff = DateTime.now().millisecondsSinceEpoch - timestamp;
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return '${diff ~/ 60000}m ago';
    if (diff < 86400000) return '${diff ~/ 3600000}h ago';
    return '${diff ~/ 86400000}d ago';
  }
}

class _StatCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color color;

  const _StatCard({
    required this.icon,
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 12),
        child: Column(
          children: [
            Icon(icon, color: color, size: 28),
            const SizedBox(height: 8),
            Text(
              value,
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.bold,
                color: color,
              ),
            ),
            Text(
              label,
              style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

class _ActionTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final Color color;
  final VoidCallback onTap;

  const _ActionTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: color.withValues(alpha: 0.12),
          child: Icon(icon, color: color),
        ),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Text(subtitle, style: const TextStyle(fontSize: 13)),
        trailing: Icon(Icons.chevron_right, color: color),
        onTap: onTap,
      ),
    );
  }
}
