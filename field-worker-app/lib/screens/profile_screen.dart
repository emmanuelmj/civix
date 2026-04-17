import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/app_state.dart';
import '../theme/app_theme.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  late TextEditingController _nameController;
  late TextEditingController _idController;
  late TextEditingController _urlController;

  @override
  void initState() {
    super.initState();
    final state = context.read<AppState>();
    _nameController = TextEditingController(text: state.officerName);
    _idController = TextEditingController(text: state.officerId);
    _urlController = TextEditingController(text: state.apiUrl);
  }

  @override
  void dispose() {
    _nameController.dispose();
    _idController.dispose();
    _urlController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();

    return Scaffold(
      appBar: AppBar(title: const Text('Profile & Settings')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Profile avatar
              Center(
                child: Column(
                  children: [
                    CircleAvatar(
                      radius: 44,
                      backgroundColor: AppTheme.primaryLight,
                      child: Text(
                        state.officerName.isNotEmpty
                            ? state.officerName[0].toUpperCase()
                            : 'F',
                        style: const TextStyle(
                          fontSize: 36,
                          fontWeight: FontWeight.bold,
                          color: AppTheme.primary,
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      state.officerName,
                      style: const TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                        color: AppTheme.textPrimary,
                      ),
                    ),
                    Text(
                      state.officerId,
                      style: const TextStyle(color: AppTheme.textSecondary),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 28),

              // Connection status
              Card(
                color: state.connected
                    ? AppTheme.success.withValues(alpha: 0.08)
                    : AppTheme.danger.withValues(alpha: 0.08),
                elevation: 0,
                child: ListTile(
                  leading: Icon(
                    state.connected ? Icons.wifi : Icons.wifi_off,
                    color: state.connected ? AppTheme.success : AppTheme.danger,
                  ),
                  title: Text(
                    state.connected ? 'Connected to Backend' : 'Disconnected',
                    style: TextStyle(
                      fontWeight: FontWeight.w600,
                      color: state.connected ? AppTheme.success : AppTheme.danger,
                    ),
                  ),
                  subtitle: Text(state.apiUrl, style: const TextStyle(fontSize: 12)),
                  trailing: IconButton(
                    icon: const Icon(Icons.refresh),
                    onPressed: () => state.connectWebSocket(),
                  ),
                ),
              ),

              const SizedBox(height: 20),

              // Edit profile
              const Text(
                'Officer Profile',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.textPrimary,
                ),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _nameController,
                decoration: const InputDecoration(
                  labelText: 'Officer Name',
                  prefixIcon: Icon(Icons.person),
                ),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _idController,
                decoration: const InputDecoration(
                  labelText: 'Officer ID',
                  prefixIcon: Icon(Icons.badge),
                ),
              ),
              const SizedBox(height: 12),
              ElevatedButton(
                onPressed: () {
                  state.updateProfile(
                    _nameController.text.trim(),
                    _idController.text.trim(),
                  );
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Profile updated'),
                      backgroundColor: AppTheme.success,
                    ),
                  );
                },
                child: const Text('Save Profile'),
              ),

              const SizedBox(height: 28),

              // Backend URL
              const Text(
                'Backend Configuration',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.textPrimary,
                ),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _urlController,
                decoration: const InputDecoration(
                  labelText: 'Backend API URL',
                  prefixIcon: Icon(Icons.link),
                  hintText: 'http://localhost:8000',
                ),
              ),
              const SizedBox(height: 12),
              ElevatedButton.icon(
                onPressed: () {
                  state.updateApiUrl(_urlController.text.trim());
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Backend URL updated — reconnecting…'),
                      backgroundColor: AppTheme.primary,
                    ),
                  );
                },
                icon: const Icon(Icons.save),
                label: const Text('Update & Reconnect'),
              ),

              const SizedBox(height: 28),

              // About
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'About Civix Pulse',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: AppTheme.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'Agentic Governance & Grievance Resolution Swarm\n'
                        'AI-powered multi-agent system for real-time civic complaint processing.\n\n'
                        '• LangGraph orchestration\n'
                        '• Real-time WebSocket dispatch\n'
                        '• Spatial clustering & priority scoring\n'
                        '• Field worker mobile companion',
                        style: TextStyle(
                          fontSize: 13,
                          color: AppTheme.textSecondary,
                          height: 1.5,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        'v0.1.0 • Hackathon Build',
                        style: TextStyle(
                          fontSize: 11,
                          color: Colors.grey.shade400,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
