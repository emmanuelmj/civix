import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { T } from '../constants/theme';
import { loginOfficer } from '../services/api';

const DOMAIN_LABELS = {
  MUNICIPAL: 'Municipal Services',
  TRAFFIC: 'Traffic & Roads',
  WATER: 'Water & Sanitation',
  ELECTRICITY: 'Electrical Grid',
  CONSTRUCTION: 'Construction',
  EMERGENCY: 'Emergency Response',
};

/**
 * LoginScreen
 * Authenticates the field officer against the backend.
 * On success, shows a brief welcome confirmation with officer details,
 * then calls onLogin(officerProfile).
 */
export default function LoginScreen({ onLogin }) {
  const [officerId, setOfficerId] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(null); // officer profile after auth

  // After confirmation screen shows, advance to dashboard
  useEffect(() => {
    if (!confirmed) return;
    const t = setTimeout(() => onLogin(confirmed), 1800);
    return () => clearTimeout(t);
  }, [confirmed]);

  const handleLogin = async () => {
    const id = officerId.trim().toUpperCase();
    const p = pin.trim();
    if (!id || !p) {
      setError('Officer ID and PIN are required.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await loginOfficer(id, p);
      if (res?.status === 'ok' && res.officer) {
        setConfirmed(res.officer);
      } else {
        setError(res?.message || 'Login failed. Check credentials.');
      }
    } catch {
      setError('Cannot reach backend. Check connection.');
    } finally {
      setLoading(false);
    }
  };

  // ── Welcome confirmation screen ──
  if (confirmed) {
    const skills = Array.isArray(confirmed.domain_skills)
      ? confirmed.domain_skills
      : (confirmed.domain_skills || '').replace(/[{}]/g, '').split(',').filter(Boolean);
    const deptLabel = skills.map(s => DOMAIN_LABELS[s] || s).join(' · ');

    return (
      <View style={styles.root}>
        <View style={[styles.card, { alignItems: 'center' }]}>
          {/* Avatar circle */}
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(confirmed.name || 'O').charAt(0).toUpperCase()}
            </Text>
          </View>

          <Text style={styles.welcomeLabel}>AUTHENTICATED</Text>
          <Text style={styles.welcomeName}>{confirmed.name}</Text>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>ID</Text>
            <Text style={styles.detailValue}>{confirmed.officer_id}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>DEPARTMENT</Text>
            <Text style={styles.detailValue}>{deptLabel}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>STATUS</Text>
            <Text style={[styles.detailValue, { color: T.success }]}>AUTHORIZED</Text>
          </View>

          <ActivityIndicator color={T.accent} style={{ marginTop: 20 }} />
          <Text style={styles.welcomeHint}>Entering command center…</Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.card}>
        {/* Branding */}
        <View style={styles.brandRow}>
          <Text style={styles.brandTitle}>CIVIX</Text>
          <View style={styles.brandDot} />
        </View>
        <Text style={styles.brandSub}>FIELD PERSONNEL</Text>
        <Text style={styles.heading}>Secure Login</Text>

        {/* Officer ID */}
        <Text style={styles.label}>Officer ID</Text>
        <TextInput
          style={styles.input}
          value={officerId}
          onChangeText={setOfficerId}
          autoCapitalize="characters"
          placeholder="e.g. OP-102"
          placeholderTextColor={T.textSecondary}
          returnKeyType="next"
        />

        {/* PIN */}
        <Text style={styles.label}>Secure PIN</Text>
        <TextInput
          style={styles.input}
          value={pin}
          onChangeText={setPin}
          secureTextEntry
          placeholder="••••"
          placeholderTextColor={T.textSecondary}
          keyboardType="numeric"
          maxLength={8}
          returnKeyType="done"
          onSubmitEditing={handleLogin}
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {/* Primary Action */}
        <TouchableOpacity
          style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color={T.white} />
          ) : (
            <Text style={styles.loginBtnText}>SECURE LOGIN</Text>
          )}
        </TouchableOpacity>

        {/* Hint for demo */}
        <Text style={styles.hint}>PIN: 1234 · Officers: OP-101 to OP-108</Text>

        <Text style={styles.footnote}>
          Restricted Government Access Only. Activity is logged.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: T.bg,
    justifyContent: 'center',
    alignItems: 'center',
    padding: T.pad,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: T.card,
    borderRadius: T.radius,
    padding: 32,
    ...T.shadowLG,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: T.text,
    letterSpacing: 4,
  },
  brandDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: T.accent,
    marginLeft: 4,
    marginTop: 2,
  },
  brandSub: {
    fontSize: T.fontXS,
    fontWeight: '600',
    color: T.textSecondary,
    letterSpacing: 3,
    marginBottom: 20,
  },
  heading: {
    fontSize: T.fontLG,
    fontWeight: '700',
    color: T.text,
    marginBottom: 28,
  },
  label: {
    fontSize: T.fontSM,
    fontWeight: '600',
    color: T.text,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1.5,
    borderColor: T.border,
    borderRadius: T.radiusSM,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: T.fontMD,
    color: T.text,
    marginBottom: 18,
    backgroundColor: '#FAFAFA',
  },
  errorText: {
    color: T.danger,
    fontSize: T.fontSM,
    marginBottom: 12,
    fontWeight: '500',
  },
  loginBtn: {
    backgroundColor: T.accent,
    borderRadius: T.radiusSM,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
    ...T.shadow,
  },
  loginBtnDisabled: {
    opacity: 0.6,
  },
  loginBtnText: {
    color: T.white,
    fontSize: T.fontMD,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  hint: {
    textAlign: 'center',
    fontSize: T.fontXS,
    color: T.textSecondary,
    marginTop: 14,
  },
  footnote: {
    textAlign: 'center',
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 24,
  },
  // Welcome confirmation styles
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: T.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '800',
    color: T.white,
  },
  welcomeLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 3,
    color: T.success,
    marginBottom: 6,
  },
  welcomeName: {
    fontSize: 22,
    fontWeight: '700',
    color: T.text,
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
  },
  detailLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    color: T.textSecondary,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: T.text,
  },
  welcomeHint: {
    fontSize: 12,
    color: T.textSecondary,
    marginTop: 8,
  },
});
