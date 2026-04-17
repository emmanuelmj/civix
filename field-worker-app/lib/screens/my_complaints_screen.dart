import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/app_state.dart';
import '../theme/app_theme.dart';

class MyComplaintsScreen extends StatelessWidget {
  const MyComplaintsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final complaints = state.myComplaints;

    return Scaffold(
      appBar: AppBar(title: const Text('My Complaints')),
      body: complaints.isEmpty
          ? Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.inbox, size: 64, color: Colors.grey.shade300),
                  const SizedBox(height: 12),
                  const Text(
                    'No complaints yet',
                    style: TextStyle(fontSize: 18, color: AppTheme.textSecondary),
                  ),
                  const SizedBox(height: 8),
                  ElevatedButton.icon(
                    onPressed: () => Navigator.pushNamed(context, '/submit'),
                    icon: const Icon(Icons.add),
                    label: const Text('Report First Grievance'),
                  ),
                ],
              ),
            )
          : ListView.builder(
              padding: const EdgeInsets.symmetric(vertical: 8),
              itemCount: complaints.length,
              itemBuilder: (context, index) {
                final g = complaints[index];
                return Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            _StatusChip(status: g.status),
                            const Spacer(),
                            Text(
                              g.domain,
                              style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: AppTheme.primary,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        Text(
                          g.description,
                          style: const TextStyle(
                            fontSize: 15,
                            color: AppTheme.textPrimary,
                          ),
                        ),
                        const SizedBox(height: 10),
                        Row(
                          children: [
                            Icon(Icons.location_on,
                                size: 14, color: Colors.grey.shade500),
                            const SizedBox(width: 4),
                            Text(
                              '${g.lat.toStringAsFixed(4)}, ${g.lng.toStringAsFixed(4)}',
                              style: TextStyle(
                                  fontSize: 12, color: Colors.grey.shade600),
                            ),
                            const Spacer(),
                            if (g.assignedOfficer != null) ...[
                              const Icon(Icons.badge,
                                  size: 14, color: AppTheme.success),
                              const SizedBox(width: 4),
                              Text(
                                g.assignedOfficer!,
                                style: const TextStyle(
                                  fontSize: 12,
                                  color: AppTheme.success,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ],
                        ),
                        if (g.impactScore != null) ...[
                          const SizedBox(height: 8),
                          LinearProgressIndicator(
                            value: (g.impactScore! / 100).clamp(0.0, 1.0),
                            backgroundColor: Colors.grey.shade200,
                            valueColor: AlwaysStoppedAnimation(
                              g.impactScore! > 70
                                  ? AppTheme.danger
                                  : g.impactScore! > 40
                                      ? AppTheme.warning
                                      : AppTheme.success,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Impact Score: ${g.impactScore}',
                            style: const TextStyle(
                                fontSize: 11, color: AppTheme.textSecondary),
                          ),
                        ],
                      ],
                    ),
                  ),
                );
              },
            ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => Navigator.pushNamed(context, '/submit'),
        backgroundColor: AppTheme.primary,
        child: const Icon(Icons.add, color: Colors.white),
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  final String status;
  const _StatusChip({required this.status});

  @override
  Widget build(BuildContext context) {
    Color bg;
    Color fg;
    IconData icon;

    switch (status) {
      case 'DISPATCHED':
        bg = AppTheme.success.withValues(alpha: 0.12);
        fg = AppTheme.success;
        icon = Icons.check_circle;
        break;
      case 'ANALYZING':
        bg = AppTheme.warning.withValues(alpha: 0.12);
        fg = AppTheme.warning;
        icon = Icons.hourglass_top;
        break;
      case 'NEW':
        bg = AppTheme.primary.withValues(alpha: 0.12);
        fg = AppTheme.primary;
        icon = Icons.fiber_new;
        break;
      default:
        bg = Colors.grey.shade100;
        fg = Colors.grey.shade600;
        icon = Icons.info;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: fg),
          const SizedBox(width: 4),
          Text(
            status,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: fg,
            ),
          ),
        ],
      ),
    );
  }
}
