// src/components/SyncStatusToast.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { offlineStorageService } from '../services/offlineStorageService';
import DeadLetterQueueModal from './DeadLetterQueueModal';

/**
 * Global Floating Sync Toast & Dead-Letter Alert
 * Displays real-time sync progress when uploading offline actions,
 * shows a brief success checkmark when completed,
 * and alerts the user if any offline actions permanently failed.
 */
export default function SyncStatusToast() {
  const insets = useSafeAreaInsets();
  const [syncState, setSyncState] = useState(null); // { type: 'syncing' | 'completed' | 'dead_letter', message: string, count: number }
  const [deadLetters, setDeadLetters] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);

  const slideAnim = useRef(new Animated.Value(-80)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const dismissTimerRef = useRef(null);

  const useNativeDriver = Platform.OS !== 'web' && process.env.NODE_ENV !== 'test';

  const showToast = () => {
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

  const hideToast = (onComplete) => {
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
      if (typeof onComplete === 'function') onComplete();
    });
  };

  useEffect(() => {
    // 1. Subscribe to sync lifecycle events
    const unsubSync = offlineStorageService.subscribeToSyncEvents((event) => {
      if (event.type === 'sync_start' && event.total > 0) {
        if (dismissTimerRef.current) {
          clearTimeout(dismissTimerRef.current);
          dismissTimerRef.current = null;
        }
        setSyncState({
          type: 'syncing',
          message: `Syncing ${event.total} offline ${event.total === 1 ? 'item' : 'items'}...`,
        });
        showToast();
      } else if (event.type === 'sync_progress' && event.total > 0) {
        setSyncState({
          type: 'syncing',
          message: `Syncing ${event.current} of ${event.total}...`,
        });
        showToast();
      } else if (event.type === 'sync_complete') {
        if (event.processed > 0) {
          setSyncState({
            type: 'completed',
            message: `${event.processed} offline ${event.processed === 1 ? 'action' : 'actions'} synced!`,
          });
          showToast();

          if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
          dismissTimerRef.current = setTimeout(() => {
            hideToast(() => {
              setSyncState(null);
            });
          }, 3200);
        } else if (event.deadLetters === 0 && (!deadLetters || deadLetters.length === 0)) {
          hideToast(() => {
            setSyncState(null);
          });
        }
      } else if (event.type === 'sync_error') {
        // If an unexpected sync error happens, hide after brief duration
        if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = setTimeout(() => {
          hideToast(() => {
            setSyncState(null);
          });
        }, 3000);
      }
    });

    // 2. Subscribe to dead letters
    const unsubDeadLetters = offlineStorageService.subscribeToDeadLetterUpdates((items) => {
      const list = Array.isArray(items) ? items : [];
      setDeadLetters(list);

      // If there are dead letters and not currently actively syncing, display dead letter alert
      if (list.length > 0) {
        setSyncState((prev) => {
          if (prev?.type === 'syncing') return prev; // Keep syncing toast visible until finished
          return {
            type: 'dead_letter',
            message: `${list.length} sync ${list.length === 1 ? 'item' : 'items'} failed • Tap to resolve`,
          };
        });
        showToast();
      } else {
        setSyncState((prev) => {
          if (prev?.type === 'dead_letter') {
            hideToast(() => setSyncState(null));
          }
          return prev?.type === 'dead_letter' ? null : prev;
        });
      }
    });

    return () => {
      unsubSync();
      unsubDeadLetters();
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
      }
    };
  }, [deadLetters.length]);

  if (!syncState) {
    return (
      <DeadLetterQueueModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        items={deadLetters}
      />
    );
  }

  const isSyncing = syncState.type === 'syncing';
  const isCompleted = syncState.type === 'completed';
  const isDeadLetter = syncState.type === 'dead_letter';

  let bannerBg = '#1E3A8A'; // Blue
  let borderColor = '#3B82F6';
  let iconComponent = <Ionicons name="sync" size={15} color="#FFFFFF" style={styles.icon} />;

  if (isSyncing) {
    bannerBg = '#1E3A8A';
    borderColor = '#60A5FA';
    iconComponent = <ActivityIndicator size="small" color="#FFFFFF" style={styles.icon} />;
  } else if (isCompleted) {
    bannerBg = '#065F46';
    borderColor = '#10B981';
    iconComponent = <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" style={styles.icon} />;
  } else if (isDeadLetter) {
    bannerBg = '#7F1D1D';
    borderColor = '#EF4444';
    iconComponent = <Ionicons name="alert-circle" size={16} color="#FCA5A5" style={styles.icon} />;
  }

  const topInset = Math.max(insets.top, Platform.OS === 'ios' ? 20 : 10);

  const handlePress = () => {
    if (isDeadLetter) {
      setModalVisible(true);
    }
  };

  return (
    <>
      <View
        pointerEvents="box-none"
        style={[
          styles.wrapper,
          {
            top: topInset + (Platform.OS === 'ios' ? 42 : 46), // Offset slightly below offline banner if present
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
          <TouchableOpacity
            activeOpacity={isDeadLetter ? 0.75 : 1}
            onPress={handlePress}
            style={styles.touchable}
          >
            {iconComponent}
            <Text style={styles.text} numberOfLines={1}>
              {syncState.message}
            </Text>
            {isDeadLetter && (
              <Ionicons name="chevron-forward" size={14} color="#FCA5A5" style={styles.chevron} />
            )}
          </TouchableOpacity>
        </Animated.View>
      </View>

      <DeadLetterQueueModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        items={deadLetters}
      />
    </>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 99998,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
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
  touchable: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
  chevron: {
    marginLeft: 4,
  },
});
