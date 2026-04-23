// src/screens/customer/ChatListScreen.js
import React, { useState, useEffect, useRef, useMemo,useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Image, AppState } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { chatService } from '../../services/chatService';
import { formatDistanceToNow } from 'date-fns';

const RECONCILE_INTERVAL_MS = 75000;

const toMillis = (value) => {
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
};

const isConversationUnread = (conversation) => {
  const lastSeenMs = toMillis(conversation?.lastSeenAt);
  const updatedMs = toMillis(conversation?.updated_at);
  if (lastSeenMs === null || updatedMs === null) return false;
  return lastSeenMs < updatedMs;
};

const ChatListScreen = ({ navigation }) => {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const unsubscribeRef = useRef(null);
  const unreadUnsubscribeRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);
  const syncTimerRef = useRef(null);
  const bootstrapCompleteRef = useRef(false);

  const unreadCount = useMemo(
    () => conversations.filter((conversation) => isConversationUnread(conversation)).length,
    [conversations]
  );

  const loadConversations = useCallback(async (options = {}) => {
    const { showLoader = true } = options;
    if (!user?.id) return;

    if (showLoader) {
      setLoading(true);
    }

    const result = await chatService.getConversations(user.id);
    if (result.success) {
      setConversations(result.conversations);
    } else {
      console.error('Error loading conversations:', result.error);
    }

    if (showLoader) {
      setLoading(false);
    }
  }, [user?.id]);

  const handleForegroundResync = useCallback(() => {
    if (!bootstrapCompleteRef.current) {
      return;
    }

    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
    }

    syncTimerRef.current = setTimeout(() => {
      setIsSyncing(true);
    }, 500);

    loadConversations({ showLoader: false }).finally(() => {
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
      }
      setIsSyncing(false);
    });
  }, [loadConversations]);

  const handleScreenFocus = useCallback(() => {
    if (!bootstrapCompleteRef.current) {
      return;
    }

    loadConversations({ showLoader: false });
  }, [loadConversations]);

  const applyRealtimeConversationUpdate = useCallback((event) => {
    const row = event?.payload?.new;
    if (!row) return false;

    if (event.source === 'participants') {
      const conversationId = row.conversation_id;
      if (!conversationId) return false;

      let didChange = false;

      setConversations((prev) => {
        let changed = false;
        const next = prev.map((conversation) => {
          if (String(conversation.conversationId) !== String(conversationId)) {
            return conversation;
          }

          changed = true;
          return {
            ...conversation,
            lastSeenAt: row.last_seen_at || conversation.lastSeenAt
          };
        });

        didChange = changed;

        return changed ? next : prev;
      });

      return didChange;
    }

    if (event.source === 'messages') {
      const conversationId = row.conversation_id;
      if (!conversationId) return false;

      let didChange = false;

      setConversations((prev) => {
        const index = prev.findIndex(
          (conversation) => String(conversation.conversationId) === String(conversationId)
        );
        if (index === -1) return prev;

        const next = [...prev];
        const existing = next[index];
        const updatedAt = row.created_at || existing.updated_at;
        const lastSeenAt = row.sender_id === user?.id ? updatedAt : existing.lastSeenAt;
        const patched = {
          ...existing,
          updated_at: updatedAt,
          last_message: row.content || existing.last_message,
          lastSeenAt
        };

        didChange = true;
        next.splice(index, 1);
        return [patched, ...next];
      });

      return didChange;
    }

    return false;
  }, [user?.id]);

  useEffect(() => {
    const bootstrap = async () => {
      await loadConversations();
      bootstrapCompleteRef.current = true;
    };

    bootstrap();
    
    // Subscribe to new conversations
    if (user?.id) {
      unsubscribeRef.current = chatService.subscribeToConversations(
        user.id,
        (newConversation) => {
          setConversations((prev) => {
            const index = prev.findIndex((c) => String(c.conversationId) === String(newConversation.id));
            if (index > -1) {
              return prev;
            }

            return [{
              conversationId: newConversation.id,
              ...newConversation,
              participants: newConversation.conversation_participants || [],
              lastSeenAt: newConversation.updated_at
            }, ...prev];
          });
        }
      );

        unreadUnsubscribeRef.current = chatService.subscribeToUnreadChanges(user.id, (event) => {
          const handled = applyRealtimeConversationUpdate(event);
          if (!handled) {
            loadConversations({ showLoader: false });
          }
        });
    }

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }

        if (unreadUnsubscribeRef.current) {
          unreadUnsubscribeRef.current();
        }

      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
      }

      bootstrapCompleteRef.current = false;
    };
  }, [user?.id, loadConversations, applyRealtimeConversationUpdate]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      const wasInactive = appStateRef.current === 'inactive' || appStateRef.current === 'background';
      if (wasInactive && nextAppState === 'active') {
        handleForegroundResync();
      }
      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [handleForegroundResync]);

  useEffect(() => {
    const unsubscribeFocus = navigation.addListener('focus', handleScreenFocus);

    return () => {
      unsubscribeFocus();
    };
  }, [navigation, handleScreenFocus]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      if (!bootstrapCompleteRef.current) {
        return;
      }

      if (appStateRef.current !== 'active') {
        return;
      }

      loadConversations({ showLoader: false });
    }, RECONCILE_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, [loadConversations]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadConversations({ showLoader: false });
    setRefreshing(false);
  };

  const getOtherParticipant = (conversation) => {
    if (conversation?.custom_name) return conversation.custom_name;
    const other = conversation.participants?.find((p) => p.user_id !== user?.id);
    return other?.profiles?.full_name || (conversation.type === 'admin_rider' ? 'Admin Support' : 'Rider');
  };

  const getOrderReference = (conversation) => {
    const orderId = conversation?.orders?.id ?? conversation?.order_id ?? null;
    if (orderId === null || orderId === undefined || orderId === '') {
      return 'Unknown';
    }

    return String(orderId).slice(0, 8);
  };

  const getAvatarSource = (participant) => participant?.profiles?.avatar_url ? { uri: participant.profiles.avatar_url } : null;

  const getInitials = (name) => {
    const parts = (name || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'U';
    return parts.slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  };

  const renderConversation = ({ item }) => {
    const otherName = getOtherParticipant(item);
    const otherParticipant = item.participants?.find((p) => p.user_id !== user?.id);
    const avatarSource = getAvatarSource(otherParticipant);
    const timeAgo = formatDistanceToNow(new Date(item.updated_at), { addSuffix: true });
    const isUnread = isConversationUnread(item);
    const preview = item.last_message || (item.type === 'customer_rider' ? `Order #${getOrderReference(item)} chat` : 'Direct support chat');

    return (
      <TouchableOpacity
        style={[styles.conversationItem, isUnread && styles.unreadConversation]}
        onPress={() => navigation.navigate('ChatThread', { conversationId: item.conversationId })}
        activeOpacity={0.85}
      >
        <View style={styles.avatarWrap}>
          <View style={styles.avatarRing}>
            {avatarSource ? (
              <Image source={avatarSource} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarFallbackText}>{getInitials(otherName)}</Text>
              </View>
            )}
          </View>
          {isUnread && <View style={styles.avatarDot} />}
        </View>
        <View style={styles.conversationContent}>
          <View style={styles.conversationHeader}>
            <View style={styles.titleBlock}>
              <Text style={[styles.conversationName, isUnread && styles.unreadText]}>
                {otherName}
              </Text>
              <Text style={styles.conversationTime}>{timeAgo}</Text>
            </View>
          </View>
          <Text style={[styles.messagePreview, isUnread && styles.unreadText]} numberOfLines={1}>
            {preview}
          </Text>
          {item.type === 'customer_rider' && item.orders && (
            <Text style={styles.conversationMeta}>
              Order #{getOrderReference(item)} • {item.orders.status}
            </Text>
          )}
        </View>
        {isUnread && <View style={styles.unreadBadge} />}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#ED2939" />
      </View>
    );
  }

  if (conversations.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No conversations yet</Text>
        <Text style={styles.emptySubtext}>Start a chat with a rider from your orders</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.backgroundCanvas}>
        <View style={[styles.backgroundOrb, styles.backgroundOrbTop]} />
        <View style={[styles.backgroundOrb, styles.backgroundOrbMid]} />
        <View style={[styles.backgroundOrb, styles.backgroundOrbBottom]} />
      </View>
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: 14 }]}> 
          <View style={styles.headerTextBlock}>
            <Text style={styles.headerKicker}>Messages</Text>
            <Text style={styles.headerTitle}>My Chats</Text>
            <Text style={styles.headerSubtitle}>Keep track of rider conversations tied to your orders</Text>
            <View style={styles.inlineCountRow}>
              <View style={styles.headerPill}>
                <Ionicons name="chatbubbles" size={14} color="#0033A0" />
                <Text style={styles.headerPillText}>{unreadCount} unread</Text>
              </View>
              {isSyncing && (
                <View style={styles.syncingPill}>
                  <Text style={styles.syncingPillText}>Syncing...</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        <FlatList
          data={conversations}
          renderItem={renderConversation}
          keyExtractor={(item) => item.conversationId}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ED2939" colors={['#ED2939']} />}
          contentContainerStyle={conversations.length === 0 ? styles.emptyListContent : styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="chatbubble-ellipses-outline" size={34} color="#0033A0" />
              </View>
              <Text style={styles.emptyText}>No conversations yet</Text>
              <Text style={styles.emptySubtext}>Start a chat with a rider from your orders</Text>
            </View>
          }
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#EEF3FF'
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent'
  },
  backgroundCanvas: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#EEF3FF',
    overflow: 'hidden',
  },
  backgroundOrb: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 1,
  },
  backgroundOrbTop: {
    top: -40,
    left: -70,
    width: 220,
    height: 220,
    backgroundColor: 'rgba(237, 41, 57, 0.12)',
  },
  backgroundOrbMid: {
    top: 120,
    right: -90,
    width: 260,
    height: 260,
    backgroundColor: 'rgba(0, 51, 160, 0.10)',
  },
  backgroundOrbBottom: {
    bottom: -120,
    left: '22%',
    width: 320,
    height: 320,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12
  },
  headerTextBlock: {
    flex: 1,
    paddingRight: 12,
  },
  headerKicker: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    color: '#6B7280',
    marginBottom: 4
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.4
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#6B7280',
    maxWidth: 260
  },
  inlineCountRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#DDE4F2',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2
  },
  headerPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0033A0'
  },
  syncingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FDE68A',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  syncingPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20
  },
  emptyListContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingBottom: 20,
    justifyContent: 'center'
  },
  emptyContainer: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    borderRadius: 28,
    paddingVertical: 28,
    paddingHorizontal: 24,
    shadowColor: '#001B44',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.08,
    shadowRadius: 28,
    elevation: 4,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EAF1FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.72)',
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 4
  },
  unreadConversation: {
    borderColor: '#C7D8FF',
    backgroundColor: '#FFFFFF'
  },
  avatarWrap: {
    marginRight: 12,
    position: 'relative',
  },
  avatarRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    padding: 2,
    backgroundColor: '#EAF1FF',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
    backgroundColor: '#D1D5DB',
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0033A0',
  },
  avatarFallbackText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  avatarDot: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#fff',
  },
  conversationContent: {
    flex: 1
  },
  conversationHeader: {
    marginBottom: 4
  },
  titleBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8
  },
  conversationName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    flexShrink: 1
  },
  unreadText: {
    fontWeight: '700'
  },
  labelBadge: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#EEF2FF',
    borderRadius: 999
  },
  adminBadge: {
    backgroundColor: '#FDE8EA'
  },
  labelText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0033A0'
  },
  conversationTime: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2
  },
  messagePreview: {
    fontSize: 13,
    color: '#374151',
    marginTop: 2,
    marginBottom: 4,
  },
  conversationMeta: {
    fontSize: 13,
    color: '#4B5563',
    marginTop: 2
  },
  unreadBadge: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ED2939',
    marginLeft: 12,
    shadowColor: '#ED2939',
    shadowOpacity: 0.4,
    shadowRadius: 4
  }
});

export default ChatListScreen;
