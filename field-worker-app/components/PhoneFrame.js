import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';

/**
 * PhoneFrame
 * Renders a browser-friendly phone shell that scales to fit the viewport.
 * On native (iOS/Android), renders children directly with no wrapper overhead.
 *
 * Usage (web demo):
 *   <PhoneFrame>
 *     <App />
 *   </PhoneFrame>
 */

const PHONE_W = 390;
const PHONE_H = 844;
const H_PAD = 48;   // total horizontal margin in browser window
const V_PAD = 48;   // total vertical margin in browser window

export default function PhoneFrame({ children }) {
  const [scale, setScale] = useState(1);

  const recalcScale = useCallback(() => {
    if (typeof window === 'undefined') return;
    const scaleW = (window.innerWidth - H_PAD) / PHONE_W;
    const scaleH = (window.innerHeight - V_PAD) / PHONE_H;
    setScale(Math.min(scaleW, scaleH, 1));
  }, []);

  useEffect(() => {
    recalcScale();
    window.addEventListener('resize', recalcScale);
    return () => window.removeEventListener('resize', recalcScale);
  }, [recalcScale]);

  return (
    <View style={styles.browser}>
      {/* Phone chassis */}
      <View
        style={[
          styles.chassis,
          {
            width: PHONE_W * scale,
            height: PHONE_H * scale,
          },
        ]}
      >
        {/* Notch */}
        <View style={[styles.notch, { width: 120 * scale, height: 28 * scale, borderRadius: 14 * scale }]} />

        {/* Screen area */}
        <View
          style={[
            styles.screen,
            {
              borderRadius: 36 * scale,
              overflow: 'hidden',
            },
          ]}
        >
          {/* Scale children down to fit the phone frame */}
          <View
            style={{
              width: PHONE_W,
              height: PHONE_H,
              transform: [{ scale }],
              transformOrigin: 'top left',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {children}
          </View>
        </View>

        {/* Home indicator */}
        <View style={[styles.homeIndicator, { width: 120 * scale, height: 4 * scale, borderRadius: 2 * scale }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  browser: {
    flex: 1,
    backgroundColor: '#E8E8ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chassis: {
    backgroundColor: '#1C1C1E',
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 40,
    elevation: 20,
    padding: 12,
  },
  notch: {
    position: 'absolute',
    top: 14,
    backgroundColor: '#1C1C1E',
    zIndex: 10,
  },
  screen: {
    flex: 1,
    width: '100%',
    backgroundColor: '#F9FAFB',
    overflow: 'hidden',
  },
  homeIndicator: {
    position: 'absolute',
    bottom: 10,
    backgroundColor: '#636366',
  },
});
