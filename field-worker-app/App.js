/**
 * App.js — Civix Field Worker
 * ════════════════════════════
 * 5-state linear demo flow:
 *   0: SPLASH  →  1: LOGIN  →  2: DASHBOARD  →  3: ACTIVE_TASK  →  4: VERIFICATION
 *
 * All overlay/modal UI uses position:'absolute' Views — never React Native <Modal>.
 * This keeps every overlay clipped inside the PhoneFrame bounding box on web.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, StatusBar, ScrollView, ActivityIndicator,
  Image, Platform, Linking, Alert,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { T } from './constants/theme';
import PhoneFrame from './components/PhoneFrame';
import { healthCheck, updateOfficerLocation, verifyResolution, fetchOfficerTasks, fetchOfficerProfile } from './services/api';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const DEFAULT_OFFICER_ID   = 'OP-101';
const OFFICER_LAT = 17.4482;
const OFFICER_LNG = 78.3914;

/**
 * Maps a raw backend event (from PostgreSQL) into the dispatch card format
 * used by the field worker UI.
 */
function mapEventToDispatch(event) {
  // Derive priority from impact_score
  const impact = event.impact_score ?? 50;
  let priority = 'MODERATE';
  if (impact >= 80) priority = 'CRITICAL';
  else if (impact >= 60) priority = 'HIGH';
  else if (impact < 40) priority = 'LOW';

  // Compute rough distance from officer to event (Haversine approximation in km)
  const dLat = (event.latitude - OFFICER_LAT) * 111.32;
  const dLng = (event.longitude - OFFICER_LNG) * 111.32 * Math.cos(OFFICER_LAT * Math.PI / 180);
  const dist = Math.sqrt(dLat * dLat + dLng * dLng).toFixed(1);

  // Build a readable title from issue_type + domain + description
  const issueType = event.issue_type || event.domain || 'Issue';
  const descSnippet = (event.translated_description || '').slice(0, 40);
  const title = `${issueType} — ${descSnippet}`;

  const created = event.created_at ? new Date(event.created_at) : new Date();
  const time = created.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  return {
    id: event.event_id,
    ticketId: event.event_id.slice(0, 8).toUpperCase(),
    title,
    description: event.translated_description || 'No description provided.',
    direction: `Proceed ${dist}km to incident location`,
    distance: `${dist} km`,
    priority,
    lat: event.latitude ?? 17.4,
    lng: event.longitude ?? 78.4,
    time,
    reportedBy: `Source: ${event.source || 'citizen report'}`,
    reportCount: event.cluster_found ? 5 : 1,
    status: event.status,
    impact_score: impact,
    domain: event.domain,
  };
}

// Fallback mock dispatches in case backend is unreachable
const FALLBACK_DISPATCHES = [
  {
    id: 'rd-001', ticketId: 'TKT-7741',
    title: 'Massive Pothole — NH65 Tolichowki',
    description: 'Deep pothole near Tolichowki flyover. 3 vehicles damaged.',
    direction: 'Proceed 1.2km North on NH-65', distance: '1.2 km',
    priority: 'HIGH', lat: 17.4482, lng: 78.3914, time: '08:30',
    reportedBy: 'Auto-detected via 14 citizen reports', reportCount: 14,
  },
  {
    id: 'rd-002', ticketId: 'TKT-7748',
    title: 'Flooded Intersection — Jubilee Hills',
    description: 'Storm water overflow flooding Road No. 36.',
    direction: 'Proceed 0.8km South-West', distance: '0.8 km',
    priority: 'CRITICAL', lat: 17.4150, lng: 78.4480, time: '09:15',
    reportedBy: '22 citizen reports', reportCount: 22,
  },
];

// Departments available for cross-dept support requests
const DEPARTMENTS = ['Water & Sanitation', 'Electrical Grid', 'Traffic Police', 'Heavy Machinery'];

// Priority colour map
const PRI = {
  CRITICAL: { bg: '#FEF2F2', text: '#DC2626', border: '#FCA5A5' },
  HIGH:     { bg: '#FFFBEB', text: '#D97706', border: '#FCD34D' },
  MODERATE: { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' },
  LOW:      { bg: '#F0FDF4', text: '#16A34A', border: '#BBF7D0' },
};

// ─── ROOT APP ─────────────────────────────────────────────────────────────────
export default function App() {
  // 0=Splash 1=Login 2=Dashboard 3=ActiveTask 4=Verification
  const [appState,      setAppState]      = useState(0);
  const [activeTask,    setActiveTask]    = useState(null);
  const [activeIssues,  setActiveIssues]  = useState([]);

  // Officer identity (loaded from backend or default)
  const [officerId, setOfficerId] = useState(DEFAULT_OFFICER_ID);
  const [officerName, setOfficerName] = useState('Field Officer');
  const [officerRole, setOfficerRole] = useState('Municipal Services');

  // Real dispatches from backend (replaces hardcoded DISPATCHES)
  const [dispatches, setDispatches] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

  // Tracks whether the officer has gone on duty this session (prevents re-showing overlay on return)
  const [hasGoneOnDuty, setHasGoneOnDuty] = useState(false);

  // Dashboard overlays (all position:absolute, no Modal portals)
  const [dutyOverlay,   setDutyOverlay]   = useState(false);
  const [menuOpen,      setMenuOpen]      = useState(false);

  // Active task — support request overlay
  const [supportOpen,     setSupportOpen]     = useState(false);
  const [supportText,     setSupportText]     = useState('');
  const [selectedDept,    setSelectedDept]    = useState(null);  // chip selection
  const [supportSent,     setSupportSent]     = useState(false);
  const [assignedSupport, setAssignedSupport] = useState(null);  // simulated swarm dispatch

  // Verification sub-phases: 'idle' | 'camera' | 'processing' | 'success'
  const [verifyPhase,   setVerifyPhase]   = useState('idle');
  const [capturedImage, setCapturedImage] = useState(null);

  // Camera permissions
  const [camPerm, requestCamPerm] = useCameraPermissions();
  const cameraRef = useRef(null);

  // Backend connectivity
  const [backendStatus, setBackendStatus] = useState(null); // null | 'ok' | 'offline'
  const locationTimer = useRef(null);

  // ── Auto-advance: Splash → Login ───────────────────────────────────────────
  useEffect(() => {
    if (appState !== 0) return;
    // Check backend health + load officer profile during splash
    healthCheck()
      .then(r => {
        setBackendStatus(r?.status === 'ok' ? 'ok' : 'offline');
        // Load officer profile if backend is up
        if (r?.status === 'ok') {
          fetchOfficerProfile(officerId).then(prof => {
            if (prof?.status === 'ok' && prof.officer) {
              setOfficerName(prof.officer.name || 'Field Officer');
              const skills = prof.officer.domain_skills || '';
              setOfficerRole(skills.split(' ').map(s => s.charAt(0) + s.slice(1).toLowerCase()).join(' '));
            }
          }).catch(() => {});
        }
      })
      .catch(() => setBackendStatus('offline'));
    const t = setTimeout(() => setAppState(1), 2000);
    return () => clearTimeout(t);
  }, [appState]);

  // ── Location pings every 15s while on duty ─────────────────────────────────
  useEffect(() => {
    if (hasGoneOnDuty && backendStatus === 'ok') {
      const sendLocation = () => {
        updateOfficerLocation(officerId, OFFICER_LAT, OFFICER_LNG)
          .then(r => r?.error && console.warn('[Location] ping failed'))
          .catch(() => {});
      };
      sendLocation();
      locationTimer.current = setInterval(sendLocation, 15000);
      return () => clearInterval(locationTimer.current);
    }
    return () => { if (locationTimer.current) clearInterval(locationTimer.current); };
  }, [hasGoneOnDuty, backendStatus]);

  // ── Load real tasks from backend when entering dashboard ───────────────────
  useEffect(() => {
    if (appState !== 2) return;
    if (backendStatus !== 'ok') {
      setDispatches(FALLBACK_DISPATCHES);
      return;
    }
    setLoadingTasks(true);
    fetchOfficerTasks(officerId)
      .then(res => {
        if (res?.status === 'ok' && res.tasks?.length > 0) {
          // Only show DISPATCHED tasks (not RESOLVED)
          const pending = res.tasks.filter(t => t.status !== 'RESOLVED');
          setDispatches(pending.map(mapEventToDispatch));
        } else {
          setDispatches(FALLBACK_DISPATCHES);
        }
      })
      .catch(() => setDispatches(FALLBACK_DISPATCHES))
      .finally(() => setLoadingTasks(false));
  }, [appState, backendStatus]);

  // ── Show duty popup when arriving at Dashboard (only if not already on duty) ─
  useEffect(() => {
    if (appState === 2) {
      if (!hasGoneOnDuty) setDutyOverlay(true);
      setSupportSent(false);
    }
  }, [appState]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleLogin = () => setAppState(2);

  const acceptDispatch = (d) => {
    const now = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const task = { ...d, status: 'EN_ROUTE', acceptedAt: now };
    setActiveIssues(prev => [task, ...prev]);
    setActiveTask(task);
    setAppState(3);
  };

  const openDirections = (task) => {
    Linking.openURL(`https://maps.google.com/?q=${task.lat},${task.lng}`);
  };

  const submitSupport = () => {
    const dept = selectedDept; // capture before clearing
    setSupportOpen(false);
    setSupportText('');
    setSelectedDept(null);
    setSupportSent(true);
    // Simulate swarm finding an available worker after 1.5s
    setTimeout(() => {
      setAssignedSupport({ id: 'WP-892', dept, eta: '4 mins' });
    }, 1500);
  };

  const handleTaskCompleted = async () => {
    if (Platform.OS !== 'web' && !camPerm?.granted) {
      await requestCamPerm();
    }
    setVerifyPhase('idle');
    setCapturedImage(null);
    setAppState(4);
  };

  // Shared capture-success handler — called by both the real camera and the web simulator
  const handleCaptureSuccess = async (base64Uri = null) => {
    setCapturedImage(base64Uri);
    setVerifyPhase('processing');

    // Call backend verification endpoint
    if (backendStatus === 'ok' && activeTask) {
      try {
        const res = await verifyResolution(
          officerId,
          activeTask.ticketId || activeTask.id,
          base64Uri,
          'Resolution verified by field worker'
        );
        console.log('[Verify]', res);
      } catch (err) {
        console.warn('[Verify] Backend call failed:', err.message);
      }
    }

    // Minimum 3s spinner for UX
    setTimeout(() => setVerifyPhase('success'), 3000);
  };

  const takePhoto = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.6 });
      handleCaptureSuccess(`data:image/jpeg;base64,${photo.base64}`);
    } catch {
      handleCaptureSuccess(null);
    }
  };

  const returnToDashboard = () => {
    if (activeTask) setActiveIssues(prev => prev.filter(t => t.id !== activeTask.id));
    setActiveTask(null);
    setCapturedImage(null);
    setVerifyPhase('idle');
    setAssignedSupport(null);
    setAppState(2);
  };

  // ── Screen renderer ────────────────────────────────────────────────────────
  const renderScreen = () => {
    switch (appState) {

      // ── 0: SPLASH ───────────────────────────────────────────────────────
      case 0:
        return (
          <View style={s.splashRoot}>
            <View style={s.logoRow}>
              <Text style={s.logoText}>CIVIX</Text>
              <View style={s.logoDot} />
            </View>
            <Text style={s.logoSub}>FIELD OPERATIONS</Text>
            <ActivityIndicator size="large" color={T.accent} style={{ marginTop: 40 }} />
            <Text style={s.splashHint}>Initializing secure connection…</Text>
          </View>
        );

      // ── 1: LOGIN ─────────────────────────────────────────────────────────
      case 1:
        return <LoginScreen onLogin={handleLogin} />;

      // ── 2: DASHBOARD ─────────────────────────────────────────────────────
      case 2:
        return (
          <SafeAreaView style={{ flex: 1, backgroundColor: T.bg }}>
            {/* Header */}
            <View style={s.header}>
              <TouchableOpacity onPress={() => setMenuOpen(true)} hitSlop={HIT}>
                <View style={s.ham}>
                  <View style={s.hamLine} />
                  <View style={[s.hamLine, { width: 16 }]} />
                  <View style={s.hamLine} />
                </View>
              </TouchableOpacity>
              <Text style={s.headerTitle}>CIVIX</Text>
              <View style={s.liveRow}>
                <View style={[s.liveDot, backendStatus === 'ok' ? {} : { backgroundColor: backendStatus === 'offline' ? T.danger : '#D1D5DB' }]} />
                <Text style={[s.liveText, backendStatus === 'ok' ? {} : { color: backendStatus === 'offline' ? T.danger : '#D1D5DB' }]}>
                  {backendStatus === 'ok' ? 'LIVE' : backendStatus === 'offline' ? 'OFFLINE' : '...'}
                </Text>
              </View>
            </View>

            {/* Section label */}
            <View style={s.sectionRow}>
              <Text style={s.sectionLabel}>AWAITING DISPATCHES ({dispatches.length})</Text>
              <View style={s.roleBadge}>
                <Text style={s.roleBadgeText}>🏛 {officerRole.toUpperCase()}</Text>
              </View>
            </View>

            {/* Dispatch list — real data from PostgreSQL */}
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 16 }}>
              {loadingTasks ? (
                <View style={{ alignItems: 'center', paddingTop: 40 }}>
                  <ActivityIndicator size="large" color={T.accent} />
                  <Text style={{ color: T.textSecondary, marginTop: 12, fontSize: 13 }}>Loading assignments…</Text>
                </View>
              ) : dispatches.length === 0 ? (
                <View style={{ alignItems: 'center', paddingTop: 40 }}>
                  <Text style={{ fontSize: 40, marginBottom: 12 }}>✅</Text>
                  <Text style={{ color: T.text, fontSize: 16, fontWeight: '700' }}>All Clear</Text>
                  <Text style={{ color: T.textSecondary, fontSize: 13, marginTop: 4 }}>No pending dispatches assigned.</Text>
                </View>
              ) : (
                dispatches.map(d => (
                  <DispatchCard key={d.id} d={d} onAccept={() => acceptDispatch(d)} />
                ))
              )}
            </ScrollView>

            {/* Bottom bar */}
            <View style={s.bottomBar}>
              <TouchableOpacity style={s.recentBtn} onPress={() => setAppState(3)} activeOpacity={0.85}>
                <Text style={s.recentBtnText}>📋  RECENT ISSUES</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.offDutyBtn} onPress={() => { setHasGoneOnDuty(false); setAppState(1); }} activeOpacity={0.85}>
                <Text style={s.offDutyBtnText}>GO OFF DUTY</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        );

      // ── 3: ACTIVE TASK ───────────────────────────────────────────────────
      case 3:
        return (
          <SafeAreaView style={{ flex: 1, backgroundColor: T.bg }}>
            {/* Header with back */}
            <View style={s.header}>
              <TouchableOpacity onPress={() => setAppState(2)} hitSlop={HIT} style={s.backBtn}>
                <Text style={s.backArrow}>←</Text>
                <Text style={s.backLabel}>Back</Text>
              </TouchableOpacity>
              <Text style={s.headerTitle}>ACTIVE TASK</Text>
              <View style={{ width: 70 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
              {/* Task detail card */}
              {activeTask ? (
                <TaskDetailCard task={activeTask} />
              ) : (
                <View style={s.emptyCard}>
                  <Text style={s.emptyText}>No active task selected.</Text>
                  <Text style={s.emptyHint}>Accept a dispatch from the Dashboard.</Text>
                </View>
              )}

              {supportSent && (
                <View style={s.toastCard}>
                  <Text style={s.toastText}>✅  Support request submitted successfully.</Text>
                </View>
              )}

              {/* Action buttons */}
              <TouchableOpacity
                style={s.dirBtn}
                onPress={() => activeTask && openDirections(activeTask)}
                activeOpacity={0.85}
              >
                <Text style={s.dirBtnText}>🗺  GET DIRECTIONS</Text>
              </TouchableOpacity>

              <TouchableOpacity style={s.supportBtn} onPress={() => setSupportOpen(true)} activeOpacity={0.85}>
                <Text style={s.supportBtnText}>🤝  REQUEST SUPPORT</Text>
              </TouchableOpacity>

              {/* ── Assigned Worker Tab ─────────────────────────────────── */}
              <View style={s.workerTabContainer}>
                <View style={s.workerTabHeader}>
                  <View style={[s.workerTabDot, assignedSupport && s.workerTabDotActive]} />
                  <Text style={s.workerTabTitle}>ASSIGNED WORKER</Text>
                </View>

                {!assignedSupport ? (
                  <View style={s.workerTabEmpty}>
                    <Text style={{ fontSize: 28, marginBottom: 8 }}>👷</Text>
                    <Text style={s.workerTabEmptyText}>No worker assigned yet.</Text>
                    <Text style={s.workerTabEmptyHint}>Tap "Request Support" above to dispatch a worker from the AI swarm.</Text>
                  </View>
                ) : (
                  <View style={s.workerTabBody}>
                    <View style={s.workerTabBadge}>
                      <Text style={s.workerTabBadgeText}>✓  SWARM DISPATCHED</Text>
                    </View>

                    <View style={s.workerTabRow}>
                      <Text style={s.workerTabLabel}>UNIT ID</Text>
                      <Text style={s.workerTabValue}>{assignedSupport.id}</Text>
                    </View>
                    <View style={s.workerTabRow}>
                      <Text style={s.workerTabLabel}>DEPARTMENT</Text>
                      <Text style={s.workerTabValue}>{assignedSupport.dept}</Text>
                    </View>
                    <View style={s.workerTabRow}>
                      <Text style={s.workerTabLabel}>ETA</Text>
                      <Text style={[s.workerTabValue, { color: T.success, fontWeight: '800' }]}>{assignedSupport.eta}</Text>
                    </View>
                    <View style={[s.workerTabRow, { borderBottomWidth: 0 }]}>
                      <Text style={s.workerTabLabel}>STATUS</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: T.success }} />
                        <Text style={[s.workerTabValue, { color: T.success }]}>EN ROUTE</Text>
                      </View>
                    </View>
                  </View>
                )}
              </View>
            </ScrollView>

            {/* TASK COMPLETED — always at bottom */}
            <View style={s.bottomBar}>
              <TouchableOpacity style={s.completedBtn} onPress={handleTaskCompleted} activeOpacity={0.85}>
                <Text style={s.completedBtnText}>✓  TASK COMPLETED</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        );

      // ── 4: VERIFICATION ──────────────────────────────────────────────────
      case 4:
        // ── Web branch: real browser getUserMedia camera ──────────────────
        if (Platform.OS === 'web' && verifyPhase === 'camera') {
          return (
            <WebCameraCapture
              onCapture={(base64Uri) => handleCaptureSuccess(base64Uri)}
              onCancel={() => setVerifyPhase('idle')}
            />
          );
        }

        // ── Native camera (permission flow) ───────────────────────────────
        if (verifyPhase === 'camera') {
          // Permission not yet determined — show loading
          if (!camPerm) {
            return (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: T.bg }}>
                <ActivityIndicator size="large" color={T.accent} />
                <Text style={{ marginTop: 12, color: T.textSecondary, fontSize: 14 }}>Checking camera permissions…</Text>
              </View>
            );
          }

          // Permission denied — prompt user to grant
          if (!camPerm.granted) {
            return (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: T.bg, padding: 32 }}>
                <Text style={{ fontSize: 48, marginBottom: 16 }}>🔒</Text>
                <Text style={{ fontSize: 18, fontWeight: '700', color: T.text, textAlign: 'center', marginBottom: 8 }}>
                  Camera Access Required
                </Text>
                <Text style={{ fontSize: 14, color: T.textSecondary, textAlign: 'center', marginBottom: 28, lineHeight: 20 }}>
                  Civix needs camera access to capture proof-of-resolution photos for incident verification.
                </Text>
                <TouchableOpacity
                  style={[s.completedBtn, { width: '100%' }]}
                  onPress={requestCamPerm}
                  activeOpacity={0.85}
                >
                  <Text style={s.completedBtnText}>GRANT CAMERA PERMISSION</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleCaptureSuccess(null)} style={{ marginTop: 16 }}>
                  <Text style={{ color: T.textSecondary, fontSize: 13 }}>SIMULATE CAPTURE (WEB DEMO)</Text>
                </TouchableOpacity>
              </View>
            );
          }

          // Permission granted — show live CameraView
          return (
            <View style={{ flex: 1, backgroundColor: '#000' }}>
              <CameraView style={{ flex: 1 }} ref={cameraRef} facing="back">
                <View style={s.camOverlay}>
                  <TouchableOpacity style={s.camShutter} onPress={takePhoto} activeOpacity={0.85}>
                    <View style={s.camShutterInner} />
                  </TouchableOpacity>
                </View>
              </CameraView>
            </View>
          );
        }

        // Idle / processing / success
        return (
          <SafeAreaView style={{ flex: 1, backgroundColor: T.bg }}>
            {verifyPhase === 'idle' && (
              <View style={s.header}>
                <TouchableOpacity onPress={() => setAppState(3)} hitSlop={HIT} style={s.backBtn}>
                  <Text style={s.backArrow}>←</Text>
                  <Text style={s.backLabel}>Back</Text>
                </TouchableOpacity>
                <Text style={s.headerTitle}>VERIFICATION</Text>
                <View style={{ width: 70 }} />
              </View>
            )}

            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
              {verifyPhase === 'idle' && (
                <>
                  <View style={s.verifyIconWrap}>
                    <Text style={{ fontSize: 44 }}>📸</Text>
                  </View>
                  <Text style={s.verifyTitle}>Photo Verification Required</Text>
                  <Text style={s.verifyDesc}>
                    Take a live photo to confirm the issue is resolved.{'\n'}
                    This triggers automatic fund release via the AI Swarm.
                  </Text>
                  {activeTask && (
                    <View style={s.taskChip}>
                      <Text style={s.taskChipText} numberOfLines={1}>📌  {activeTask.title}</Text>
                    </View>
                  )}
                  <TouchableOpacity
                    style={[s.completedBtn, { width: '100%', marginTop: 32 }]}
                    onPress={() => setVerifyPhase('camera')}
                    activeOpacity={0.85}
                  >
                    <Text style={s.completedBtnText}>PHOTO VERIFICATION</Text>
                  </TouchableOpacity>
                </>
              )}

              {(verifyPhase === 'processing' || verifyPhase === 'success') && (
                <>
                  {/* Thumbnail */}
                  <View style={s.thumbWrap}>
                    {capturedImage ? (
                      <Image source={{ uri: capturedImage }} style={s.thumb} resizeMode="cover" />
                    ) : (
                      <View style={[s.thumb, { backgroundColor: '#1C1C1E', alignItems: 'center', justifyContent: 'center' }]}>
                        <Text style={{ fontSize: 40 }}>📷</Text>
                      </View>
                    )}
                    {verifyPhase === 'success' && (
                      <View style={s.thumbCheck}><Text style={{ fontSize: 18, color: '#fff', fontWeight: '900' }}>✓</Text></View>
                    )}
                  </View>

                  {verifyPhase === 'processing' && (
                    <>
                      <ActivityIndicator size="large" color={T.accent} style={{ marginBottom: 16 }} />
                      <Text style={s.processingTitle}>AI Swarm Verifying Resolution…</Text>
                      <Text style={s.processingHint}>Analyzing photo, GPS & incident data</Text>
                    </>
                  )}

                  {verifyPhase === 'success' && (
                    <View style={{ alignItems: 'center', width: '100%' }}>
                      <Text style={{ fontSize: 38, marginBottom: 10 }}>✅</Text>
                      <Text style={s.successTitle}>Verification Successful</Text>
                      <Text style={s.successSub}>Funds Released</Text>
                      <View style={s.successCard}>
                        <Text style={s.successCardText}>
                          AI Swarm confirmed the resolution. Incident closed and payment processed automatically.
                        </Text>
                      </View>
                      <TouchableOpacity style={[s.completedBtn, { width: '100%' }]} onPress={returnToDashboard} activeOpacity={0.85}>
                        <Text style={s.completedBtnText}>RETURN TO DASHBOARD</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}
            </View>
          </SafeAreaView>
        );

      default:
        return null;
    }
  };

  // ── Root render — position:relative container traps all overlays ───────────
  return (
    <PhoneFrame>
      <SafeAreaView style={s.root}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        {renderScreen()}

        {/* ── GO ON DUTY overlay (Dashboard only, shown once per session) ────── */}
        {appState === 2 && dutyOverlay && !hasGoneOnDuty && (
          <View style={s.overlayBg}>
            <View style={s.overlayCard}>
              <View style={s.logoRow}>
                <Text style={s.logoText}>CIVIX</Text>
                <View style={s.logoDot} />
              </View>
              <Text style={s.logoSub}>Field Operations Ready</Text>
              <View style={{ height: 1, backgroundColor: T.border, marginVertical: 14 }} />
              <InfoRow label="OFFICER ID"  value={officerId} />
              <InfoRow label="NAME"        value={officerName} />
              <InfoRow label="ROLE"        value={officerRole} />
              <InfoRow label="DEPARTMENT"  value="Field Operations" />
              <TouchableOpacity style={s.dutyBtn} onPress={() => { setDutyOverlay(false); setHasGoneOnDuty(true); }} activeOpacity={0.85}>
                <Text style={s.dutyBtnText}>GO ON DUTY</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── HAMBURGER DRAWER (Dashboard only) ──────────────────────────── */}
        {appState === 2 && menuOpen && (
          <>
            <TouchableOpacity style={s.drawerDim} onPress={() => setMenuOpen(false)} activeOpacity={1} />
            <View style={s.drawer}>
              <View style={s.drawerHandle} />
              <Text style={s.drawerTitle}>Officer Profile</Text>
              <InfoRow label="OFFICER ID"  value={officerId} />
              <InfoRow label="NAME"        value={officerName} />
              <InfoRow label="ROLE"        value={officerRole} />
              <InfoRow label="DEPARTMENT"  value="Field Operations" />
              <InfoRow label="SHIFT"       value="07:00 — 19:00" />
              <InfoRow label="STATUS"      value="ON DUTY" valueColor={T.success} />
              <TouchableOpacity style={s.drawerCloseBtn} onPress={() => setMenuOpen(false)} activeOpacity={0.85}>
                <Text style={s.drawerCloseBtnText}>CLOSE</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ── SUPPORT REQUEST overlay (Active Task only) ──────────────────── */}
        {appState === 3 && supportOpen && (
          <View style={s.overlayBg}>
            <View style={s.overlayCard}>
              <Text style={s.supportModalTitle}>Request Cross-Dept Support</Text>
              <Text style={s.supportModalSub}>Describe why support is needed:</Text>
              <TextInput
                style={s.supportInput}
                multiline
                numberOfLines={4}
                placeholder="e.g. Need electrical crew to isolate live cable before road repair..."
                placeholderTextColor={T.textSecondary}
                value={supportText}
                onChangeText={setSupportText}
              />
              {/* Department chip selector */}
              <Text style={s.chipLabel}>SELECT DEPARTMENT</Text>
              <View style={s.chipRow}>
                {DEPARTMENTS.map(dept => {
                  const active = selectedDept === dept;
                  return (
                    <TouchableOpacity
                      key={dept}
                      style={[s.chip, active && s.chipActive]}
                      onPress={() => setSelectedDept(dept)}
                      activeOpacity={0.8}
                    >
                      <Text style={[s.chipText, active && s.chipTextActive]}>{dept}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {/* Submit disabled until a dept chip is selected */}
              <TouchableOpacity
                style={[s.submitBtn, !selectedDept && s.submitBtnDisabled]}
                onPress={selectedDept ? submitSupport : undefined}
                activeOpacity={selectedDept ? 0.85 : 1}
              >
                <Text style={s.submitBtnText}>
                  {selectedDept ? `SUBMIT TO ${selectedDept.toUpperCase()}` : 'SELECT A DEPARTMENT FIRST'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { setSupportOpen(false); setSelectedDept(null); }}
                style={{ marginTop: 12, alignItems: 'center' }}
              >
                <Text style={{ color: T.textSecondary, fontSize: 13 }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </SafeAreaView>
    </PhoneFrame>
  );
}

// ─── SHARED HIT SLOP ──────────────────────────────────────────────────────────
const HIT = { top: 12, bottom: 12, left: 12, right: 12 };

// ─── REUSABLE SUB-COMPONENTS ──────────────────────────────────────────────────

function InfoRow({ label, value, valueColor }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' }}>
      <Text style={{ fontSize: 11, fontWeight: '600', color: T.textSecondary, letterSpacing: 1.5 }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: '700', color: valueColor || T.text }}>{value}</Text>
    </View>
  );
}

function LoginScreen({ onLogin }) {
  const [officerId, setOfficerId] = useState('');
  const [pin, setPin]             = useState('');
  return (
    <View style={s.loginRoot}>
      <View style={s.loginCard}>
        <View style={[s.logoRow, { marginBottom: 2 }]}>
          <Text style={s.logoText}>CIVIX</Text>
          <View style={s.logoDot} />
        </View>
        <Text style={s.loginSubBrand}>COMMAND CENTER</Text>
        <Text style={s.loginHeading}>Official Administrator Login</Text>
        <Text style={s.loginFieldLabel}>OFFICER ID</Text>
        <TextInput
          style={s.loginInput}
          placeholder="e.g. OP-101"
          placeholderTextColor="#9CA3AF"
          value={officerId}
          onChangeText={setOfficerId}
          autoCapitalize="characters"
        />
        <Text style={s.loginFieldLabel}>SECURE PIN</Text>
        <TextInput
          style={s.loginInput}
          placeholder="Enter your PIN"
          placeholderTextColor="#9CA3AF"
          value={pin}
          onChangeText={setPin}
          secureTextEntry
          keyboardType="numeric"
        />
        <TouchableOpacity style={s.loginBtn} onPress={onLogin} activeOpacity={0.88}>
          <Text style={s.loginBtnText}>SECURE LOGIN</Text>
        </TouchableOpacity>
        <Text style={s.loginFootnote}>Restricted Government Access Only. Activity is logged.</Text>
      </View>
    </View>
  );
}

function DispatchCard({ d, onAccept }) {
  const ps = PRI[d.priority] || PRI.MODERATE;
  return (
    <View style={s.dispatchCard}>
      {/* Top row: priority badge + ticket ID + time */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={[s.priBadge, { backgroundColor: ps.bg, borderColor: ps.border }]}>
            <Text style={[s.priText, { color: ps.text }]}>{d.priority}</Text>
          </View>
          <Text style={{ fontSize: 11, color: T.textSecondary, fontWeight: '500' }}>{d.ticketId}</Text>
        </View>
        <Text style={{ fontSize: 12, color: T.textSecondary }}>{d.time}</Text>
      </View>
      <Text style={s.dispatchTitle}>{d.title}</Text>
      <Text style={s.dispatchDesc} numberOfLines={2}>{d.description}</Text>
      {/* Reported-by row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, marginBottom: 12 }}>
        <Text style={{ fontSize: 11, color: T.textSecondary }}>🗣</Text>
        <Text style={{ fontSize: 11, color: T.textSecondary, flex: 1 }} numberOfLines={1}>{d.reportedBy}</Text>
        <View style={{ backgroundColor: '#FEF2F2', borderRadius: 12, paddingHorizontal: 7, paddingVertical: 2 }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: '#DC2626' }}>{d.reportCount} reports</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: T.textSecondary }}>📍  {d.distance}</Text>
        <TouchableOpacity style={s.acceptBtn} onPress={onAccept} activeOpacity={0.85}>
          <Text style={s.acceptBtnText}>ACCEPT</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function TaskDetailCard({ task }) {
  const ps = PRI[task.priority] || PRI.MODERATE;
  return (
    <View style={s.taskCard}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 }}>
        <View style={[s.priBadge, { backgroundColor: ps.bg, borderColor: ps.border }]}>
          <Text style={[s.priText, { color: ps.text }]}>{task.priority}</Text>
        </View>
        <Text style={{ fontSize: 14, fontWeight: '700', color: ps.text, flex: 1 }} numberOfLines={1}>{task.title}</Text>
      </View>
      <Text style={{ fontSize: 14, color: T.textSecondary, lineHeight: 20, marginBottom: 16 }}>{task.description}</Text>
      <View style={{ height: 1, backgroundColor: T.border, marginBottom: 14 }} />
      <Text style={{ fontSize: 11, fontWeight: '700', color: T.textSecondary, letterSpacing: 2.5, marginBottom: 8 }}>🧭  NAVIGATION</Text>
      <Text style={{ fontSize: 17, fontWeight: '700', color: T.text, lineHeight: 24, marginBottom: 16 }}>{task.direction}</Text>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ fontSize: 10, fontWeight: '600', color: T.textSecondary, letterSpacing: 1.5 }}>DISTANCE</Text>
          <Text style={{ fontSize: 16, fontWeight: '800', color: T.text, marginTop: 4 }}>{task.distance}</Text>
        </View>
        <View style={{ width: 1, backgroundColor: T.border }} />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ fontSize: 10, fontWeight: '600', color: T.textSecondary, letterSpacing: 1.5 }}>ETA</Text>
          <Text style={{ fontSize: 16, fontWeight: '800', color: T.text, marginTop: 4 }}>~8 min</Text>
        </View>
        <View style={{ width: 1, backgroundColor: T.border }} />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ fontSize: 10, fontWeight: '600', color: T.textSecondary, letterSpacing: 1.5 }}>STATUS</Text>
          <Text style={{ fontSize: 16, fontWeight: '800', color: T.accent, marginTop: 4 }}>EN ROUTE</Text>
        </View>
      </View>
    </View>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  // Root container — creates bounding box for absolute overlays
  root: { flex: 1, position: 'relative', overflow: 'hidden', backgroundColor: T.bg },

  // ── Splash ──────────────────────────────────────────────────────────────
  splashRoot:   { flex: 1, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  splashHint:   { fontSize: 12, color: '#D1D5DB', marginTop: 18, letterSpacing: 0.3 },

  // ── Logo (reused in Splash, overlays, Login) ─────────────────────────────
  logoRow:  { flexDirection: 'row', alignItems: 'center' },
  logoText: { fontSize: 36, fontWeight: '900', color: T.text, letterSpacing: 7 },
  logoDot:  { width: 9, height: 9, borderRadius: 5, backgroundColor: T.accent, marginLeft: 5, marginTop: 8 },
  logoSub:  { fontSize: 11, fontWeight: '600', color: T.textSecondary, letterSpacing: 3.5, marginTop: 4 },

  // ── Login ────────────────────────────────────────────────────────────────
  loginRoot:       { flex: 1, backgroundColor: '#F9FAFB', alignItems: 'center', justifyContent: 'center', padding: 24 },
  loginCard:       { width: '100%', backgroundColor: T.card, borderRadius: T.radius, padding: 28, ...T.shadowLG },
  loginSubBrand:   { fontSize: 11, fontWeight: '600', color: T.textSecondary, letterSpacing: 4, marginBottom: 18 },
  loginHeading:    { fontSize: 18, fontWeight: '800', color: T.text, marginBottom: 22 },
  loginFieldLabel: { fontSize: 11, fontWeight: '700', color: T.text, letterSpacing: 1.5, marginBottom: 6 },
  loginInput:      { borderWidth: 1, borderColor: T.border, borderRadius: T.radiusSM, paddingHorizontal: 14, paddingVertical: 13, fontSize: 14, color: T.text, backgroundColor: '#F9FAFB', marginBottom: 16 },
  loginBtn:        { backgroundColor: '#1E3A5F', borderRadius: T.radiusSM, paddingVertical: 18, alignItems: 'center', marginTop: 8, ...T.shadow },
  loginBtnText:    { color: '#FFFFFF', fontWeight: '800', fontSize: 15, letterSpacing: 2.5 },
  loginFootnote:   { fontSize: 11, color: '#9CA3AF', textAlign: 'center', marginTop: 20 },

  // ── App Header (shared) ──────────────────────────────────────────────────
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F1F3F4' },
  backBtn:     { flexDirection: 'row', alignItems: 'center' },
  backArrow:   { fontSize: 22, color: T.accent, fontWeight: '700', marginRight: 4 },
  backLabel:   { fontSize: 14, color: T.accent, fontWeight: '600' },
  headerTitle: { fontSize: 13, fontWeight: '800', color: T.text, letterSpacing: 2 },
  ham:         { gap: 4, paddingVertical: 2 },
  hamLine:     { width: 22, height: 2, borderRadius: 1, backgroundColor: T.text },
  liveRow:     { flexDirection: 'row', alignItems: 'center', gap: 5 },
  liveDot:     { width: 8, height: 8, borderRadius: 4, backgroundColor: T.success },
  liveText:    { fontSize: 11, fontWeight: '700', color: T.success, letterSpacing: 1 },

  // ── Dashboard ────────────────────────────────────────────────────────────
  sectionRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  sectionLabel:   { fontSize: 11, fontWeight: '700', color: T.textSecondary, letterSpacing: 2.5 },
  roleBadge:      { backgroundColor: '#FFF7ED', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#FED7AA' },
  roleBadgeText:  { fontSize: 11, fontWeight: '700', color: '#92400E' },
  bottomBar:      { backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#F1F3F4', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20, gap: 10 },
  recentBtn:      { backgroundColor: '#F3F4F6', borderRadius: T.radiusSM, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: T.border },
  recentBtnText:  { fontSize: 13, fontWeight: '700', color: T.text, letterSpacing: 1 },
  offDutyBtn:     { backgroundColor: '#1F2937', borderRadius: T.radiusSM, paddingVertical: 18, alignItems: 'center' },
  offDutyBtnText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF', letterSpacing: 2 },

  // ── Dispatch card ────────────────────────────────────────────────────────
  dispatchCard:  { backgroundColor: T.card, borderRadius: T.radius, padding: 16, marginBottom: 12, ...T.shadow },
  priBadge:      { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1 },
  priText:       { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  dispatchTitle: { fontSize: 15, fontWeight: '800', color: T.text, marginBottom: 6 },
  dispatchDesc:  { fontSize: 13, color: T.textSecondary, lineHeight: 19 },
  acceptBtn:     { backgroundColor: T.accent, borderRadius: T.radiusSM, paddingHorizontal: 18, paddingVertical: 10 },
  acceptBtnText: { fontSize: 13, fontWeight: '800', color: T.white, letterSpacing: 1 },

  // ── Active task card ─────────────────────────────────────────────────────
  taskCard:      { backgroundColor: T.card, borderRadius: T.radius, padding: 20, marginBottom: 16, ...T.shadowLG },
  emptyCard:     { backgroundColor: T.card, borderRadius: T.radius, padding: 28, alignItems: 'center', marginBottom: 16, ...T.shadow },
  emptyText:     { fontSize: 16, fontWeight: '700', color: T.text, marginBottom: 8 },
  emptyHint:     { fontSize: 13, color: T.textSecondary, textAlign: 'center' },
  toastCard:     { backgroundColor: '#ECFDF5', borderRadius: T.radiusSM, padding: 14, marginBottom: 16, borderLeftWidth: 4, borderLeftColor: T.success },
  toastText:     { fontSize: 13, color: '#065F46', fontWeight: '600' },
  dirBtn:        { backgroundColor: T.card, borderRadius: T.radiusSM, paddingVertical: 16, alignItems: 'center', marginBottom: 12, borderWidth: 1.5, borderColor: T.accent, ...T.shadow },
  dirBtnText:    { fontSize: 14, fontWeight: '700', color: T.accent, letterSpacing: 1 },
  supportBtn:    { backgroundColor: '#FFFBEB', borderRadius: T.radiusSM, paddingVertical: 16, alignItems: 'center', marginBottom: 12, borderWidth: 1.5, borderColor: '#FCD34D' },
  supportBtnText:{ fontSize: 14, fontWeight: '700', color: '#92400E', letterSpacing: 1 },
  completedBtn:  { backgroundColor: T.success, borderRadius: T.radiusSM, paddingVertical: 20, alignItems: 'center', ...T.shadow },
  completedBtnText:{ fontSize: 16, fontWeight: '800', color: T.white, letterSpacing: 2 },

  // ── Verification ─────────────────────────────────────────────────────────
  verifyIconWrap:  { width: 100, height: 100, borderRadius: 50, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', marginBottom: 22, borderWidth: 2, borderColor: '#BFDBFE' },
  verifyTitle:     { fontSize: 20, fontWeight: '800', color: T.text, textAlign: 'center', marginBottom: 12 },
  verifyDesc:      { fontSize: 14, color: T.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 16 },
  taskChip:        { backgroundColor: '#F3F4F6', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6, borderWidth: 1, borderColor: T.border },
  taskChipText:    { fontSize: 12, fontWeight: '600', color: T.text, maxWidth: 240 },
  thumbWrap:       { position: 'relative', marginBottom: 28 },
  thumb:           { width: 160, height: 160, borderRadius: T.radius, ...T.shadowLG },
  thumbCheck:      { position: 'absolute', bottom: -14, right: -14, width: 44, height: 44, borderRadius: 22, backgroundColor: T.success, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#FFF' },
  processingTitle: { fontSize: 16, fontWeight: '700', color: T.text, textAlign: 'center', marginBottom: 8 },
  processingHint:  { fontSize: 13, color: T.textSecondary, textAlign: 'center' },
  successTitle:    { fontSize: 22, fontWeight: '900', color: T.text, marginBottom: 4 },
  successSub:      { fontSize: 16, fontWeight: '700', color: T.success, marginBottom: 20 },
  successCard:     { backgroundColor: '#ECFDF5', borderRadius: T.radiusSM, padding: 16, width: '100%', borderLeftWidth: 4, borderLeftColor: T.success, marginBottom: 24 },
  successCardText: { fontSize: 13, color: '#065F46', lineHeight: 20 },

  // ── Camera ───────────────────────────────────────────────────────────────
  camOverlay:      { flex: 1, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 50 },
  camShutter:      { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#FFF' },
  camShutterInner: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#FFFFFF' },
  camFallback:     { flex: 1, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center', padding: 32 },
  camFallbackFrame:{ width: 240, height: 300, borderColor: 'rgba(255,255,255,0.3)', borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 32, position: 'relative' },
  camCornerTL:     { position: 'absolute', top: -2, left: -2, width: 24, height: 24, borderTopWidth: 3, borderLeftWidth: 3, borderColor: '#FFFFFF' },
  camCornerTR:     { position: 'absolute', top: -2, right: -2, width: 24, height: 24, borderTopWidth: 3, borderRightWidth: 3, borderColor: '#FFFFFF' },
  camCornerBL:     { position: 'absolute', bottom: -2, left: -2, width: 24, height: 24, borderBottomWidth: 3, borderLeftWidth: 3, borderColor: '#FFFFFF' },
  camCornerBR:     { position: 'absolute', bottom: -2, right: -2, width: 24, height: 24, borderBottomWidth: 3, borderRightWidth: 3, borderColor: '#FFFFFF' },
  camFallbackIcon: { fontSize: 48, marginBottom: 12 },
  camFallbackText: { fontSize: 14, color: 'rgba(255,255,255,0.6)', textAlign: 'center' },
  simBtn:          { backgroundColor: T.accent, borderRadius: T.radiusSM, paddingHorizontal: 24, paddingVertical: 16, alignItems: 'center' },
  simBtnText:      { fontSize: 13, fontWeight: '800', color: '#FFF', letterSpacing: 1.5 },

  // ── Absolute overlays (duty modal, drawer, support) ───────────────────────
  overlayBg:         { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 200 },
  overlayCard:       { width: '100%', backgroundColor: T.card, borderRadius: T.radius, padding: 28, ...T.shadowLG },
  dutyBtn:           { backgroundColor: T.success, borderRadius: T.radiusSM, paddingVertical: 20, alignItems: 'center', marginTop: 24, ...T.shadow },
  dutyBtnText:       { color: T.white, fontWeight: '800', fontSize: 16, letterSpacing: 2.5 },
  drawerDim:         { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 100 },
  drawer:            { position: 'absolute', top: 0, bottom: 0, left: 0, width: '75%', backgroundColor: T.card, zIndex: 101, padding: 24, paddingTop: 52, shadowColor: '#000', shadowOffset: { width: 6, height: 0 }, shadowOpacity: 0.18, shadowRadius: 20, elevation: 20 },
  drawerHandle:      { width: 40, height: 4, borderRadius: 2, backgroundColor: T.border, alignSelf: 'center', marginBottom: 24 },
  drawerTitle:       { fontSize: 20, fontWeight: '800', color: T.text, marginBottom: 16 },
  drawerCloseBtn:    { backgroundColor: '#F3F4F6', borderRadius: T.radiusSM, paddingVertical: 14, alignItems: 'center', marginTop: 24 },
  drawerCloseBtnText:{ fontWeight: '700', fontSize: 14, color: T.text },

  // ── Support request overlay ───────────────────────────────────────────────
  supportModalTitle: { fontSize: 18, fontWeight: '800', color: T.text, marginBottom: 6 },
  supportModalSub:   { fontSize: 13, color: T.textSecondary, marginBottom: 12 },
  supportInput:      { borderWidth: 1, borderColor: T.border, borderRadius: T.radiusSM, padding: 12, fontSize: 13, color: T.text, minHeight: 90, textAlignVertical: 'top', backgroundColor: '#F9FAFB', marginBottom: 14 },
  // Department chip selector (replaces old deptSelector placeholder)
  chipLabel:         { fontSize: 11, fontWeight: '700', color: T.text, letterSpacing: 1.5, marginBottom: 10 },
  chipRow:           { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  chip:              { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: T.border, backgroundColor: '#F9FAFB' },
  chipActive:        { backgroundColor: T.accent, borderColor: T.accent },
  chipText:          { fontSize: 12, fontWeight: '600', color: T.text },
  chipTextActive:    { color: '#FFFFFF' },
  submitBtn:         { backgroundColor: T.accent, borderRadius: T.radiusSM, paddingVertical: 16, alignItems: 'center' },
  submitBtnDisabled: { backgroundColor: '#D1D5DB' },
  submitBtnText:     { fontSize: 13, fontWeight: '800', color: T.white, letterSpacing: 1.2 },

  // ── Assigned support card (Fix 3) ─────────────────────────────────────────
  assignedCard: {
    marginTop: 12,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 12,
    padding: 14,
  },
  assignedTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1D4ED8',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  assignedBody: {
    fontSize: 14,
    color: '#1E3A5F',
    lineHeight: 22,
  },

  // ── Assigned Worker Tab ──────────────────────────────────────────────────
  workerTabContainer: {
    backgroundColor: T.card,
    borderRadius: T.radius,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: T.border,
    overflow: 'hidden',
    ...T.shadow,
  },
  workerTabHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
    backgroundColor: '#FAFAFA',
  },
  workerTabDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D1D5DB',
  },
  workerTabDotActive: {
    backgroundColor: T.success,
  },
  workerTabTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: T.text,
    letterSpacing: 2,
  },
  workerTabEmpty: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  workerTabEmptyText: {
    fontSize: 14,
    fontWeight: '600',
    color: T.textSecondary,
  },
  workerTabEmptyHint: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  workerTabBody: {
    padding: 16,
  },
  workerTabBadge: {
    backgroundColor: '#ECFDF5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  workerTabBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
    letterSpacing: 0.5,
  },
  workerTabRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  workerTabLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: T.textSecondary,
    letterSpacing: 1.5,
  },
  workerTabValue: {
    fontSize: 14,
    fontWeight: '700',
    color: T.text,
  },
});

// ─── Web-only live camera using browser getUserMedia ─────────────────────
// Renders a <video> preview and captures a still via <canvas.toDataURL>.
// Only mounts when Platform.OS === 'web'.
function WebCameraCapture({ onCapture, onCancel }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState(null);
  const [ready, setReady] = useState(false);
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setError('Browser does not support camera access.');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play().then(() => setReady(true)).catch(() => setReady(true));
          };
        }
      } catch (e) {
        setError(e?.message || 'Camera permission denied.');
      }
    }
    start();
    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const snap = () => {
    if (!videoRef.current || !canvasRef.current || capturing) return;
    setCapturing(true);
    const v = videoRef.current;
    const c = canvasRef.current;
    c.width = v.videoWidth || 640;
    c.height = v.videoHeight || 480;
    const ctx = c.getContext('2d');
    ctx.drawImage(v, 0, 0, c.width, c.height);
    const dataUrl = c.toDataURL('image/jpeg', 0.7);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    onCapture(dataUrl);
  };

  // Fallback UI — permission denied / unsupported
  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ fontSize: 40, marginBottom: 12 }}>📷</Text>
        <Text style={{ color: '#fff', fontSize: 15, textAlign: 'center', marginBottom: 4 }}>
          Camera unavailable
        </Text>
        <Text style={{ color: '#aaa', fontSize: 12, textAlign: 'center', marginBottom: 22 }}>
          {error}
        </Text>
        <TouchableOpacity
          style={{ backgroundColor: T.accent, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 8, marginBottom: 10 }}
          onPress={() => onCapture(null)}
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13, letterSpacing: 1 }}>
            SIMULATE CAPTURE
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onCancel}>
          <Text style={{ color: '#888', fontSize: 12 }}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000', position: 'relative' }}>
      {/* React Native Web passes any element via "dangerouslySetInnerHTML"-style
          escape hatch — so we drop directly to DOM via createElement in web. */}
      {Platform.OS === 'web' && React.createElement('video', {
        ref: videoRef,
        autoPlay: true,
        playsInline: true,
        muted: true,
        style: {
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          background: '#000',
        },
      })}
      {Platform.OS === 'web' && React.createElement('canvas', {
        ref: canvasRef,
        style: { display: 'none' },
      })}

      {!ready && (
        <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={{ color: '#fff', marginTop: 10, fontSize: 12 }}>Starting camera…</Text>
        </View>
      )}

      {/* Shutter button + cancel */}
      <View style={{ position: 'absolute', bottom: 28, left: 0, right: 0, alignItems: 'center' }}>
        <TouchableOpacity onPress={snap} disabled={!ready || capturing} activeOpacity={0.85}
          style={{
            width: 72, height: 72, borderRadius: 36, backgroundColor: '#fff',
            borderWidth: 4, borderColor: 'rgba(255,255,255,0.5)', alignItems: 'center', justifyContent: 'center',
            opacity: ready ? 1 : 0.4,
          }}
        >
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: capturing ? '#aaa' : '#fff', borderWidth: 2, borderColor: '#000' }} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onCancel} style={{ marginTop: 14 }}>
          <Text style={{ color: '#fff', fontSize: 12, letterSpacing: 1 }}>CANCEL</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
