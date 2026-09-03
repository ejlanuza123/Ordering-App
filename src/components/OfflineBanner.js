// src/components/OfflineBanner.js
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { networkStateService } from '../services/networkStateService';

/**
 * Global Offline / Back Online floating notification banner.
 * Automatically slides in from top when network connection drops,
 * and flashes a green sync confirmation before gliding away on reconnect.
 */
export default function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const [networkStatus, setNetworkStatus] = useState('online'); // 'online' | 'offline' | 'reconnected'
  const slideAnim = useRef(new Animated.Value(-80)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const hideTimerRef = useRef(null);

  useEffect(() => {
    const unsubscribe = networkStateService.subscribe(({ isOnline, wasOffline, initial }) => {
      if (initial && isOnline) {
        setNetworkStatus('online');
        slideAnim.setValue(-80);
        opacityAnim.setValue(0);
        return;
      }

      if (!isOnline) {
        if (hideTimerRef.current) {
          clearTimeout(hideTimerRef.current);
          hideTimerRef.current = null;
        }
        setNetworkStatus('offline');
        showBanner();
      } else if (isOnline && wasOffline) {
        setNetworkStatus('reconnected');
        showBanner();

        if (hideTimerRef.current) {
          clearTimeout(hideTimerRef.current);
        }
        hideTimerRef.current = setTimeout(() => {
          hideBanner(() => {
            setNetworkStatus('online');
          });
        }, 2500);
      }
    });

    return () => {
      unsubscribe();
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, []);

  const useNativeDriver = Platform.OS !== 'web' && process.env.NODE_ENV !== 'test';

  const showBanner = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver,
      }),
    ]).start();
  };

  const hideBanner = (onComplete) => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -80,
        duration: 300,
        easing: Easing.in(Easing.cubic),
        useNativeDriver,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver,
      }),
    ]).start(() => {
      if (typeof onComplete === 'function') {
        onComplete();
      }
    });
  };

  if (networkStatus === 'online') {
    return null;
  }

  const isReconnected = networkStatus === 'reconnected';
  const bannerBg = isReconnected ? '#065F46' : '#991B1B';
  const borderColor = isReconnected ? '#10B981' : '#DC2626';
  const iconName = isReconnected ? 'checkmark-circle-outline' : 'cloud-offline-outline';
  const statusText = isReconnected
    ? 'Back Online — Sync complete'
    : 'Offline Mode — Orders & actions will sync automatically';

  const topInset = Math.max(insets.top, Platform.OS === 'ios' ? 20 : 10);

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.wrapper,
        {
          top: topInset + (Platform.OS === 'ios' ? 4 : 8),
        },
      ]}
    >
      <Animated.View
        style={[
          styles.pill,
          {
            backgroundColor: bannerBg,
            borderColor: borderColor,
            transform: [{ translateY: slideAnim }],
            opacity: opacityAnim,
          },
        ]}
      >
        <Ionicons name={iconName} size={16} color="#FFFFFF" style={styles.icon} />
        <Text style={styles.text} numberOfLines={1}>
          {statusText}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 99999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    maxWidth: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.28,
    shadowRadius: 5,
    elevation: 8,
  },
  icon: {
    marginRight: 6,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
