class Grievance {
  final String id;
  final String description;
  final String domain;
  final double lat;
  final double lng;
  final String status;
  final String? assignedOfficer;
  final int timestamp;
  final String? imagePath;
  final int? impactScore;
  final String? severityColor;

  Grievance({
    required this.id,
    required this.description,
    required this.domain,
    required this.lat,
    required this.lng,
    this.status = 'NEW',
    this.assignedOfficer,
    required this.timestamp,
    this.imagePath,
    this.impactScore,
    this.severityColor,
  });

  factory Grievance.fromJson(Map<String, dynamic> json) {
    final data = json['data'] as Map<String, dynamic>? ?? json;
    final pe = data['pulse_event'] as Map<String, dynamic>? ?? data;
    final coords = pe['coordinates'] as Map<String, dynamic>?;
    final officer = data['assigned_officer'] as Map<String, dynamic>?;

    return Grievance(
      id: (pe['event_id'] ?? json['event_id'] ?? 'unknown').toString(),
      description: (pe['summary'] ?? pe['translated_description'] ?? '').toString(),
      domain: (pe['category'] ?? pe['domain'] ?? 'Municipal').toString(),
      lat: (coords?['lat'] as num?)?.toDouble() ?? 17.385,
      lng: (coords?['lng'] as num?)?.toDouble() ?? 78.4867,
      status: officer != null ? 'DISPATCHED' : (pe['status'] ?? 'ANALYZING').toString(),
      assignedOfficer: officer?['officer_id']?.toString(),
      timestamp: (pe['timestamp'] as num?)?.toInt() ?? DateTime.now().millisecondsSinceEpoch,
      impactScore: (pe['impact_score'] as num?)?.toInt(),
      severityColor: pe['severity_color']?.toString(),
    );
  }

  Map<String, dynamic> toSubmitJson() => {
        'event_id': id,
        'translated_description': description,
        'domain': domain,
        'coordinates': {'lat': lat, 'lng': lng},
      };
}
