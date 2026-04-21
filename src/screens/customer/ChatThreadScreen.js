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
  SafeAreaView
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { chatService } from '../../services/chatService';
import { format } from 'date-fns';

const ChatThreadScreen = ({ route, navigation }) => {
  const { conversationId } = route.params;
  const { user } = useAuth();
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
      // Load conversation details
      const convResult = await chatService.getConversation(conversationId);
      if (convResult.success) {
        setConversation(convResult.conversation);
      }

      // Load messages
      const messagesResult = await chatService.getMessages(conversationId, 100);
      if (messagesResult.success) {
        setMessages(messagesResult.messages);
      }

      // Mark as seen
      if (user?.id) {
        await chatService.markConversationAsSeen(conversationId, user.id);
      }

      // Subscribe to new messages
      unsubscribeRef.current = chatService.subscribeToMessages(
        conversationId,
        (newMsg) => {
          setMessages((prev) => [...prev, newMsg]);
          // Auto-scroll to bottom
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);
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

    const result = await chatService.sendMessage(conversationId, user.id, messageText);
    setSending(false);

    if (!result.success) {
      setNewMessage(messageText);
      console.error('Error sending message:', result.error);
    }
  };

  const getOtherParticipant = useCallback(() => {
    if (!conversation?.conversation_participants) return null;
    return conversation.conversation_participants.find((p) => p.user_id !== user?.id);
  }, [conversation, user?.id]);

  const renderMessage = ({ item }) => {
    const isCurrentUser = item.sender_id === user?.id;
    const senderName = item.profiles?.full_name || 'Unknown';

    return (
      <View style={[styles.messageContainer, isCurrentUser && styles.currentUserContainer]}>
        <View
          style={[styles.messageBubble, isCurrentUser && styles.currentUserBubble]}
        >
          {!isCurrentUser && (
            <Text style={styles.senderName}>{senderName}</Text>
          )}
          <Text style={[styles.messageText, isCurrentUser && styles.currentUserText]}>
            {item.content}
          </Text>
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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Text style={styles.participantName}>
            {otherParticipant?.profiles?.full_name || 'Rider'}
          </Text>
          {conversation?.type === 'customer_rider' && conversation?.orders && (
            <Text style={styles.orderInfo}>
              Order #{conversation.orders.id?.slice(0, 8)}
            </Text>
          )}
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
            <Text style={styles.emptyMessagesText}>No messages yet</Text>
          </View>
        }
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inputContainer}
      >
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          placeholderTextColor="#ccc"
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
        >
          <Text style={styles.sendButtonText}>
            {sending ? '...' : 'Send'}
          </Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0'
  },
  backButton: {
    fontSize: 16,
    color: '#ED2939',
    marginRight: 12
  },
  headerTitle: {
    flex: 1
  },
  participantName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333'
  },
  orderInfo: {
    fontSize: 12,
    color: '#999',
    marginTop: 2
  },
  messagesList: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexGrow: 1,
    justifyContent: 'flex-end'
  },
  emptyMessages: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  emptyMessagesText: {
    color: '#999',
    fontSize: 14
  },
  messageContainer: {
    marginVertical: 4,
    alignItems: 'flex-start'
  },
  currentUserContainer: {
    alignItems: 'flex-end'
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#f0f0f0'
  },
  currentUserBubble: {
    backgroundColor: '#ED2939'
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4
  },
  messageText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20
  },
  currentUserText: {
    color: '#fff'
  },
  messageTime: {
    fontSize: 11,
    color: '#999',
    marginTop: 4
  },
  currentUserTime: {
    color: 'rgba(255,255,255,0.7)'
  },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    alignItems: 'flex-end'
  },
  input: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: '#333',
    maxHeight: 100,
    marginRight: 8
  },
  sendButton: {
    backgroundColor: '#ED2939',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center'
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc'
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14
  }
});

export default ChatThreadScreen;
