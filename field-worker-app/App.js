/**
 * App.js — Civix Field Worker
 * ============================
 * 5-state linear demo flow:
 *   SPLASH → DASHBOARD → RECENT_ISSUES → ACTIVE_TASK → VERIFICATION
 *
 * All screens live in this file as inline sub-components.
 * CameraScreen is kept separate for isolation.
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, StatusBar, Modal, ScrollView,
  ActivityIndicator, Image, Platform,
} from 'react-native';
import { useCameraPermissions } from 'expo-camera';
import { T } from './constants/theme';
import CameraScreen from './components/CameraScreen';
import PhoneFrame   from './components/PhoneFrame';

// ─── CONFIG ────────────────────────────────────────────────────────────────
const OFFICER_ID   = 'OP-441';
const OFFICER_ROLE = 'Road Infrastructure';

// ─── APP STATES ────────────────────────────────────────────────────────────
const STATES = {
  SPLASH:        'SPLASH',
  DASHBOARD:     'DASHBOARD',
  RECENT_ISSUES: 'RECENT_ISSUES',
  ACTIVE_TASK:   'ACTIVE_TASK',
  VERIFICATION:  'VERIFICATION',
};

// ─── MOCK DATA — role-filtered for Road Worker (OP-441) ────────────────────
const ROAD_DISPATCHES = [
  {
    id: 'rd-001',
    title: 'Pothole Collapse — NH65',
    description: 'Large pothole collapse near Tolichowki flyover. 3 vehicles damaged. Peak-hour traffic building rapidly.',
    direction: 'Proceed 1.2km North on NH-65 to Tolichowki Flyover Junction',
    distance: '1.2 km',
    priority: 'HIGH',
    time: '08:30',
  },
  {
    id: 'rd-002',
    title: 'Road Flooding — Sector 7',
    description: 'Storm water overflow across Sector 7 main road. Multiple vehicles stalled. Emergency diversion needed immediately.',
    direction: 'Proceed 0.8km South-West to Sector 7 Junction, Banjara Hills',
    distance: '0.8 km',
    priority: 'CRITICAL',
    time: '09:15',
  },
  {
    id: 'rd-003',
    title: 'Fallen Tree — Main Boulevard',
    description: "Large tree blocking both lanes after last night's rain. Emergency diversion setup required.",
    direction: 'Proceed 2.4km East on Main Boulevard towards Jubilee Hills Check Post',
    distance: '2.4 km',
    priority: 'MODERATE',
    time: '09:48',
  },
  {
    id: 'rd-004',
    title: 'Damaged Road Divider — Ring Road',
    description: 'Concrete divider partially collapsed after vehicle collision. Oncoming traffic at risk.',
    direction: 'Proceed 3.1km North on Outer Ring Road, Exit 14-B near Kondapur',
    distance: '3.1 km',
    priority: 'MODERATE',
    time: '10:20',
  },
];

const INITIAL_ACTIVE = [
  {
    id: 'ai-001',
    title: 'Road Barrier — Hitech City',
    description: 'Safety barrier fallen across IT corridor road. Multiple vehicles slowed.',
    direction: 'Proceed 4.0km West on Hitech City Main Road to Cybergate Junction',
    distance: '4.0 km',
    status: 'EN_ROUTE',
    acceptedAt: '07:50',
    priority: 'MODERATE',
  },
  {
    id: 'ai-002',
    title: 'Waterlogging — Jubilee Hills Rd 45',
    description: 'Severe waterlogging on Road 45, Jubilee Hills. Blocking residential traffic.',
    direction: 'Proceed 2.1km North-East to Road 45, Jubilee Hills near Hotel Taj',
    distance: '2.1 km',
    status: 'PENDING',
    acceptedAt: '08:10',
    priority: 'HIGH',
  },
];

// Priority badge colour map
const PRI = {
  CRITICAL: { bg: '#FEF2F2', text: '#DC2626', border: '#FCA5A5' },
  HIGH:     { bg: '#FFFBEB', text: '#D97706', border: '#FCD34D' },
  MODERATE: { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' },
  LOW:      { bg: '#F0FDF4', text: '#16A34A', border: '#BBF7D0' },
};

// ─────────────────────────────────────────────────────────────────────────────
// ROOT COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [appState,      setAppState]      = useState(STATES.SPLASH);
  const [dutyModal,     setDutyModal]     = useState(false);
  const [menuVisible,   setMenuVisible]   = useState(false);
  const [activeIssues,  setActiveIssues]  = useState(INITIAL_ACTIVE);
  const [selectedTask,  setSelectedTask]  = useState(null);
  // verifyPhase: 'idle' | 'camera' | 'processing' | 'success'
  const [verifyPhase,   setVerifyPhase]   = useState('idle');
  const [capturedImage, setCapturedImage] = useState(null);

  const [camPerm, requestCamPerm] = useCameraPermissions();

  // ── Splash auto-advance ───────────────────────────────────────────────────
  useEffect(() => {
    if (appState !== STATES.SPLASH) return;
    const t = setTimeout(() => {
      setAppState(STATES.DASHBOARD);
      setDutyModal(true);
    }, 2500);
    return () => clearTimeout(t);
  }, [appState]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const goOnDuty = () => setDutyModal(false);

  const acceptDispatch = (dispatch) => {
    const now = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    setActiveIssues(prev => [{ ...dispatch, status: 'EN_ROUTE', acceptedAt: now }, ...prev]);
    setAppState(STATES.RECENT_ISSUES);
  };

  const selectTask = (task) => {
    setSelectedTask(task);
    setVerifyPhase('idle');
    setCapturedImage(null);
    setAppState(STATES.ACTIVE_TASK);
  };

  const taskCompleted = async () => {
    if (Platform.OS !== 'web' && !camPerm?.granted) await requestCamPerm();
    setAppState(STATES.VERIFICATION);
  };

  // Called by CameraScreen with base64 string (or null on web demo)
  const handlePhotoCapture = (base64) => {
    setCapturedImage(base64);
    setVerifyPhase('processing');
    setTimeout(() => setVerifyPhase('success'), 3000);
  };

  const returnToDashboard = () => {
    if (selectedTask) setActiveIssues(p => p.filter(t => t.id !== selectedTask.id));
    setSelectedTask(null);
    setCapturedImage(null);
    setVerifyPhase('idle');
    setAppState(STATES.DASHBOARD);
  };

  const goBack = () => {
    // Block back navigation during AI processing / success
    if (appState === STATES.VERIFICATION && verifyPhase !== 'idle') return;
    const map = {
      [STATES.RECENT_ISSUES]: STATES.DASHBOARD,
      [STATES.ACTIVE_TASK]:   STATES.RECENT_ISSUES,
      [STATES.VERIFICATION]:  STATES.ACTIVE_TASK,
    };
    setAppState(map[appState] ?? STATES.DASHBOARD);
  };

  // ── Screen renderer ───────────────────────────────────────────────────────
  const renderScreen = () => {
    switch (appState) {

      case STATES.SPLASH:
        return <SplashScreen />;

      case STATES.DASHBOARD:
        return (
          <DashboardScreen
            dispatches={ROAD_DISPATCHES}
            dutyModal={dutyModal}
            menuVisible={menuVisible}
            onGoOnDuty={goOnDuty}
            onAccept={acceptDispatch}
            onRecentIssues={() => setAppState(STATES.RECENT_ISSUES)}
            onGoOffDuty={() => setAppState(STATES.SPLASH)}
            onMenuOpen={() => setMenuVisible(true)}
            onMenuClose={() => setMenuVisible(false)}
          />
        );

      case STATES.RECENT_ISSUES:
        return (
          <RecentIssuesScreen
            tasks={activeIssues}
            onSelect={selectTask}
            onBack={goBack}
          />
        );

      case STATES.ACTIVE_TASK:
        return (
          <ActiveTaskScreen
            task={selectedTask}
            onCompleted={taskCompleted}
            onBack={goBack}
          />
        );

      case STATES.VERIFICATION:
        if (verifyPhase === 'camera')
          return (
            <CameraScreen
              onCapture={handlePhotoCapture}
              onClose={() => setVerifyPhase('idle')}
            />
          );
        return (
          <VerificationScreen
            phase={verifyPhase}
            capturedImage={capturedImage}
            taskTitle={selectedTask?.title}
            onOpenCamera={() => setVerifyPhase('camera')}
            onReturn={returnToDashboard}
            onBack={goBack}
          />
        );

      default:
        return <SplashScreen />;
    }
  };

  return (
    <PhoneFrame>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      {renderScreen()}
    </PhoneFrame>
  );
}


// ═════════════════════════════════════════════════════════════════════════════
// SCREEN: SPLASH
// ═════════════════════════════════════════════════════════════════════════════
function SplashScreen() {
  return (
    <View style={spl.root}>
      <View style={spl.logoWrap}>
        <View style={spl.logoRow}>
          <Text style={spl.logo}>CIVIX</Text>
          <View style={spl.dot} />
        </View>
        <Text style={spl.sub}>FIELD OPERATIONS</Text>
      </View>
      <ActivityIndicator size="large" color={T.accent} />
      <Text style={spl.hint}>Initializing secure connection…</Text>
    </View>
  );
}
const spl = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  logoWrap:{ alignItems: 'center', marginBottom: 48 },
  logoRow: { flexDirection: 'row', alignItems: 'center' },
  logo:    { fontSize: 44, fontWeight: '900', color: T.text, letterSpacing: 8 },
  dot:     { width: 10, height: 10, borderRadius: 5, backgroundColor: T.accent, marginLeft: 6, marginTop: 10 },
  sub:     { fontSize: 11, fontWeight: '600', color: T.textSecondary, letterSpacing: 4, marginTop: 8 },
  hint:    { fontSize: 12, color: '#D1D5DB', marginTop: 20, letterSpacing: 0.3 },
});


// ═════════════════════════════════════════════════════════════════════════════
// SHARED: AppHeader
// ═════════════════════════════════════════════════════════════════════════════
function AppHeader({ title, onBack, right }) {
  return (
    <View style={hdr.bar}>
      {onBack ? (
        <TouchableOpacity onPress={onBack} style={hdr.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={hdr.arrow}>←</Text>
          <Text style={hdr.backLabel}>Back</Text>
        </TouchableOpacity>
      ) : <View style={hdr.side} />}
      <Text style={hdr.title}>{title}</Text>
      <View style={hdr.side}>{right || null}</View>
    </View>
  );
}
const hdr = StyleSheet.create({
  bar:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F1F3F4' },
  backBtn:  { flexDirection: 'row', alignItems: 'center' },
  arrow:    { fontSize: 22, color: T.accent, fontWeight: '700', marginRight: 4 },
  backLabel:{ fontSize: 14, color: T.accent, fontWeight: '600' },
  title:    { fontSize: 13, fontWeight: '800', color: T.text, letterSpacing: 2 },
  side:     { width: 70 },
});


// ═════════════════════════════════════════════════════════════════════════════
// SHARED: InfoRow (used in modals)
// ═════════════════════════════════════════════════════════════════════════════
function InfoRow({ label, value, valueColor }) {
  return (
    <View style={ir.row}>
      <Text style={ir.label}>{label}</Text>
      <Text style={[ir.value, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </View>
  );
}
const ir = StyleSheet.create({
  row:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  label: { fontSize: 11, fontWeight: '600', color: T.textSecondary, letterSpacing: 1.5 },
  value: { fontSize: 13, fontWeight: '700', color: T.text },
});


// ═════════════════════════════════════════════════════════════════════════════
// SCREEN: DASHBOARD
// ═════════════════════════════════════════════════════════════════════════════
function DashboardScreen({
  dispatches, dutyModal, menuVisible,
  onGoOnDuty, onAccept, onRecentIssues, onGoOffDuty, onMenuOpen, onMenuClose,
}) {
  return (
    <SafeAreaView style={dsh.root}>

      {/* ── GO ON DUTY MODAL ──────────────────────────────────────────── */}
      <Modal visible={dutyModal} transparent animationType="fade">
        <View style={dsh.modalOverlay}>
          <View style={dsh.modalCard}>
            <View style={dsh.mLogoRow}>
              <Text style={dsh.mLogo}>CIVIX</Text>
              <View style={dsh.mLogoDot} />
            </View>
            <Text style={dsh.mSub}>Field Operations Ready</Text>
            <View style={dsh.mDivider} />
            <InfoRow label="OFFICER ID"  value={OFFICER_ID} />
            <InfoRow label="ROLE"        value={OFFICER_ROLE} />
            <InfoRow label="DEPARTMENT"  value="Field Operations" />
            <TouchableOpacity style={dsh.dutyBtn} onPress={onGoOnDuty} activeOpacity={0.85}>
              <Text style={dsh.dutyBtnText}>GO ON DUTY</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── PROFILE / SETTINGS SLIDE-UP ───────────────────────────────── */}
      <Modal visible={menuVisible} transparent animationType="slide">
        <TouchableOpacity style={dsh.menuOverlay} onPress={onMenuClose} activeOpacity={1}>
          <View style={dsh.menuPanel}>
            <View style={dsh.menuHandle} />
            <Text style={dsh.menuTitle}>Officer Profile</Text>
            <InfoRow label="OFFICER ID"  value={OFFICER_ID} />
            <InfoRow label="ROLE"        value={OFFICER_ROLE} />
            <InfoRow label="DEPARTMENT"  value="Field Operations" />
            <InfoRow label="SHIFT"       value="07:00 — 19:00" />
            <InfoRow label="STATUS"      value="ON DUTY" valueColor={T.success} />
            <TouchableOpacity style={dsh.menuCloseBtn} onPress={onMenuClose} activeOpacity={0.85}>
              <Text style={dsh.menuCloseBtnText}>CLOSE</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── TOP NAVIGATION BAR ────────────────────────────────────────── */}
      <View style={dsh.header}>
        <TouchableOpacity onPress={onMenuOpen} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <View style={dsh.ham}>
            <View style={dsh.hamLine} />
            <View style={[dsh.hamLine, { width: 16 }]} />
            <View style={dsh.hamLine} />
          </View>
        </TouchableOpacity>
        <Text style={dsh.headerTitle}>CIVIX</Text>
        <View style={dsh.liveRow}>
          <View style={dsh.liveDot} />
          <Text style={dsh.liveText}>LIVE</Text>
        </View>
      </View>

      {/* ── SECTION LABEL + ROLE BADGE ────────────────────────────────── */}
      <View style={dsh.sectionRow}>
        <Text style={dsh.sectionTitle}>AWAITING DISPATCHES</Text>
        <View style={dsh.roleBadge}>
          <Text style={dsh.roleBadgeText}>🚧  ROAD WORKER</Text>
        </View>
      </View>

      {/* ── DISPATCH LIST ─────────────────────────────────────────────── */}
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={dsh.listContent}
      >
        {dispatches.map(d => <DispatchCard key={d.id} d={d} onAccept={onAccept} />)}
        <View style={{ height: 16 }} />
      </ScrollView>

      {/* ── BOTTOM BAR ────────────────────────────────────────────────── */}
      <View style={dsh.bottomBar}>
        <TouchableOpacity style={dsh.recentBtn} onPress={onRecentIssues} activeOpacity={0.85}>
          <Text style={dsh.recentBtnText}>📋  RECENT ISSUES</Text>
        </TouchableOpacity>
        <TouchableOpacity style={dsh.offDutyBtn} onPress={onGoOffDuty} activeOpacity={0.85}>
          <Text style={dsh.offDutyBtnText}>GO OFF DUTY</Text>
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}

// ── Dispatch Card ────────────────────────────────────────────────────────────
function DispatchCard({ d, onAccept }) {
  const ps = PRI[d.priority] || PRI.MODERATE;
  return (
    <View style={dc.card}>
      <View style={dc.top}>
        <View style={[dc.pBadge, { backgroundColor: ps.bg, borderColor: ps.border }]}>
          <Text style={[dc.pText, { color: ps.text }]}>{d.priority}</Text>
        </View>
        <Text style={dc.time}>{d.time}</Text>
      </View>
      <Text style={dc.title}>{d.title}</Text>
      <Text style={dc.desc} numberOfLines={2}>{d.description}</Text>
      <View style={dc.bottom}>
        <Text style={dc.dist}>📍  {d.distance}</Text>
        <TouchableOpacity style={dc.acceptBtn} onPress={() => onAccept(d)} activeOpacity={0.85}>
          <Text style={dc.acceptText}>ACCEPT</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const dsh = StyleSheet.create({
  root:         { flex: 1, backgroundColor: T.bg },
  // Modal overlay
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard:    { width: '100%', backgroundColor: T.card, borderRadius: T.radius, padding: 28, ...T.shadowLG },
  mLogoRow:     { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  mLogo:        { fontSize: 28, fontWeight: '900', color: T.text, letterSpacing: 5 },
  mLogoDot:     { width: 8, height: 8, borderRadius: 4, backgroundColor: T.accent, marginLeft: 4, marginTop: 4 },
  mSub:         { fontSize: T.fontXS, fontWeight: '600', color: T.textSecondary, letterSpacing: 2.5, marginBottom: 20 },
  mDivider:     { height: 1, backgroundColor: T.border, marginBottom: 8 },
  dutyBtn:      { backgroundColor: T.success, borderRadius: T.radiusSM, paddingVertical: 20, alignItems: 'center', marginTop: 24, ...T.shadow },
  dutyBtnText:  { color: T.white, fontWeight: '800', fontSize: 16, letterSpacing: 2.5 },
  // Menu slide-up
  menuOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  menuPanel:    { backgroundColor: T.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  menuHandle:   { width: 40, height: 4, borderRadius: 2, backgroundColor: T.border, alignSelf: 'center', marginBottom: 20 },
  menuTitle:    { fontSize: T.fontLG, fontWeight: '800', color: T.text, marginBottom: 16 },
  menuCloseBtn: { backgroundColor: '#F3F4F6', borderRadius: T.radiusSM, paddingVertical: 14, alignItems: 'center', marginTop: 24 },
  menuCloseBtnText: { fontWeight: '700', fontSize: T.fontSM, color: T.text },
  // Header
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F1F3F4' },
  ham:          { gap: 4, paddingVertical: 2 },
  hamLine:      { width: 22, height: 2, borderRadius: 1, backgroundColor: T.text },
  headerTitle:  { fontSize: 17, fontWeight: '900', color: T.text, letterSpacing: 5 },
  liveRow:      { flexDirection: 'row', alignItems: 'center', gap: 5 },
  liveDot:      { width: 8, height: 8, borderRadius: 4, backgroundColor: T.success },
  liveText:     { fontSize: 11, fontWeight: '700', color: T.success, letterSpacing: 1 },
  // Section
  sectionRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: T.textSecondary, letterSpacing: 2.5 },
  roleBadge:    { backgroundColor: '#FFF7ED', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#FED7AA' },
  roleBadgeText:{ fontSize: 11, fontWeight: '700', color: '#92400E', letterSpacing: 0.5 },
  // List
  listContent:  { paddingHorizontal: 16, paddingTop: 4 },
  // Bottom bar
  bottomBar:    { backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#F1F3F4', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20, gap: 10 },
  recentBtn:    { backgroundColor: '#F3F4F6', borderRadius: T.radiusSM, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: T.border },
  recentBtnText:{ fontSize: 13, fontWeight: '700', color: T.text, letterSpacing: 1 },
  offDutyBtn:   { backgroundColor: '#1F2937', borderRadius: T.radiusSM, paddingVertical: 18, alignItems: 'center' },
  offDutyBtnText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF', letterSpacing: 2 },
});

const dc = StyleSheet.create({
  card:      { backgroundColor: T.card, borderRadius: T.radius, padding: 16, marginBottom: 12, ...T.shadow },
  top:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  pBadge:    { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1 },
  pText:     { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  time:      { fontSize: 12, color: T.textSecondary, fontWeight: '500' },
  title:     { fontSize: 15, fontWeight: '800', color: T.text, marginBottom: 6 },
  desc:      { fontSize: 13, color: T.textSecondary, lineHeight: 19, marginBottom: 14 },
  bottom:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dist:      { fontSize: 13, fontWeight: '600', color: T.textSecondary },
  acceptBtn: { backgroundColor: T.accent, borderRadius: T.radiusSM, paddingHorizontal: 18, paddingVertical: 10 },
  acceptText:{ fontSize: 13, fontWeight: '800', color: T.white, letterSpacing: 1 },
});


// ═════════════════════════════════════════════════════════════════════════════
// SCREEN: RECENT ISSUES
// ═════════════════════════════════════════════════════════════════════════════
function RecentIssuesScreen({ tasks, onSelect, onBack }) {
  return (
    <SafeAreaView style={ris.root}>
      <AppHeader title="ACTIVE ISSUES" onBack={onBack} />
      {tasks.length === 0 ? (
        <View style={ris.empty}>
          <Text style={ris.emptyIcon}>📋</Text>
          <Text style={ris.emptyTitle}>No Active Issues</Text>
          <Text style={ris.emptyHint}>Accept a dispatch from the dashboard to begin.</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={ris.list}>
          {tasks.map(task => {
            const ps = PRI[task.priority] || PRI.MODERATE;
            const isEnRoute = task.status === 'EN_ROUTE';
            return (
              <TouchableOpacity
                key={task.id}
                style={ris.card}
                onPress={() => onSelect(task)}
                activeOpacity={0.85}
              >
                <View style={ris.cardTop}>
                  <View style={[ris.statusBadge, { backgroundColor: isEnRoute ? '#EFF6FF' : '#F9FAFB' }]}>
                    <Text style={[ris.statusText, { color: isEnRoute ? T.accent : T.textSecondary }]}>
                      {isEnRoute ? '🚗  EN ROUTE' : '⏳  PENDING'}
                    </Text>
                  </View>
                  <Text style={ris.acceptedAt}>Accepted {task.acceptedAt}</Text>
                </View>
                <Text style={ris.title}>{task.title}</Text>
                <Text style={ris.desc} numberOfLines={1}>{task.description}</Text>
                <View style={ris.cardBottom}>
                  <Text style={ris.dist}>📍  {task.distance}</Text>
                  <View style={[ris.priBadge, { backgroundColor: ps.bg, borderColor: ps.border }]}>
                    <Text style={[ris.priText, { color: ps.text }]}>{task.priority}</Text>
                  </View>
                  <Text style={ris.tapHint}>Tap to open  →</Text>
                </View>
              </TouchableOpacity>
            );
          })}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
const ris = StyleSheet.create({
  root:        { flex: 1, backgroundColor: T.bg },
  empty:       { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyIcon:   { fontSize: 48, marginBottom: 16 },
  emptyTitle:  { fontSize: T.fontLG, fontWeight: '800', color: T.text, marginBottom: 8 },
  emptyHint:   { fontSize: T.fontSM, color: T.textSecondary, textAlign: 'center' },
  list:        { paddingHorizontal: 16, paddingTop: 12 },
  card:        { backgroundColor: T.card, borderRadius: T.radius, padding: 16, marginBottom: 12, ...T.shadow },
  cardTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  statusBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  statusText:  { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  acceptedAt:  { fontSize: 11, color: T.textSecondary },
  title:       { fontSize: 15, fontWeight: '800', color: T.text, marginBottom: 4 },
  desc:        { fontSize: 12, color: T.textSecondary, marginBottom: 12 },
  cardBottom:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dist:        { fontSize: 12, fontWeight: '600', color: T.textSecondary, flex: 1 },
  priBadge:    { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  priText:     { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  tapHint:     { fontSize: 12, color: T.accent, fontWeight: '600' },
});


// ═════════════════════════════════════════════════════════════════════════════
// SCREEN: ACTIVE TASK
// ═════════════════════════════════════════════════════════════════════════════
function ActiveTaskScreen({ task, onCompleted, onBack }) {
  if (!task) return null;
  const ps = PRI[task.priority] || PRI.MODERATE;
  return (
    <SafeAreaView style={ats.root}>
      <AppHeader title="ACTIVE TASK" onBack={onBack} />

      {/* Priority + title strip */}
      <View style={[ats.titleStrip, { backgroundColor: ps.bg, borderColor: ps.border }]}>
        <View style={[ats.priBadge, { backgroundColor: ps.bg, borderColor: ps.border }]}>
          <Text style={[ats.priText, { color: ps.text }]}>{task.priority}</Text>
        </View>
        <Text style={[ats.taskTitle, { color: ps.text }]} numberOfLines={1}>{task.title}</Text>
      </View>

      {/* Navigation card — vertically centered in remaining space */}
      <View style={ats.centerArea}>
        <View style={ats.navCard}>
          <Text style={ats.navHeader}>🧭  NAVIGATION</Text>
          <Text style={ats.navDirection}>{task.direction}</Text>
          <View style={ats.navDivider} />
          <View style={ats.navMeta}>
            <View style={ats.metaItem}>
              <Text style={ats.metaLabel}>DISTANCE</Text>
              <Text style={ats.metaValue}>{task.distance}</Text>
            </View>
            <View style={ats.metaSep} />
            <View style={ats.metaItem}>
              <Text style={ats.metaLabel}>ETA</Text>
              <Text style={ats.metaValue}>~8 min</Text>
            </View>
            <View style={ats.metaSep} />
            <View style={ats.metaItem}>
              <Text style={ats.metaLabel}>STATUS</Text>
              <Text style={[ats.metaValue, { color: T.accent }]}>EN ROUTE</Text>
            </View>
          </View>
        </View>
      </View>

      {/* TASK COMPLETED — always enabled */}
      <View style={ats.bottomBar}>
        <TouchableOpacity style={ats.completedBtn} onPress={onCompleted} activeOpacity={0.85}>
          <Text style={ats.completedBtnText}>✓  TASK COMPLETED</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
const ats = StyleSheet.create({
  root:            { flex: 1, backgroundColor: T.bg },
  titleStrip:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, gap: 10 },
  priBadge:        { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1 },
  priText:         { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  taskTitle:       { fontSize: 14, fontWeight: '700', flex: 1 },
  // Center nav card
  centerArea:      { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  navCard:         { backgroundColor: T.card, borderRadius: T.radius, padding: 24, width: '100%', ...T.shadowLG },
  navHeader:       { fontSize: 11, fontWeight: '700', color: T.textSecondary, letterSpacing: 3, marginBottom: 14 },
  navDirection:    { fontSize: 18, fontWeight: '700', color: T.text, lineHeight: 26, marginBottom: 20 },
  navDivider:      { height: 1, backgroundColor: T.border, marginBottom: 16 },
  navMeta:         { flexDirection: 'row', alignItems: 'center' },
  metaItem:        { flex: 1, alignItems: 'center' },
  metaLabel:       { fontSize: 10, fontWeight: '600', color: T.textSecondary, letterSpacing: 1.5, marginBottom: 4 },
  metaValue:       { fontSize: 15, fontWeight: '800', color: T.text },
  metaSep:         { width: 1, height: 32, backgroundColor: T.border },
  // Bottom
  bottomBar:       { paddingHorizontal: 16, paddingBottom: 28, paddingTop: 12, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#F1F3F4' },
  completedBtn:    { backgroundColor: T.success, borderRadius: T.radiusSM, paddingVertical: 20, alignItems: 'center', ...T.shadow },
  completedBtnText:{ fontSize: 16, fontWeight: '800', color: T.white, letterSpacing: 2 },
});


// ═════════════════════════════════════════════════════════════════════════════
// SCREEN: VERIFICATION
// ═════════════════════════════════════════════════════════════════════════════
function VerificationScreen({ phase, capturedImage, taskTitle, onOpenCamera, onReturn, onBack }) {
  return (
    <SafeAreaView style={vs.root}>

      {/* Header — only show back arrow when idle */}
      {phase === 'idle' && <AppHeader title="VERIFICATION" onBack={onBack} />}

      {/* ── IDLE: photo button ──────────────────────────────────────────── */}
      {phase === 'idle' && (
        <View style={vs.idleContent}>
          <View style={vs.idleHero}>
            <View style={vs.idleIconWrap}>
              <Text style={vs.idleIcon}>📸</Text>
            </View>
            <Text style={vs.idleTitle}>Photo Verification Required</Text>
            <Text style={vs.idleDesc}>
              Take a live photo to confirm the issue has been resolved.{'\n'}
              This triggers automatic fund release via the AI Swarm.
            </Text>
            {taskTitle && (
              <View style={vs.taskChip}>
                <Text style={vs.taskChipText} numberOfLines={1}>📌  {taskTitle}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity style={vs.photoBtn} onPress={onOpenCamera} activeOpacity={0.85}>
            <Text style={vs.photoBtnText}>PHOTO VERIFICATION</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── PROCESSING + SUCCESS ────────────────────────────────────────── */}
      {(phase === 'processing' || phase === 'success') && (
        <View style={vs.processContent}>

          {/* Thumbnail */}
          <View style={vs.thumbnailWrap}>
            {capturedImage ? (
              <Image source={{ uri: capturedImage }} style={vs.thumbnail} resizeMode="cover" />
            ) : (
              <View style={[vs.thumbnail, vs.thumbPlaceholder]}>
                <Text style={vs.thumbPlaceholderIcon}>📷</Text>
              </View>
            )}
            {phase === 'success' && (
              <View style={vs.checkOverlay}>
                <Text style={vs.checkIcon}>✓</Text>
              </View>
            )}
          </View>

          {/* Processing state */}
          {phase === 'processing' && (
            <View style={vs.processingBox}>
              <ActivityIndicator size="large" color={T.accent} style={{ marginBottom: 16 }} />
              <Text style={vs.processingTitle}>AI Swarm Verifying Resolution…</Text>
              <Text style={vs.processingHint}>Analyzing photo, GPS coordinates, and incident data</Text>
            </View>
          )}

          {/* Success state */}
          {phase === 'success' && (
            <View style={vs.successBox}>
              <Text style={vs.successIcon}>✅</Text>
              <Text style={vs.successTitle}>Verification Successful</Text>
              <Text style={vs.successSub}>Funds Released</Text>
              <View style={vs.successCard}>
                <Text style={vs.successCardText}>
                  The AI Swarm confirmed the resolution. Incident closed and payment processed automatically.
                </Text>
              </View>
              <TouchableOpacity style={vs.returnBtn} onPress={onReturn} activeOpacity={0.85}>
                <Text style={vs.returnBtnText}>RETURN TO DASHBOARD</Text>
              </TouchableOpacity>
            </View>
          )}

        </View>
      )}

    </SafeAreaView>
  );
}
const vs = StyleSheet.create({
  root:                { flex: 1, backgroundColor: T.bg },
  // Idle
  idleContent:         { flex: 1, justifyContent: 'space-between', padding: 20, paddingBottom: 28 },
  idleHero:            { flex: 1, alignItems: 'center', justifyContent: 'center' },
  idleIconWrap:        { width: 100, height: 100, borderRadius: 50, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', marginBottom: 24, borderWidth: 2, borderColor: '#BFDBFE' },
  idleIcon:            { fontSize: 44 },
  idleTitle:           { fontSize: 20, fontWeight: '800', color: T.text, textAlign: 'center', marginBottom: 12 },
  idleDesc:            { fontSize: 14, color: T.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 20 },
  taskChip:            { backgroundColor: '#F3F4F6', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6, borderWidth: 1, borderColor: T.border },
  taskChipText:        { fontSize: 12, fontWeight: '600', color: T.text, maxWidth: 240 },
  photoBtn:            { backgroundColor: T.accent, borderRadius: T.radiusSM, paddingVertical: 22, alignItems: 'center', ...T.shadowLG },
  photoBtnText:        { fontSize: 16, fontWeight: '800', color: T.white, letterSpacing: 2.5 },
  // Processing + success shared
  processContent:      { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  thumbnailWrap:       { position: 'relative', marginBottom: 28 },
  thumbnail:           { width: 160, height: 160, borderRadius: T.radius, ...T.shadowLG },
  thumbPlaceholder:    { backgroundColor: '#1C1C1E', alignItems: 'center', justifyContent: 'center' },
  thumbPlaceholderIcon:{ fontSize: 52 },
  checkOverlay:        { position: 'absolute', bottom: -14, right: -14, width: 44, height: 44, borderRadius: 22, backgroundColor: T.success, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#FFFFFF' },
  checkIcon:           { fontSize: 20, color: '#FFFFFF', fontWeight: '900' },
  // Processing
  processingBox:       { alignItems: 'center' },
  processingTitle:     { fontSize: 16, fontWeight: '700', color: T.text, textAlign: 'center', marginBottom: 8 },
  processingHint:      { fontSize: 13, color: T.textSecondary, textAlign: 'center' },
  // Success
  successBox:          { alignItems: 'center', width: '100%' },
  successIcon:         { fontSize: 40, marginBottom: 12 },
  successTitle:        { fontSize: 22, fontWeight: '900', color: T.text, marginBottom: 4 },
  successSub:          { fontSize: 16, fontWeight: '700', color: T.success, marginBottom: 20 },
  successCard:         { backgroundColor: '#ECFDF5', borderRadius: T.radiusSM, padding: 16, width: '100%', borderLeftWidth: 4, borderLeftColor: T.success, marginBottom: 28 },
  successCardText:     { fontSize: 13, color: '#065F46', lineHeight: 20 },
  returnBtn:           { backgroundColor: T.accent, borderRadius: T.radiusSM, paddingVertical: 18, alignItems: 'center', width: '100%', ...T.shadow },
  returnBtnText:       { fontSize: 15, fontWeight: '800', color: T.white, letterSpacing: 2 },
});
