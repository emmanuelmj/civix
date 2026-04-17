import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { T } from '../constants/theme';

/**
 * CameraScreen (VERIFICATION state)
 * Full-screen live camera overlay. Takes a photo (no camera roll allowed),
 * converts to Base64, tags with current GPS, then calls onCapture(payload).
 *
 * Props:
 *   incident    – { id, description, lat, lng }
 *   officerId   – string "OP-441"
 *   onCapture   – fn({ event_id, officer_id, resolution_lat, resolution_lng, image_base64 })
 *   onClose     – fn() — back without submitting
 */
// Props match what App.js passes: task, officerId, onComplete, onCancel
export default function CameraScreen({ task: incident, officerId, onComplete: onCapture, onCancel: onClose }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [capturing, setCapturing] = useState(false);
  const cameraRef = useRef(null);

  // Request permission on mount if not yet granted
  useEffect(() => {
    if (permission && !permission.granted) {
      requestPermission();
    }
  }, []);

  const handleCapture = async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      // Take live photo (no camera roll — base64 only)
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        base64: true,
        skipProcessing: Platform.OS === 'android',
      });

      // Get current GPS coordinates for the resolution proof
      let resLat = incident?.lat ?? 0;
      let resLng = incident?.lng ?? 0;
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        resLat = loc.coords.latitude;
        resLng = loc.coords.longitude;
      } catch (_) {
        // GPS unavailable — use incident coords as fallback
      }

      const payload = {
        event_id: incident?.id ?? 'unknown',
        officer_id: officerId,
        resolution_lat: resLat,
        resolution_lng: resLng,
        // Prefix required by backend
        image_base64: `data:image/jpeg;base64,${photo.base64}`,
      };

      onCapture(payload);
    } catch (err) {
      console.error('[CameraScreen] capture error:', err);
      setCapturing(false);
    }
  };

  // --- Permission states ---
  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={T.accent} size="large" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permText}>Camera access required for verification.</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>GRANT ACCESS</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backLink} onPress={onClose}>
          <Text style={styles.backLinkText}>← Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    // Root fills entire screen
    <View style={styles.root}>
      {/* Live camera fills background absolutely */}
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFillObject} facing="back" />

      {/* Overlay UI sits on top */}
      <View style={styles.overlay}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>📸  PHOTO VERIFICATION</Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Incident context */}
        <View style={styles.contextCard}>
          <Text style={styles.contextLabel}>TASK</Text>
          <Text style={styles.contextDesc} numberOfLines={2}>
            {incident?.description ?? 'Unknown Task'}
          </Text>
        </View>

        {/* Spacer */}
        <View style={{ flex: 1 }} />

        {/* Instructions */}
        <Text style={styles.instruction}>
          Point camera at the resolved issue and take a live photo
        </Text>

        {/* Capture Button */}
        <TouchableOpacity
          style={[styles.captureBtn, capturing && styles.captureBtnDisabled]}
          onPress={handleCapture}
          disabled={capturing}
          activeOpacity={0.85}
        >
          {capturing ? (
            <ActivityIndicator color={T.white} size="large" />
          ) : (
            <View style={styles.captureInner} />
          )}
        </TouchableOpacity>
        <Text style={styles.captureLabel}>
          {capturing ? 'Uploading proof...' : 'Tap to capture'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  overlay: {
    flex: 1,
    paddingTop: 56,
    paddingBottom: 48,
    paddingHorizontal: T.pad,
    justifyContent: 'flex-start',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  badge: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  badgeText: {
    color: T.white,
    fontWeight: '700',
    fontSize: T.fontSM,
    letterSpacing: 0.5,
  },
  closeText: {
    color: T.white,
    fontSize: 22,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  contextCard: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: T.radiusSM,
    padding: 14,
    borderLeftWidth: 4,
    borderLeftColor: T.success,
  },
  contextLabel: {
    color: T.success,
    fontSize: T.fontXS,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 4,
  },
  contextDesc: {
    color: T.white,
    fontSize: T.fontMD,
    fontWeight: '600',
  },
  instruction: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: T.fontSM,
    textAlign: 'center',
    marginBottom: 24,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  captureBtn: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: T.white,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 5,
    borderColor: 'rgba(255,255,255,0.5)',
    ...T.shadowLG,
  },
  captureBtnDisabled: {
    opacity: 0.5,
  },
  captureInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: T.white,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  captureLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: T.fontXS,
    textAlign: 'center',
    marginTop: 10,
    letterSpacing: 0.5,
  },
  // Permission screens
  center: {
    flex: 1,
    backgroundColor: T.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: T.pad,
  },
  permText: {
    fontSize: T.fontMD,
    color: T.text,
    textAlign: 'center',
    marginBottom: 20,
  },
  permBtn: {
    backgroundColor: T.accent,
    borderRadius: T.radiusSM,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  permBtnText: {
    color: T.white,
    fontWeight: '700',
    fontSize: T.fontMD,
    letterSpacing: 1,
  },
  backLink: { marginTop: 20 },
  backLinkText: {
    color: T.accent,
    fontSize: T.fontSM,
  },
});
