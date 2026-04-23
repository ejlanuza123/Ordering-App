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
  AppState,
  Modal,
  Alert,
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
  const scrollToLatest = useCallback((animated = true) => {
    requestAnimationFrame(() => {
      flatListRef.current?.scrollToEnd({ animated });
    });
  }, []);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [conversation, setConversation] = useState(null);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [messageMenuVisible, setMessageMenuVisible] = useState(false);
  const [conversationMenuVisible, setConversationMenuVisible] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [messageActionPosition, setMessageActionPosition] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');
  const [conversationActionBusy, setConversationActionBusy] = useState(false);
  const flatListRef = useRef(null);
  const unsubscribeRef = useRef(null);
  const seenUnsubscribeRef = useRef(null);
  const messageMutationUnsubscribeRef = useRef(null);
  const typingSubscriptionRef = useRef(null);
  const typingStopTimeoutRef = useRef(null);
  const localTypingActiveRef = useRef(false);
  const appStateRef = useRef(AppState.currentState);

  const resyncThreadData = useCallback(async () => {
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
  }, [conversationId, user?.id]);

  useEffect(() => {
    loadInitialData();
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
      if (typingSubscriptionRef.current) {
        typingSubscriptionRef.current.unsubscribe();
      }
      if (typingStopTimeoutRef.current) {
        clearTimeout(typingStopTimeoutRef.current);
      }
      if (seenUnsubscribeRef.current) {
        seenUnsubscribeRef.current();
      }
      if (messageMutationUnsubscribeRef.current) {
        messageMutationUnsubscribeRef.current();
      }
    };
  }, [conversationId, user?.id]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      const wasInactive = appStateRef.current === 'inactive' || appStateRef.current === 'background';
      if (wasInactive && nextAppState === 'active') {
        resyncThreadData();
      }
      appStateRef.current = nextAppState;
    });

    const unsubscribeFocus = navigation.addListener('focus', () => {
      resyncThreadData();
    });

    return () => {
      subscription.remove();
      unsubscribeFocus();
    };
  }, [navigation, resyncThreadData]);

  useEffect(() => {
    if (!loading && messages.length > 0) {
      scrollToLatest(false);
    }
  }, [loading, messages.length, scrollToLatest]);

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
        scrollToLatest(true);
      });

      if (messageMutationUnsubscribeRef.current) {
        messageMutationUnsubscribeRef.current();
      }

      messageMutationUnsubscribeRef.current = chatService.subscribeToMessageMutations(
        conversationId,
        {
          onUpdate: (updatedMessage) => {
            setMessages((prev) => prev.map((message) => (
              message.id === updatedMessage.id ? { ...message, ...updatedMessage } : message
            )));
          },
          onDelete: (deletedMessage) => {
            setMessages((prev) => prev.filter((message) => message.id !== deletedMessage.id));
          }
        }
      );

      if (typingSubscriptionRef.current) {
        typingSubscriptionRef.current.unsubscribe();
      }

      if (user?.id) {
        typingSubscriptionRef.current = chatService.subscribeToTyping(conversationId, user.id, (typingUserIds) => {
          setIsOtherTyping((typingUserIds || []).length > 0);
        });
      }

      if (seenUnsubscribeRef.current) {
        seenUnsubscribeRef.current();
      }

      seenUnsubscribeRef.current = chatService.subscribeToConversationParticipantSeen(
        conversationId,
        (participantUpdate) => {
          setConversation((prevConversation) => {
            if (!prevConversation?.conversation_participants) return prevConversation;

            return {
              ...prevConversation,
              conversation_participants: prevConversation.conversation_participants.map((participant) => (
                participant.user_id === participantUpdate.user_id
                  ? { ...participant, last_seen_at: participantUpdate.last_seen_at }
                  : participant
              ))
            };
          });
        }
      );
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

    if (typingStopTimeoutRef.current) {
      clearTimeout(typingStopTimeoutRef.current);
    }
    localTypingActiveRef.current = false;
    typingSubscriptionRef.current?.setTyping(false);

    const result = editingMessageId
      ? await chatService.editMessage(editingMessageId, user.id, messageText)
      : await chatService.sendMessage(conversationId, user.id, messageText);
    setSending(false);

    if (result.success && result.message) {
      setMessages((prev) => {
        if (editingMessageId) {
          return prev.map((message) => (
            message.id === result.message.id ? { ...message, ...result.message } : message
          ));
        }

        if (prev.some((message) => message.id === result.message.id)) {
          return prev;
        }

        return [...prev, result.message];
      });

      scrollToLatest(true);
    }

    if (!result.success) {
      setNewMessage(messageText);
      console.error('Error sending message:', result.error);
    }

    if (editingMessageId) {
      setEditingMessageId(null);
    }
  };

  const handleMessageLongPress = (message) => {
    if (!message?.id || message.sender_id !== user?.id) return;

    setSelectedMessage(message);
    setMessageMenuVisible(true);
  };

  const handleConversationActions = () => {
    setConversationMenuVisible(true);
  };

  const handleEditSelectedMessage = () => {
    if (!selectedMessage?.id) return;

    setEditingMessageId(selectedMessage.id);
    setNewMessage(selectedMessage.content || '');
    setMessageMenuVisible(false);
  };

  const handleDeleteSelectedMessage = async () => {
    if (!selectedMessage?.id || !user?.id) return;

    const result = await chatService.deleteMessage(selectedMessage.id, user.id);
    if (!result.success) {
      console.error('Delete failed:', result.error || 'Failed to delete message');
      return;
    }

    setMessages((prev) => prev.filter((item) => item.id !== selectedMessage.id));
    if (editingMessageId === selectedMessage.id) {
      setEditingMessageId(null);
      setNewMessage('');
    }
    setMessageMenuVisible(false);
    setSelectedMessage(null);
  };

  const handleDeleteConversation = async () => {
    Alert.alert(
      'Delete Conversation',
      'Are you sure you want to delete this conversation? This action cannot be undone.',
      [
        { text: 'Cancel', onPress: () => {}, style: 'cancel' },
        {
          text: 'Delete',
          onPress: async () => {
            const result = await chatService.deleteConversation(conversationId);
            if (!result.success) {
              console.error('Delete conversation failed:', result.error || 'Failed to delete conversation');
              return;
            }

            setConversationMenuVisible(false);
            navigation.goBack();
          },
          style: 'destructive',
        },
      ]
    );
  };

  const handleRenameConversation = async () => {
    if (conversationActionBusy) return;

    setConversationActionBusy(true);
    const result = await chatService.updateConversationName(conversationId, renameDraft);
    setConversationActionBusy(false);

    if (!result.success) {
      console.error('Rename failed:', result.error || 'Failed to rename conversation');
      return;
    }

    setConversation((prev) => ({
      ...(prev || {}),
      custom_name: result.conversation?.custom_name ?? null
    }));
    setRenameModalVisible(false);
  };

  const handleMessageChange = (value) => {
    setNewMessage(value);

    const hasText = value.trim().length > 0;
    if (hasText && !localTypingActiveRef.current) {
      localTypingActiveRef.current = true;
      typingSubscriptionRef.current?.setTyping(true);
    }

    if (!hasText && localTypingActiveRef.current) {
      localTypingActiveRef.current = false;
      typingSubscriptionRef.current?.setTyping(false);
      if (typingStopTimeoutRef.current) {
        clearTimeout(typingStopTimeoutRef.current);
      }
      return;
    }

    if (typingStopTimeoutRef.current) {
      clearTimeout(typingStopTimeoutRef.current);
    }

    if (hasText) {
      typingStopTimeoutRef.current = setTimeout(() => {
        localTypingActiveRef.current = false;
        typingSubscriptionRef.current?.setTyping(false);
      }, 1500);
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
    return conversation?.custom_name || otherParticipant?.profiles?.full_name || 'Rider';
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

    const otherLastSeenAt = otherParticipant?.last_seen_at ? new Date(otherParticipant.last_seen_at) : null;
    const messageTime = new Date(item.created_at);
    const isMessageSeen = Boolean(
      isCurrentUser &&
      otherLastSeenAt &&
      !Number.isNaN(otherLastSeenAt.getTime()) &&
      !Number.isNaN(messageTime.getTime()) &&
      messageTime <= otherLastSeenAt
    );

    return (
      <TouchableOpacity
        style={[styles.messageContainer, isCurrentUser && styles.currentUserContainer]}
        activeOpacity={0.9}
        onLongPress={() => handleMessageLongPress(item)}
        delayLongPress={220}
      >
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
          {isCurrentUser && (
            <TouchableOpacity
              style={styles.messageActionTrigger}
              onPress={() => {
                setSelectedMessage(item);
                setMessageMenuVisible(true);
              }}
              onLayout={(event) => {
                const { x, y, width, height } = event.nativeEvent.layout;
                setMessageActionPosition({ x, y, width, height });
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="ellipsis-horizontal" size={12} color="rgba(255,255,255,0.88)" />
            </TouchableOpacity>
          )}
          {isCurrentUser && (
            <View style={styles.messageReceipt}>
              <Ionicons
                name={isMessageSeen ? 'checkmark-done' : 'checkmark'}
                size={12}
                color={isMessageSeen ? '#BFDBFE' : 'rgba(255,255,255,0.68)'}
              />
            </View>
          )}
        </View>
      </TouchableOpacity>
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

          <TouchableOpacity style={styles.headerActionButton} onPress={handleConversationActions} activeOpacity={0.85}>
            <Ionicons name="ellipsis-horizontal" size={16} color="#111827" />
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
            {isOtherTyping && <Text style={styles.typingInfo}>typing...</Text>}
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

      {editingMessageId && (
        <View style={styles.editingBar}>
          <Text style={styles.editingBarText}>Editing message</Text>
          <TouchableOpacity onPress={() => { setEditingMessageId(null); setNewMessage(''); }}>
            <Text style={styles.editingBarCancel}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

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
            onChangeText={handleMessageChange}
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
            <Text style={styles.sendButtonText}>{sending ? '...' : (editingMessageId ? 'Save' : 'Send')}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={conversationMenuVisible} transparent animationType="fade" onRequestClose={() => setConversationMenuVisible(false)}>
        <TouchableOpacity style={styles.menuBackdrop} activeOpacity={1} onPress={() => setConversationMenuVisible(false)}>
          <View style={styles.dropdownMenuCard}>
            <TouchableOpacity style={styles.dropdownMenuItem} onPress={() => { setConversationMenuVisible(false); setRenameDraft(conversation?.custom_name || ''); setRenameModalVisible(true); }}>
              <Text style={styles.dropdownMenuItemText}>Rename</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dropdownMenuItem} onPress={handleDeleteConversation}>
              <Text style={[styles.dropdownMenuItemText, styles.dropdownMenuItemDanger]}>Delete conversation</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={messageMenuVisible} transparent animationType="fade" onRequestClose={() => setMessageMenuVisible(false)}>
        <TouchableOpacity style={[styles.menuBackdrop, { justifyContent: 'center' }]} activeOpacity={1} onPress={() => setMessageMenuVisible(false)}>
          <View style={[styles.dropdownMenuCard, { marginRight: 18 }]}>
            <TouchableOpacity style={styles.dropdownMenuItem} onPress={handleEditSelectedMessage}>
              <Text style={styles.dropdownMenuItemText}>Edit message</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dropdownMenuItem} onPress={handleDeleteSelectedMessage}>
              <Text style={[styles.dropdownMenuItemText, styles.dropdownMenuItemDanger]}>Delete message</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={renameModalVisible} transparent animationType="fade" onRequestClose={() => setRenameModalVisible(false)}>
        <View style={styles.renameModalBackdrop}>
          <View style={styles.renameModalCard}>
            <Text style={styles.renameModalTitle}>Rename conversation</Text>
            <TextInput
              style={styles.renameModalInput}
              value={renameDraft}
              onChangeText={setRenameDraft}
              placeholder="Conversation name"
              maxLength={80}
            />
            <View style={styles.renameModalActions}>
              <TouchableOpacity onPress={() => setRenameModalVisible(false)} style={styles.renameModalButton}>
                <Text style={styles.renameModalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleRenameConversation} style={[styles.renameModalButton, styles.renameModalButtonPrimary]}>
                <Text style={[styles.renameModalButtonText, styles.renameModalButtonPrimaryText]}>
                  {conversationActionBusy ? 'Saving...' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  headerActionButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
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
  typingInfo: {
    fontSize: 13,
    color: '#0033A0',
    marginTop: 4,
    fontWeight: '700',
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
  messageReceipt: {
    alignSelf: 'flex-end',
    marginTop: 2,
  },
  messageActionTrigger: {
    alignSelf: 'flex-end',
    marginTop: 4,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  inputContainer: {
    paddingHorizontal: 12,
    paddingTop: 8,
    backgroundColor: 'transparent',
  },
  editingBar: {
    marginHorizontal: 14,
    marginTop: 4,
    marginBottom: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 51, 160, 0.2)',
    backgroundColor: 'rgba(219, 234, 254, 0.62)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  editingBarText: {
    fontSize: 12,
    color: '#1D4ED8',
    fontWeight: '700',
  },
  editingBarCancel: {
    fontSize: 12,
    color: '#B91C1C',
    fontWeight: '700',
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
  renameModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.35)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.2)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingRight: 18,
  },
  dropdownMenuCard: {
    width: 190,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.2)',
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  dropdownMenuItem: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dropdownMenuItemText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  dropdownMenuItemDanger: {
    color: '#B91C1C',
  },
  renameModalCard: {
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.22)',
    padding: 16,
  },
  renameModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 10,
  },
  renameModalInput: {
    borderWidth: 1,
    borderColor: '#D1D9E6',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    marginBottom: 12,
  },
  renameModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  renameModalButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
  },
  renameModalButtonPrimary: {
    backgroundColor: '#0033A0',
  },
  renameModalButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  renameModalButtonPrimaryText: {
    color: '#FFFFFF',
  },
});

export default ChatThreadScreen;