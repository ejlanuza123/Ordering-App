// src/components/StorePauseBanner.js
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { storeSettingsService } from '../services/storeSettingsService';

export default function StorePauseBanner({ onStatusChange }) {
  const [settings, setSettings] = useState(null);
  const [timeLeft, setTimeLeft] = useState('');
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const loadSettings = async () => {
    const data = await storeSettingsService.getStorePauseSettings();
    setSettings(data);
    if (typeof onStatusChange === 'function') {
      onStatusChange(data);
    }
  };

  useEffect(() => {
    loadSettings();
    const unsubscribe = storeSettingsService.subscribeToStorePauseChanges((fresh) => {
      setSettings(fresh);
      if (typeof onStatusChange === 'function') {
        onStatusChange(fresh);
      }
    });
    return () => unsubscribe();
  }, []);

  // Pulsing animation for emergency/holiday icon
  useEffect(() => {
    if (!settings?.isPaused) return;

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.18,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    return () => pulse.stop();
  }, [settings?.isPaused, pulseAnim]);

  // Live countdown timer
  useEffect(() => {
    if (!settings?.isPaused || !settings?.reopenAt) {
      setTimeLeft('');
      return;
    }

    const calculateTime = () => {
      const target = new Date(settings.reopenAt).getTime();
      const now = Date.now();
      const diff = target - now;

      if (diff <= 0) {
        setTimeLeft('Reopening now...');
        loadSettings();
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      const parts = [];
      if (hours > 0) parts.push(`${hours}h`);
      parts.push(`${minutes < 10 && hours > 0 ? '0' : ''}${minutes}m`);
      parts.push(`${seconds < 10 ? '0' : ''}${seconds}s`);

      setTimeLeft(parts.join(' '));
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [settings?.isPaused, settings?.reopenAt]);

  if (!settings || !settings.isPaused) {
    return null;
  }

  const isEmergency = settings.mode === 'emergency';
  const isHoliday = settings.mode === 'holiday';

  const theme = isEmergency
    ? {
        bg: '#7F1D1D',
        border: '#B91C1C',
        badgeBg: 'rgba(239, 68, 68, 0.25)',
        badgeText: '#FCA5A5',
        title: settings.title || 'Severe Weather / Emergency Advisory',
        icon: 'warning',
        iconColor: '#F87171',
      }
    : isHoliday
    ? {
        bg: '#78350F',
        border: '#B45309',
        badgeBg: 'rgba(245, 158, 11, 0.25)',
        badgeText: '#FDE68A',
        title: settings.title || 'Holiday Schedule Notice',
        icon: 'sunny',
        iconColor: '#FBBF24',
      }
    : {
        bg: '#1E3A8A',
        border: '#1D4ED8',
        badgeBg: 'rgba(59, 130, 246, 0.25)',
        badgeText: '#BFDBFE',
        title: settings.title || 'Scheduled Maintenance Notice',
        icon: 'construct',
        iconColor: '#60A5FA',
      };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg, borderColor: theme.border }]}>
      <View style={styles.headerRow}>
        <Animated.View style={[styles.iconWrap, { transform: [{ scale: pulseAnim }] }]}>
          <Ionicons name={theme.icon} size={20} color={theme.iconColor} />
        </Animated.View>
        <Text style={styles.titleText} numberOfLines={1}>
          {theme.title}
        </Text>
      </View>

      {settings.reason ? (
        <Text style={styles.reasonText}>
          {settings.reason}
        </Text>
      ) : null}

      <View style={styles.footerRow}>
        {timeLeft ? (
          <View style={[styles.badge, { backgroundColor: theme.badgeBg }]}>
            <Ionicons name="time-outline" size={13} color={theme.badgeText} style={{ marginRight: 4 }} />
            <Text style={[styles.badgeText, { color: theme.badgeText }]}>
              Reopens in {timeLeft}
            </Text>
          </View>
        ) : null}

        <View style={[styles.badge, { backgroundColor: 'rgba(255,255,255,0.12)' }]}>
          <Text style={styles.badgeText}>
            {settings.allowPreorders ? '📦 Pre-orders Queued' : '🚫 Dispatch Paused'}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  iconWrap: {
    marginRight: 8,
  },
  titleText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
    letterSpacing: 0.2,
  },
  reasonText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12.5,
    lineHeight: 18,
    marginBottom: 10,
  },
  footerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
});
