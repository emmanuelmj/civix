import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../models/grievance.dart';

class AppState extends ChangeNotifier {
  // 10.0.2.2 is Android emulator's alias for host machine's localhost
  static const String _defaultApiUrl = 'http://10.0.2.2:8000';
  String _apiUrl = _defaultApiUrl;
  String get apiUrl => _apiUrl;

  String get wsUrl => '${_apiUrl.replaceFirst('http', 'ws')}/ws/dashboard';

  bool _connected = false;
  bool get connected => _connected;

  final List<Grievance> _myComplaints = [];
  List<Grievance> get myComplaints => List.unmodifiable(_myComplaints);

  final List<Grievance> _liveFeed = [];
  List<Grievance> get liveFeed => List.unmodifiable(_liveFeed);

  final List<Map<String, dynamic>> _swarmLogs = [];
  List<Map<String, dynamic>> get swarmLogs => List.unmodifiable(_swarmLogs);

  String _officerName = 'Field Officer';
  String get officerName => _officerName;
  String _officerId = 'FO-001';
  String get officerId => _officerId;

  WebSocketChannel? _channel;
  StreamSubscription? _subscription;

  AppState() {
    _loadPrefs();
    connectWebSocket();
  }

  Future<void> _loadPrefs() async {
    final prefs = await SharedPreferences.getInstance();
    _officerName = prefs.getString('officer_name') ?? 'Field Officer';
    _officerId = prefs.getString('officer_id') ?? 'FO-001';
    _apiUrl = prefs.getString('api_url') ?? _defaultApiUrl;
    notifyListeners();
  }

  Future<void> updateProfile(String name, String id) async {
    _officerName = name;
    _officerId = id;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('officer_name', name);
    await prefs.setString('officer_id', id);
    notifyListeners();
  }

  Future<void> updateApiUrl(String url) async {
    _apiUrl = url;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('api_url', url);
    _channel?.sink.close();
    connectWebSocket();
    notifyListeners();
  }

  void connectWebSocket() {
    _channel?.sink.close();
    _subscription?.cancel();

    try {
      _channel = WebSocketChannel.connect(Uri.parse(wsUrl));
      _connected = true;
      notifyListeners();

      _subscription = _channel!.stream.listen(
        (data) => _handleMessage(data),
        onError: (_) {
          _connected = false;
          notifyListeners();
          _reconnectAfterDelay();
        },
        onDone: () {
          _connected = false;
          notifyListeners();
          _reconnectAfterDelay();
        },
      );
    } catch (e) {
      _connected = false;
      notifyListeners();
      _reconnectAfterDelay();
    }
  }

  void _reconnectAfterDelay() {
    Future.delayed(const Duration(seconds: 3), () {
      if (!_connected) connectWebSocket();
    });
  }

  void _handleMessage(dynamic raw) {
    try {
      final msg = jsonDecode(raw as String) as Map<String, dynamic>;
      final type = msg['type'] as String? ?? '';

      if (type == 'NEW_DISPATCH' || type == 'new_dispatch') {
        final g = Grievance.fromJson(msg);
        _liveFeed.insert(0, g);
        if (_liveFeed.length > 50) _liveFeed.removeLast();
        final idx = _myComplaints.indexWhere((c) => c.id == g.id);
        if (idx >= 0) _myComplaints[idx] = g;
      } else if (type == 'swarm_log') {
        _swarmLogs.insert(0, msg['data'] as Map<String, dynamic>);
        if (_swarmLogs.length > 50) _swarmLogs.removeLast();
      } else if (type == 'intake_update') {
        final data = msg['data'] as Map<String, dynamic>;
        final g = Grievance(
          id: data['id']?.toString() ?? 'unknown',
          description: data['original_text']?.toString() ?? '',
          domain: 'Municipal',
          lat: (data['coordinates']?['lat'] as num?)?.toDouble() ?? 17.385,
          lng: (data['coordinates']?['lng'] as num?)?.toDouble() ?? 78.4867,
          status: 'NEW',
          timestamp: (data['timestamp'] as num?)?.toInt() ??
              DateTime.now().millisecondsSinceEpoch,
        );
        _liveFeed.insert(0, g);
        if (_liveFeed.length > 50) _liveFeed.removeLast();
      }
      notifyListeners();
    } catch (e) {
      debugPrint('WS parse error: $e');
    }
  }

  Future<bool> submitGrievance(Grievance grievance) async {
    try {
      final response = await http.post(
        Uri.parse('$_apiUrl/api/v1/trigger-analysis'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode(grievance.toSubmitJson()),
      );
      if (response.statusCode == 200) {
        _myComplaints.insert(0, grievance);
        notifyListeners();
        return true;
      }
      return false;
    } catch (e) {
      debugPrint('Submit error: $e');
      return false;
    }
  }

  Future<int> triggerDemoBurst({int count = 5}) async {
    try {
      final response = await http.post(
        Uri.parse('$_apiUrl/api/v1/demo-burst?count=$count'),
      );
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return data['count'] as int? ?? 0;
      }
      return 0;
    } catch (e) {
      debugPrint('Demo burst error: $e');
      return 0;
    }
  }

  @override
  void dispose() {
    _subscription?.cancel();
    _channel?.sink.close();
    super.dispose();
  }
}
