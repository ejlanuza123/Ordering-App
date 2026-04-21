import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  PanResponder,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { chatService } from '../services/chatService';

const CHAT_HEAD_SIZE = 58;
const EDGE_PADDING = 12;
const TAP_THRESHOLD = 6;
const INACTIVITY_TIMEOUT_MS = 10000;
const TOGGLE_TAB_WIDTH = 40;
const TOGGLE_TAB_HEIGHT = 52;

export default function FloatingChatHead({ userId, visible = true, onPress }) {
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  const [unreadCount, setUnreadCount] = useState(0);
  const [isHidden, setIsHidden] = useState(false);
  const [toggleSide, setToggleSide] = useState('left');
  const inactivityTimerRef = useRef(null);
  const position = useRef(
    new Animated.ValueXY({
      x: EDGE_PADDING,
      y: Math.max(EDGE_PADDING, screenHeight - 190),
    })
  ).current;

  const bounds = useMemo(
    () => ({
      minX: EDGE_PADDING,
      maxX: Math.max(EDGE_PADDING, screenWidth - CHAT_HEAD_SIZE - EDGE_PADDING),
      minY: EDGE_PADDING,
      maxY: Math.max(EDGE_PADDING, screenHeight - CHAT_HEAD_SIZE - EDGE_PADDING),
    }),
    [screenHeight, screenWidth]
  );

  const refreshUnreadCount = async () => {
    if (!userId || !visible) return;

    const result = await chatService.getConversations(userId, 100);
    if (!result.success) return;

    const unread = (result.conversations || []).filter((conversation) => {
      if (!conversation?.lastSeenAt || !conversation?.updated_at) return false;
      return new Date(conversation.lastSeenAt) < new Date(conversation.updated_at);
    }).length;

    setUnreadCount(unread);
  };

  useEffect(() => {
    refreshUnreadCount();
  }, [userId, visible]);

  useEffect(() => {
    if (!userId || !visible) {
      setUnreadCount(0);
      return undefined;
    }

    const unsubscribeUnread = chatService.subscribeToUnreadChanges(userId, () => {
      refreshUnreadCount();
    });

    return () => unsubscribeUnread();
  }, [userId, visible]);

  const resetInactivityTimer = () => {
    if (isHidden) return;

    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }

    inactivityTimerRef.current = setTimeout(() => {
      setIsHidden(true);
    }, INACTIVITY_TIMEOUT_MS);
  };

  useEffect(() => {
    resetInactivityTimer();
    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, [isHidden, userId, visible]);

  const snapToNearestEdge = () => {
    position.stopAnimation((value) => {
      const currentX = value?.x ?? EDGE_PADDING;
      const currentY = value?.y ?? EDGE_PADDING;
      const midpointX = (bounds.minX + bounds.maxX) / 2;
      const targetX = currentX <= midpointX ? bounds.minX : bounds.maxX;
      const targetY = Math.min(Math.max(currentY, bounds.minY), bounds.maxY);

      setToggleSide(currentX <= midpointX ? 'left' : 'right');

      Animated.spring(position, {
        toValue: { x: targetX, y: targetY },
        tension: 120,
        friction: 12,
        useNativeDriver: false,
      }).start();
    });
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderMove: (_evt, gestureState) => {
          const nextX = Math.min(Math.max(bounds.minX, gestureState.moveX - CHAT_HEAD_SIZE / 2), bounds.maxX);
          const nextY = Math.min(Math.max(bounds.minY, gestureState.moveY - CHAT_HEAD_SIZE / 2), bounds.maxY);
          position.setValue({ x: nextX, y: nextY });
        },
        onPanResponderRelease: (_evt, gestureState) => {
          const isTap = Math.abs(gestureState.dx) < TAP_THRESHOLD && Math.abs(gestureState.dy) < TAP_THRESHOLD;
          snapToNearestEdge();
          resetInactivityTimer();

          if (isTap && typeof onPress === 'function') {
            onPress();
          }
        },
      }),
    [bounds.maxX, bounds.maxY, bounds.minX, bounds.minY, onPress, position, isHidden]
  );

  if (!visible || !userId) {
    return null;
  }

  if (isHidden) {
    const toggleX = toggleSide === 'left' ? 0 : screenWidth - TOGGLE_TAB_WIDTH;
    const toggleY = Math.max(EDGE_PADDING, screenHeight - 190);

    const toggleTabDynamicStyle =
      toggleSide === 'left'
        ? {
            borderTopRightRadius: 12,
            borderBottomRightRadius: 12,
            borderRightWidth: 2,
            borderLeftWidth: 0,
          }
        : {
            borderTopLeftRadius: 12,
            borderBottomLeftRadius: 12,
            borderLeftWidth: 2,
            borderRightWidth: 0,
          };

    return (
      <TouchableOpacity
        style={[
          styles.toggleTab,
          toggleTabDynamicStyle,
          {
            left: toggleSide === 'left' ? 0 : undefined,
            right: toggleSide === 'right' ? 0 : undefined,
            top: toggleY,
          },
        ]}
        onPress={() => {
          setIsHidden(false);
          resetInactivityTimer();
        }}
        activeOpacity={0.7}
      >
        <Ionicons
          name={toggleSide === 'left' ? 'chevron-forward' : 'chevron-back'}
          size={20}
          color="#FFFFFF"
        />
        {unreadCount > 0 && (
          <View style={styles.toggleBadge}>
            <Text style={styles.toggleBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: position.getTranslateTransform(),
        },
      ]}
      {...panResponder.panHandlers}
    >
      <View style={styles.chatHead}>
        <Ionicons name="chatbubble-ellipses" size={26} color="#FFFFFF" />
      </View>

      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 999,
    elevation: 12,
  },
  chatHead: {
    width: CHAT_HEAD_SIZE,
    height: CHAT_HEAD_SIZE,
    borderRadius: CHAT_HEAD_SIZE / 2,
    backgroundColor: '#0033A0',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
  },
  badge: {
    position: 'absolute',
    right: -2,
    top: -2,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ED2939',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  toggleTab: {
    position: 'absolute',
    width: TOGGLE_TAB_WIDTH,
    height: TOGGLE_TAB_HEIGHT,
    backgroundColor: '#0033A0',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    zIndex: 999,
    elevation: 11,
  },
  toggleBadge: {
    position: 'absolute',
    right: -8,
    top: -8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ED2939',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  toggleBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
});
