// src/screens/rider/ChatListScreen.js
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { chatService } from '../../services/chatService';
import { formatDistanceToNow } from 'date-fns';

const RiderChatListScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const unsubscribeRef = useRef(null);

  useEffect(() => {
    loadConversations();
    
    // Subscribe to new conversations
    if (user?.id) {
      unsubscribeRef.current = chatService.subscribeToConversations(
        user.id,
        (newConversation) => {
          setConversations((prev) => {
            const index = prev.findIndex((c) => c.id === newConversation.id);
            if (index > -1) {
              return prev;
            }
            return [newConversation, ...prev];
          });
        }
      );
    }

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [user?.id]);

  const loadConversations = async () => {
    if (!user?.id) return;

    setLoading(true);
    const result = await chatService.getConversations(user.id);
    if (result.success) {
      setConversations(result.conversations);
    } else {
      console.error('Error loading conversations:', result.error);
    }
    setLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadConversations();
    setRefreshing(false);
  };

  const getOtherParticipant = (conversation) => {
    const other = conversation.participants?.find((p) => p.user_id !== user?.id);
    return other?.profiles?.full_name || 'Unknown';
  };

  const getConversationLabel = (conversation) => {
    if (conversation.type === 'customer_rider') {
      return 'Customer';
    }
    return 'Admin';
  };

  const renderConversation = ({ item }) => {
    const otherName = getOtherParticipant(item);
    const label = getConversationLabel(item);
    const timeAgo = formatDistanceToNow(new Date(item.updated_at), { addSuffix: true });
    const isUnread = new Date(item.lastSeenAt) < new Date(item.updated_at);

    return (
      <TouchableOpacity
        style={[styles.conversationItem, isUnread && styles.unreadConversation]}
        onPress={() => navigation.navigate('ChatThread', { conversationId: item.conversationId })}
      >
        <View style={styles.conversationContent}>
          <View style={styles.conversationHeader}>
            <View style={styles.titleRow}>
              <Text style={[styles.conversationName, isUnread && styles.unreadText]}>
                {otherName}
              </Text>
              <View style={[styles.labelBadge, label === 'Admin' && styles.adminBadge]}>
                <Text style={styles.labelText}>{label}</Text>
              </View>
            </View>
            <Text style={styles.conversationTime}>{timeAgo}</Text>
          </View>
          {item.type === 'customer_rider' && item.orders && (
            <Text style={styles.conversationMeta}>
              Order #{item.orders.id?.slice(0, 8)} • {item.orders.status}
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
        <Text style={styles.emptySubtext}>Chat with customers about orders or with admin</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={conversations}
        renderItem={renderConversation}
        keyExtractor={(item) => item.conversationId}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff'
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999'
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0'
  },
  unreadConversation: {
    backgroundColor: '#f9f9f9'
  },
  conversationContent: {
    flex: 1
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8
  },
  conversationName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333'
  },
  unreadText: {
    fontWeight: '700'
  },
  labelBadge: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#f0f0f0',
    borderRadius: 4
  },
  adminBadge: {
    backgroundColor: '#ED2939'
  },
  labelText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666'
  },
  adminBadgeText: {
    color: '#fff'
  },
  conversationTime: {
    fontSize: 12,
    color: '#999'
  },
  conversationMeta: {
    fontSize: 13,
    color: '#666'
  },
  unreadBadge: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ED2939',
    marginLeft: 12
  }
});

export default RiderChatListScreen;
