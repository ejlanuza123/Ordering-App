// src/screens/customer/ChatThreadScreen.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StatusBar,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useAuth } from '../../context/AuthContext';
import { chatService } from '../../services/chatService';

const ChatThreadScreen = ({ route, navigation }) => {
  const { conversationId } = route.params;
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [conversation, setConversation] = useState(null);
  const flatListRef = useRef(null);
  const unsubscribeRef = useRef(null);

  useEffect(() => {
    loadInitialData();
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [conversationId]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const convResult = await chatService.getConversation(conversationId);
      if (convResult.success) {
        setConversation(convResult.conversation);
      }

      const messagesResult = await chatService.getMessages(conversationId, 100);
      if (messagesResult.success) {
        setMessages(messagesResult.messages);
      }

      if (user?.id) {
        await chatService.markConversationAsSeen(conversationId, user.id);
      }

      unsubscribeRef.current = chatService.subscribeToMessages(conversationId, (newMsg) => {
        setMessages((prev) => {
          if (prev.some((message) => message.id === newMsg.id)) {
            return prev;
          }

          return [...prev, newMsg];
        });
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      });
    } catch (error) {
      console.error('Error loading chat thread:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !user?.id) return;

    setSending(true);
    const messageText = newMessage;
    setNewMessage('');

    const result = await chatService.sendMessage(conversationId, user.id, messageText);
    setSending(false);

    if (result.success && result.message) {
      setMessages((prev) => {
        if (prev.some((message) => message.id === result.message.id)) {
          return prev;
        }

        return [...prev, result.message];
      });

      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 50);
    }

    if (!result.success) {
      setNewMessage(messageText);
      console.error('Error sending message:', result.error);
    }
  };

  const getOtherParticipant = useCallback(() => {
    if (!conversation?.conversation_participants) return null;
    return conversation.conversation_participants.find((participant) => participant.user_id !== user?.id);
  }, [conversation, user?.id]);

  const getOrderReference = useCallback(() => {
    const orderId = conversation?.orders?.id ?? conversation?.order_id ?? null;
    if (orderId === null || orderId === undefined || orderId === '') {
      return 'Unknown';
    }

    return String(orderId).slice(0, 8);
  }, [conversation]);

  const getHeaderTitle = () => {
    return otherParticipant?.profiles?.full_name || 'Rider';
  };

  const getHeaderAvatarSource = () => {
    const avatarUrl = otherParticipant?.profiles?.avatar_url;
    return avatarUrl ? { uri: avatarUrl } : null;
  };

  const getInitials = (name) => {
    const parts = (name || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'R';
    return parts.slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  };

  const renderMessage = ({ item }) => {
    const isCurrentUser = item.sender_id === user?.id;
    const senderName = item.profiles?.full_name || 'Team Member';
    const senderAvatar = item.profiles?.avatar_url ? { uri: item.profiles.avatar_url } : null;

    return (
      <View style={[styles.messageContainer, isCurrentUser && styles.currentUserContainer]}>
        {!isCurrentUser && (
          <View style={styles.messageAvatarWrap}>
            {senderAvatar ? (
              <Image source={senderAvatar} style={styles.messageAvatar} />
            ) : (
              <View style={styles.messageAvatarFallback}>
                <Text style={styles.messageAvatarFallbackText}>{getInitials(senderName)}</Text>
              </View>
            )}
          </View>
        )}
        <View style={[styles.messageBubble, isCurrentUser && styles.currentUserBubble]}>
          {!isCurrentUser && <Text style={styles.senderName}>{senderName}</Text>}
          <Text style={[styles.messageText, isCurrentUser && styles.currentUserText]}>{item.content}</Text>
          <Text style={[styles.messageTime, isCurrentUser && styles.currentUserTime]}>
            {format(new Date(item.created_at), 'HH:mm')}
          </Text>
        </View>
      </View>
    );
  };

  const otherParticipant = getOtherParticipant();

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#ED2939" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F7FB" />

      <View style={styles.backgroundCanvas}>
        <View style={[styles.backgroundOrb, styles.backgroundOrbTop]} />
        <View style={[styles.backgroundOrb, styles.backgroundOrbMid]} />
        <View style={[styles.backgroundOrb, styles.backgroundOrbBottom]} />
      </View>

      <View style={[styles.headerShell, { paddingTop: Math.max(insets.top, 10) }]}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity style={styles.backButtonWrap} onPress={() => navigation.goBack()} activeOpacity={0.85}>
            <Ionicons name="chevron-back" size={18} color="#111827" />
            <Text style={styles.backButton}>Back</Text>
          </TouchableOpacity>

          <View style={styles.headerBadge}>
            <Ionicons name="chatbubbles" size={14} color="#0033A0" />
            <Text style={styles.headerBadgeText}>
              {conversation?.type === 'customer_rider' ? 'Order chat' : 'Support chat'}
            </Text>
          </View>
        </View>

        <View style={styles.headerCard}>
          <View style={styles.avatar}>
            {getHeaderAvatarSource() ? (
              <Image source={getHeaderAvatarSource()} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarFallbackText}>{getInitials(getHeaderTitle())}</Text>
            )}
          </View>
          <View style={styles.headerCopy}>
            <Text style={styles.participantName} numberOfLines={1}>
              {getHeaderTitle()}
            </Text>
            {conversation?.type === 'customer_rider' && conversation?.orders ? (
              <Text style={styles.orderInfo}>Order #{getOrderReference()}</Text>
            ) : (
              <Text style={styles.orderInfo}>Keep the conversation focused on delivery updates</Text>
            )}
          </View>
        </View>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <View style={styles.emptyMessages}>
            <View style={styles.emptyMessagesCard}>
              <Ionicons name="chatbubble-ellipses-outline" size={28} color="#0033A0" />
              <Text style={styles.emptyMessagesText}>No messages yet</Text>
              <Text style={styles.emptyMessagesSubtext}>Send the first update to keep the order moving.</Text>
            </View>
          </View>
        }
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, 12) }]}
      >
        <View style={styles.composerCard}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor="#9CA3AF"
            value={newMessage}
            onChangeText={setNewMessage}
            editable={!sending}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!newMessage.trim() || sending) && styles.sendButtonDisabled]}
            onPress={handleSendMessage}
            disabled={!newMessage.trim() || sending}
            activeOpacity={0.85}
          >
            <Text style={styles.sendButtonText}>{sending ? '...' : 'Send'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#EEF3FF',
  },
  backgroundCanvas: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#EEF3FF',
    overflow: 'hidden',
  },
  backgroundOrb: {
    position: 'absolute',
    borderRadius: 999,
  },
  backgroundOrbTop: {
    top: -50,
    right: -80,
    width: 220,
    height: 220,
    backgroundColor: 'rgba(0, 51, 160, 0.14)',
  },
  backgroundOrbMid: {
    top: 120,
    left: -90,
    width: 260,
    height: 260,
    backgroundColor: 'rgba(237, 41, 57, 0.08)',
  },
  backgroundOrbBottom: {
    bottom: -140,
    left: '24%',
    width: 340,
    height: 340,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
  },
  headerShell: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: 'transparent',
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  backButtonWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  backButton: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginLeft: 4,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EDF3FF',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  headerBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0033A0',
  },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0033A0',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
    backgroundColor: '#D1D5DB',
  },
  avatarFallbackText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  headerCopy: {
    flex: 1,
  },
  participantName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.2,
  },
  orderInfo: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
  },
  messagesList: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexGrow: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  emptyMessages: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyMessagesCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 24,
    maxWidth: 280,
  },
  emptyMessagesText: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 10,
  },
  emptyMessagesSubtext: {
    color: '#6B7280',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  messageContainer: {
    marginVertical: 4,
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
  },
  currentUserContainer: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  messageAvatarWrap: {
    marginTop: 2,
  },
  messageAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#D1D5DB',
  },
  messageAvatarFallback: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#0033A0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageAvatarFallbackText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  currentUserBubble: {
    backgroundColor: '#ED2939',
    borderColor: '#ED2939',
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  currentUserText: {
    color: '#fff',
  },
  messageTime: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 4,
  },
  currentUserTime: {
    color: 'rgba(255,255,255,0.7)',
  },
  inputContainer: {
    paddingHorizontal: 12,
    paddingTop: 8,
    backgroundColor: 'transparent',
  },
  composerCard: {
    marginHorizontal: 2,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 110,
    fontSize: 16,
    color: '#111827',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  sendButton: {
    backgroundColor: '#ED2939',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 11,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#F3F4F6',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default ChatThreadScreen;