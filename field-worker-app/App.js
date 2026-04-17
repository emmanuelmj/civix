/**
 * App.js — Civix Field Worker
 * ============================
 * State machine:
 *   LOGIN → OFF_DUTY → SCENARIO_QUEUE → INCIDENT_LIST → EN_ROUTE → VERIFICATION
 *
 * !! BACKEND CONFIG — update before deploying !!
 *   BACKEND_BASE_URL  →  your FastAPI backend URL
 *   OFFICER_ID        →  officer's unique identifier
 *
 * DEMO MODE: auto-enabled on web — all states work without a real device.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Alert,
  Vibration,
  Platform,
} from 'react-native';
import * as Location from 'expo-location';
import { useCameraPermissions } from 'expo-camera';
import { T } from './constants/theme';
import { io } from 'socket.io-client';

import LoginScreen         from './components/LoginScreen';
import ScenarioQueueScreen from './components/ScenarioQueueScreen';
import IncidentListScreen  from './components/IncidentListScreen';
import EnRouteScreen       from './components/EnRouteScreen';
import CameraScreen        from './components/CameraScreen';
import PhoneFrame          from './components/PhoneFrame';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG  !! REPLACE before deploying !!
// ─────────────────────────────────────────────────────────────────────────────
const BACKEND_BASE_URL = 'https://cautious-winner-j9g694vr76jcv57-8000.app.github.dev';
const OFFICER_ID       = 'OP-441';
const PING_INTERVAL_MS = 5000;
const IS_DEMO          = Platform.OS === 'web';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const vibrate = (pattern) => {
  if (Platform.OS !== 'web') Vibration.vibrate(pattern);
};

// ─────────────────────────────────────────────────────────────────────────────
// App states
// ─────────────────────────────────────────────────────────────────────────────
const STATES = {
  LOGIN:          'LOGIN',
  OFF_DUTY:       'OFF_DUTY',
  SCENARIO_QUEUE: 'SCENARIO_QUEUE',  // browsing category list (was AVAILABLE)
  INCIDENT_LIST:  'INCIDENT_LIST',   // viewing incidents in a scenario
  EN_ROUTE:       'EN_ROUTE',        // accepted an incident, navigating to it
  VERIFICATION:   'VERIFICATION',    // at location, taking proof-of-work photo
};

// ─────────────────────────────────────────────────────────────────────────────
// Mock scenario + incident data
// ─────────────────────────────────────────────────────────────────────────────
const SCENARIOS = [
  {
    id: 'WATER',
    icon: '💧',
    color: '#3B82F6',
    accentBg: '#EFF6FF',
    domain: 'WATER',
    depots: [
      { name: 'Water Works Unit 7',  address: 'Mehdipatnam Depot', distance_km: 1.8 },
      { name: 'HMWS&SB Station',     address: 'Tolichowki',        distance_km: 3.4 },
    ],
    incidents: [
      {
        event_id:      'demo-w1',
        title:         'Main Supply Pipe Burst',
        description:   'Main supply pipe burst on MG Road. Flooding 3 residential blocks. Approx 2,000 residents affected.',
        priority:      'CRITICAL',
        impact_score:  87,
        severity_color:'Red',
        coordinates:   { lat: 17.4560, lng: 78.3850 },
        distance_km:   1.4,
        reported_at:   '09:14',
      },
      {
        event_id:      'demo-w2',
        title:         'Low Water Pressure — Sector 12',
        description:   'Multiple residents reporting zero water pressure in Sector 12, Banjara Hills. Possibly related to a pump failure upstream.',
        priority:      'HIGH',
        impact_score:  63,
        severity_color:'Orange',
        coordinates:   { lat: 17.4488, lng: 78.3920 },
        distance_km:   2.9,
        reported_at:   '10:32',
      },
      {
        event_id:      'demo-w3',
        title:         'Sewage Overflow — Street 14',
        description:   'Sewage overflow on Street 14, Mehdipatnam. Contamination near food market area. Health hazard escalating.',
        priority:      'MODERATE',
        impact_score:  58,
        severity_color:'Yellow',
        coordinates:   { lat: 17.4512, lng: 78.3840 },
        distance_km:   3.7,
        reported_at:   '11:05',
      },
    ],
  },
  {
    id: 'ELECTRICAL',
    icon: '⚡',
    color: '#F59E0B',
    accentBg: '#FFFBEB',
    domain: 'ELECTRICITY',
    depots: [
      { name: 'TSGENCO Substation 3', address: 'Attapur',   distance_km: 2.4 },
      { name: 'City Electrical Depot', address: 'Kondapur', distance_km: 4.8 },
    ],
    incidents: [
      {
        event_id:      'demo-e1',
        title:         'Live Wire — School Entrance',
        description:   'Live wire exposed near Greenfield Public School main entrance. Immediate electrocution risk to students and staff.',
        priority:      'CRITICAL',
        impact_score:  95,
        severity_color:'Red',
        coordinates:   { lat: 17.4482, lng: 78.3914 },
        distance_km:   0.8,
        reported_at:   '08:47',
      },
      {
        event_id:      'demo-e2',
        title:         'Transformer Fire — Block C',
        description:   'Transformer overheating and sparking at residential Block C. Power cut to 200+ units. Risk of fire spreading.',
        priority:      'HIGH',
        impact_score:  76,
        severity_color:'Orange',
        coordinates:   { lat: 17.4521, lng: 78.3877 },
        distance_km:   1.6,
        reported_at:   '09:58',
      },
    ],
  },
  {
    id: 'ROAD',
    icon: '🚧',
    color: '#6B7280',
    accentBg: '#F9FAFB',
    domain: 'TRAFFIC',
    depots: [
      { name: 'Roads & Bridges Unit 2', address: 'Kukatpally', distance_km: 3.2 },
      { name: 'Traffic Division HQ',    address: 'Abids',      distance_km: 6.1 },
    ],
    incidents: [
      {
        event_id:      'demo-r1',
        title:         'Pothole Collapse — NH65',
        description:   'Large pothole collapse on NH-65 near Tolichowki flyover. 3 vehicles damaged, road partially blocked. Peak hour traffic building.',
        priority:      'HIGH',
        impact_score:  61,
        severity_color:'Orange',
        coordinates:   { lat: 17.4423, lng: 78.3977 },
        distance_km:   2.1,
        reported_at:   '07:30',
      },
      {
        event_id:      'demo-r2',
        title:         'Fallen Tree — Main Boulevard',
        description:   'Large tree fallen across the main boulevard after last night\'s rain. Blocking both lanes. Diversion needed.',
        priority:      'MODERATE',
        impact_score:  44,
        severity_color:'Yellow',
        coordinates:   { lat: 17.4399, lng: 78.4023 },
        distance_km:   4.5,
        reported_at:   '06:15',
      },
    ],
  },
  {
    id: 'FIRE HAZARD',
    icon: '🔥',
    color: '#EF4444',
    accentBg: '#FEF2F2',
    domain: 'MUNICIPAL',
    depots: [
      { name: 'Fire Station Alpha',   address: 'Banjara Hills', distance_km: 1.1 },
      { name: 'Hazmat Response Unit', address: 'Jubilee Hills', distance_km: 3.7 },
    ],
    incidents: [
      {
        event_id:      'demo-f1',
        title:         'Gas Leak — Skyline Apartments',
        description:   'Gas leak reported at Skyline Apartment Complex Block C. Immediate evacuation required. Approx 500 residents at risk.',
        priority:      'CRITICAL',
        impact_score:  98,
        severity_color:'Red',
        coordinates:   { lat: 17.4390, lng: 78.4010 },
        distance_km:   0.5,
        reported_at:   '12:11',
      },
    ],
  },
  {
    id: 'SANITATION',
    icon: '🧹',
    color: '#10B981',
    accentBg: '#ECFDF5',
    domain: 'SANITATION',
    depots: [
      { name: 'GHMC Sanitation Depot',    address: 'Mehdipatnam', distance_km: 0.9 },
      { name: 'Waste Management Unit 5',  address: 'Tolichowki',  distance_km: 2.7 },
    ],
    incidents: [
      {
        event_id:      'demo-s1',
        title:         'Garbage Pile — Market Area',
        description:   'Uncollected garbage accumulation for 5+ days near the central market. Attracting pests. Health hazard escalating.',
        priority:      'MODERATE',
        impact_score:  52,
        severity_color:'Yellow',
        coordinates:   { lat: 17.4445, lng: 78.3855 },
        distance_km:   2.8,
        reported_at:   '08:20',
      },
      {
        event_id:      'demo-s2',
        title:         'Drain Blockage — Residential Colony',
        description:   'Storm drain blocked causing standing water in residential colony. Mosquito breeding concern. 3 households affected.',
        priority:      'HIGH',
        impact_score:  67,
        severity_color:'Orange',
        coordinates:   { lat: 17.4468, lng: 78.3898 },
        distance_km:   1.5,
        reported_at:   '10:45',
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Root
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [appState,         setAppState]         = useState(STATES.LOGIN);
  const [selectedScenario, setSelectedScenario] = useState(null); // scenario object
  const [selectedIncident, setSelectedIncident] = useState(null); // incident object
  const [currentLocation,  setCurrentLocation]  = useState(
    IS_DEMO ? { lat: 17.4501, lng: 78.39 } : null,
  );

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const socketRef       = useRef(null);
  const pingIntervalRef = useRef(null);

  // ── Permissions (native only) ─────────────────────────────────────────────
  useEffect(() => {
    if (IS_DEMO) return;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (!cameraPermission?.granted) await requestCameraPermission();
      if (status !== 'granted')
        Alert.alert('Location Required', 'Enable location access to receive dispatches.');
    })();
    return () => _cleanup();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── WebSocket (native only) ───────────────────────────────────────────────
  const connectSocket = useCallback(() => {
    if (IS_DEMO) return;
    socketRef.current?.disconnect();
    const socket = io(BACKEND_BASE_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 15,
      reconnectionDelay: 3000,
    });
    socket.on('connect',       () => console.log('[WS] connected'));
    socket.on('disconnect',    (r) => console.log('[WS] disconnected:', r));
    socket.on('connect_error', (e) => console.warn('[WS] error:', e.message));
    socketRef.current = socket;
  }, []);

  // ── GPS ping (broadcasts officer location to backend every 5 s) ──────────
  const _sendPing = async () => {
    if (IS_DEMO) return;
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude: lat, longitude: lng, accuracy } = loc.coords;
      setCurrentLocation({ lat, lng });
      await fetch(`${BACKEND_BASE_URL}/api/v1/officer/update-location`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          officer_id: OFFICER_ID, status: 'AVAILABLE', lat, lng,
          accuracy_meters: accuracy ?? null, battery_percent: null,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (e) { console.warn('[GPS]', e.message); }
  };

  const startPing = useCallback(() => {
    _sendPing();
    pingIntervalRef.current = setInterval(_sendPing, PING_INTERVAL_MS);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const stopPing = useCallback(() => {
    clearInterval(pingIntervalRef.current);
    pingIntervalRef.current = null;
  }, []);

  const _cleanup = () => {
    stopPing();
    socketRef.current?.disconnect();
    socketRef.current = null;
  };

  // ── State transitions ─────────────────────────────────────────────────────

  const handleLogin = useCallback(() => {
    setAppState(STATES.OFF_DUTY);
  }, []);

  const handleGoOnDuty = useCallback(async () => {
    if (!IS_DEMO) {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Enable location to go on duty.');
        return;
      }
      connectSocket();
      startPing();
    }
    vibrate([0, 200]);
    setAppState(STATES.SCENARIO_QUEUE);
  }, [connectSocket, startPing]);

  const handleGoOffDuty = useCallback(() => {
    _cleanup();
    setSelectedScenario(null);
    setSelectedIncident(null);
    setAppState(STATES.OFF_DUTY);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectScenario = useCallback((scenario) => {
    setSelectedScenario(scenario);
    setAppState(STATES.INCIDENT_LIST);
  }, []);

  const handleBackToQueue = useCallback(() => {
    setSelectedScenario(null);
    setAppState(STATES.SCENARIO_QUEUE);
  }, []);

  const handleAcceptIncident = useCallback((incident) => {
    vibrate([0, 300, 100, 300]);
    setSelectedIncident(incident);
    stopPing(); // stop location broadcast while en route
    setAppState(STATES.EN_ROUTE);
  }, [stopPing]);

  const handleTaskComplete = useCallback(() => {
    setAppState(STATES.VERIFICATION);
  }, []);

  const handleVerificationComplete = useCallback(async (payload) => {
    if (IS_DEMO) {
      Alert.alert(
        '✅  TASK VERIFIED',
        'In production this photo + GPS is sent to the AI Vision Agent for confirmation.',
        [{
          text: 'DONE',
          onPress: () => {
            setSelectedIncident(null);
            setSelectedScenario(null);
            setAppState(STATES.SCENARIO_QUEUE);
            if (!IS_DEMO) startPing();
          },
        }],
      );
      return;
    }
    try {
      const res    = await fetch(`${BACKEND_BASE_URL}/api/v1/officer/verify-resolution`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      const result = await res.json();
      const returnToQueue = () => {
        setSelectedIncident(null);
        setSelectedScenario(null);
        setAppState(STATES.SCENARIO_QUEUE);
        startPing();
      };
      if (result.verified) {
        Alert.alert('✅ VERIFIED', 'Issue confirmed resolved!', [{ text: 'DONE', onPress: returnToQueue }]);
      } else if (!result.gps_match) {
        Alert.alert('📍 GPS MISMATCH', result.vision_analysis ?? 'Move closer and retry.', [{ text: 'RETRY' }]);
      } else {
        Alert.alert('❌ NOT VERIFIED', result.vision_analysis ?? 'Please retry.', [{ text: 'RETRY' }]);
      }
    } catch { Alert.alert('Network Error', 'Check connection and retry.'); }
  }, [startPing]);

  const handleCancelVerification = useCallback(() => {
    setAppState(STATES.EN_ROUTE);
  }, []);

  const handleCancelEnRoute = useCallback(() => {
    setSelectedIncident(null);
    setAppState(STATES.INCIDENT_LIST);
    if (!IS_DEMO) startPing();
  }, [startPing]);

  // ── Render ────────────────────────────────────────────────────────────────
  const screenContent = () => {
    // LOGIN — full-screen auth (no header needed)
    if (appState === STATES.LOGIN)
      return <LoginScreen onLogin={handleLogin} />;

    // SCENARIO QUEUE — full-screen dashboard with its own header
    if (appState === STATES.SCENARIO_QUEUE)
      return (
        <ScenarioQueueScreen
          scenarios={SCENARIOS}
          officerId={OFFICER_ID}
          location={currentLocation}
          isDemo={IS_DEMO}
          onSelectScenario={handleSelectScenario}
          onGoOffDuty={handleGoOffDuty}
        />
      );

    // INCIDENT LIST — full-screen with its own header
    if (appState === STATES.INCIDENT_LIST && selectedScenario)
      return (
        <IncidentListScreen
          scenario={selectedScenario}
          onAccept={handleAcceptIncident}
          onBack={handleBackToQueue}
        />
      );

    // EN ROUTE — full-screen with map placeholder + geofencing
    if (appState === STATES.EN_ROUTE && selectedIncident)
      return (
        <EnRouteScreen
          incident={selectedIncident}
          currentLocation={currentLocation}
          isDemo={IS_DEMO}
          onTaskComplete={handleTaskComplete}
          onCancel={handleCancelEnRoute}
        />
      );

    // VERIFICATION — full-screen live camera
    if (appState === STATES.VERIFICATION && selectedIncident)
      return (
        <CameraScreen
          task={selectedIncident}
          officerId={OFFICER_ID}
          onComplete={handleVerificationComplete}
          onCancel={handleCancelVerification}
        />
      );

    // OFF DUTY — wrapped in the global header
    return (
      <SafeAreaView style={styles.root}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.header}>
          <Text style={styles.headerTitle}>CIVIX</Text>
          <View style={styles.headerRight}>
            {IS_DEMO && (
              <View style={styles.demoBadge}>
                <Text style={styles.demoBadgeText}>DEMO</Text>
              </View>
            )}
            <Text style={styles.officerBadge}>{OFFICER_ID}</Text>
          </View>
        </View>
        <View style={styles.body}>
          <OffDutyScreen onGoOnDuty={handleGoOnDuty} />
        </View>
      </SafeAreaView>
    );
  };

  return <PhoneFrame>{screenContent()}</PhoneFrame>;
}

// ─────────────────────────────────────────────────────────────────────────────
// OFF DUTY sub-screen (inline — no state, no imports needed)
// ─────────────────────────────────────────────────────────────────────────────
function OffDutyScreen({ onGoOnDuty }) {
  return (
    <View style={styles.offDutyContainer}>

      {/* ── Status hero ── */}
      <View style={styles.statusHero}>
        <Text style={styles.statusLabel}>OFFICER STATUS</Text>
        <Text style={[styles.statusValue, { color: '#374151' }]}>OFF DUTY</Text>
        <Text style={styles.statusSubtext}>You are off the dispatch grid</Text>
      </View>

      {/* ── Officer info card ── */}
      <View style={styles.officerCard}>
        <View style={styles.officerRow}>
          <Text style={styles.officerLabel}>OFFICER ID</Text>
          <Text style={styles.officerValue}>{OFFICER_ID}</Text>
        </View>
        <View style={styles.cardDivider} />
        <View style={styles.officerRow}>
          <Text style={styles.officerLabel}>STATUS</Text>
          <View style={styles.officerValueRow}>
            <View style={styles.inactiveDot} />
            <Text style={styles.officerValue}>INACTIVE</Text>
          </View>
        </View>
        <View style={styles.cardDivider} />
        <View style={styles.officerRow}>
          <Text style={styles.officerLabel}>DOMAIN</Text>
          <Text style={styles.officerValue}>FIELD OPS</Text>
        </View>
      </View>

      {/* ── GO ON DUTY ── */}
      <TouchableOpacity style={styles.primaryBtn} onPress={onGoOnDuty} activeOpacity={0.85}>
        <Text style={styles.primaryBtnText}>GO ON DUTY</Text>
      </TouchableOpacity>

    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles — enterprise light theme (used only for OFF_DUTY screen + shell)
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({

  // ── Root & shell ────────────────────────────────────────────────────────────
  root:   { flex: 1, width: '100%', height: '100%', backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#FFFFFF', paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F1F3F4',
  },
  headerTitle:  { fontSize: 17, fontWeight: '900', color: '#111827', letterSpacing: 5 },
  headerRight:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  demoBadge: {
    backgroundColor: '#F3F4F6', borderRadius: 20,
    paddingHorizontal: 9, paddingVertical: 3,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  demoBadgeText: { fontSize: 10, fontWeight: '700', color: '#6B7280', letterSpacing: 1.5 },
  officerBadge:  { fontSize: 12, fontWeight: '700', color: '#9CA3AF', letterSpacing: 1.5 },
  body:          { flex: 1 },

  // ── Shared typography ───────────────────────────────────────────────────────
  statusLabel:   { fontSize: 11, fontWeight: '600', color: '#9CA3AF', letterSpacing: 3.5 },
  statusValue:   { fontSize: 38, fontWeight: '900', letterSpacing: 1 },

  // ── OFF DUTY screen ─────────────────────────────────────────────────────────
  offDutyContainer: {
    flex: 1, justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 32, paddingBottom: 28,
  },
  statusHero:    { alignItems: 'center', gap: 8 },
  statusSubtext: { fontSize: 13, fontWeight: '500', color: '#9CA3AF', textAlign: 'center', marginTop: 2 },

  officerCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16,
    borderWidth: 1, borderColor: '#F1F3F4', overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 12, elevation: 2,
  },
  officerRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16,
  },
  officerLabel:    { fontSize: 11, fontWeight: '600', color: '#9CA3AF', letterSpacing: 2.5 },
  officerValue:    { fontSize: 13, fontWeight: '700', color: '#111827' },
  officerValueRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  inactiveDot:     { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#D1D5DB' },
  cardDivider:     { height: 1, backgroundColor: '#F1F3F4' },

  primaryBtn: {
    backgroundColor: '#2563EB', paddingVertical: 18, borderRadius: 14, alignItems: 'center',
    shadowColor: '#2563EB', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28, shadowRadius: 16, elevation: 6,
  },
  primaryBtnText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF', letterSpacing: 2 },
});
