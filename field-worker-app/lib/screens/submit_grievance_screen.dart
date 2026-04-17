import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/app_state.dart';
import '../models/grievance.dart';
import '../theme/app_theme.dart';

class SubmitGrievanceScreen extends StatefulWidget {
  const SubmitGrievanceScreen({super.key});

  @override
  State<SubmitGrievanceScreen> createState() => _SubmitGrievanceScreenState();
}

class _SubmitGrievanceScreenState extends State<SubmitGrievanceScreen> {
  final _formKey = GlobalKey<FormState>();
  final _descController = TextEditingController();
  final _latController = TextEditingController(text: '17.385');
  final _lngController = TextEditingController(text: '78.4867');
  String _domain = 'MUNICIPAL';
  bool _submitting = false;

  static const _domains = [
    'MUNICIPAL',
    'TRAFFIC',
    'WATER',
    'ELECTRICITY',
    'CONSTRUCTION',
    'EMERGENCY',
  ];

  static const _domainIcons = {
    'MUNICIPAL': Icons.location_city,
    'TRAFFIC': Icons.traffic,
    'WATER': Icons.water_drop,
    'ELECTRICITY': Icons.bolt,
    'CONSTRUCTION': Icons.construction,
    'EMERGENCY': Icons.emergency,
  };

  @override
  void dispose() {
    _descController.dispose();
    _latController.dispose();
    _lngController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _submitting = true);

    final grievance = Grievance(
      id: 'FW-${DateTime.now().millisecondsSinceEpoch}',
      description: _descController.text.trim(),
      domain: _domain,
      lat: double.tryParse(_latController.text) ?? 17.385,
      lng: double.tryParse(_lngController.text) ?? 78.4867,
      timestamp: DateTime.now().millisecondsSinceEpoch,
    );

    final state = context.read<AppState>();
    final success = await state.submitGrievance(grievance);

    setState(() => _submitting = false);

    if (!mounted) return;

    if (success) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('✅ Grievance submitted — swarm activated!'),
          backgroundColor: AppTheme.success,
        ),
      );
      Navigator.pop(context);
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('❌ Failed to submit. Check backend connection.'),
          backgroundColor: AppTheme.danger,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Report Grievance')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Domain selector
                const Text(
                  'Category',
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 15,
                    color: AppTheme.textPrimary,
                  ),
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: _domains.map((d) {
                    final selected = d == _domain;
                    return ChoiceChip(
                      avatar: Icon(
                        _domainIcons[d],
                        size: 18,
                        color: selected ? Colors.white : AppTheme.textSecondary,
                      ),
                      label: Text(d),
                      selected: selected,
                      selectedColor: AppTheme.primary,
                      labelStyle: TextStyle(
                        color: selected ? Colors.white : AppTheme.textPrimary,
                        fontWeight: selected ? FontWeight.bold : FontWeight.normal,
                      ),
                      onSelected: (_) => setState(() => _domain = d),
                    );
                  }).toList(),
                ),

                const SizedBox(height: 20),

                // Description
                const Text(
                  'Description',
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 15,
                    color: AppTheme.textPrimary,
                  ),
                ),
                const SizedBox(height: 8),
                TextFormField(
                  controller: _descController,
                  maxLines: 4,
                  decoration: const InputDecoration(
                    hintText: 'Describe the issue (e.g., "Pothole on MG Road near bus stop")',
                  ),
                  validator: (v) =>
                      (v == null || v.trim().isEmpty) ? 'Description is required' : null,
                ),

                const SizedBox(height: 20),

                // Location
                const Text(
                  'Location (GPS)',
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 15,
                    color: AppTheme.textPrimary,
                  ),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: TextFormField(
                        controller: _latController,
                        decoration: const InputDecoration(labelText: 'Latitude'),
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                        validator: (v) {
                          final n = double.tryParse(v ?? '');
                          if (n == null || n < -90 || n > 90) return 'Invalid';
                          return null;
                        },
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: TextFormField(
                        controller: _lngController,
                        decoration: const InputDecoration(labelText: 'Longitude'),
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                        validator: (v) {
                          final n = double.tryParse(v ?? '');
                          if (n == null || n < -180 || n > 180) return 'Invalid';
                          return null;
                        },
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 12),

                // GPS help text
                Card(
                  color: AppTheme.primaryLight,
                  elevation: 0,
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Row(
                      children: [
                        const Icon(Icons.info_outline, color: AppTheme.primary, size: 20),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'Default: Hyderabad (17.385, 78.487). On a real device GPS auto-fills.',
                            style: TextStyle(
                              fontSize: 12,
                              color: AppTheme.primary.withValues(alpha: 0.8),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

                const SizedBox(height: 28),

                // Submit
                SizedBox(
                  height: 52,
                  child: ElevatedButton.icon(
                    onPressed: _submitting ? null : _submit,
                    icon: _submitting
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Icon(Icons.send),
                    label: Text(_submitting ? 'Submitting…' : 'Submit to Swarm'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
