// src/services/chatService.js
import { supabase } from '../lib/supabase';

export const chatService = {
  /**
   * Get or create a conversation between customer/rider and an order
   * Only for customer-rider chats linked to an order
   */
  async getOrCreateOrderConversation(orderId, currentUserId, otherUserId) {
    try {
      const { data, error } = await supabase.rpc('get_or_create_order_conversation', {
        p_order_id: orderId,
        p_current_user_id: currentUserId,
        p_other_user_id: otherUserId
      });

      if (error) throw error;

      const conversation = data?.conversation || data || null;

      return {
        success: true,
        conversation,
        isNew: Boolean(data?.is_new)
      };
    } catch (error) {
      console.error('Error getting/creating conversation:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get conversation by ID
   */
  async getConversation(conversationId) {
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          *,
          orders (id, status, total_amount),
          conversation_participants (
            user_id,
            joined_at,
            last_seen_at,
            profiles (id, full_name, avatar_url, role)
          )
        `)
        .eq('id', conversationId)
        .single();

      if (error) throw error;
      return { success: true, conversation: data };
    } catch (error) {
      console.error('Error fetching conversation:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get all conversations for the current user with participant info
   */
  async getConversations(userId, limit = 50) {
    try {
      const { data, error } = await supabase
        .from('conversation_participants')
        .select(`
          conversation_id,
          joined_at,
          last_seen_at,
          conversations (
            id,
            type,
            order_id,
            created_at,
            updated_at,
            orders (id, status, total_amount),
            conversation_participants (
              user_id,
              profiles (id, full_name, avatar_url)
            )
          )
        `)
        .eq('user_id', userId)
        .order('conversations(updated_at)', { ascending: false })
        .limit(limit);

      if (error) throw error;

      // Map to flattened structure
      const conversations = (data || []).map((p) => ({
        conversationId: p.conversation_id,
        ...p.conversations,
        participants: p.conversations.conversation_participants,
        lastSeenAt: p.last_seen_at
      }));

      return { success: true, conversations };
    } catch (error) {
      console.error('Error fetching conversations:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get messages in a conversation with pagination
   */
  async getMessages(conversationId, limit = 100, offset = 0) {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          profiles!sender_id (id, full_name, avatar_url, role)
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      return { success: true, messages: (data || []).reverse() };
    } catch (error) {
      console.error('Error fetching messages:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Send a message in a conversation
   */
  async sendMessage(conversationId, senderId, content) {
    if (!content || !content.trim()) {
      return { success: false, error: 'Message cannot be empty' };
    }

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert([
          {
            conversation_id: conversationId,
            sender_id: senderId,
            content: content.trim()
          }
        ])
        .select(`
          *,
          profiles!sender_id (id, full_name, avatar_url, role)
        `)
        .single();

      if (error) throw error;

      return { success: true, message: data };
    } catch (error) {
      console.error('Error sending message:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Subscribe to new messages in a conversation (realtime)
   */
  subscribeToMessages(conversationId, onNewMessage) {
    const channel = supabase
      .channel(`conversation-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          // Fetch sender profile for new message
          supabase
            .from('profiles')
            .select('id, full_name, avatar_url, role')
            .eq('id', payload.new.sender_id)
            .single()
            .then(({ data: profile }) => {
              onNewMessage({
                ...payload.new,
                profiles: profile
              });
            })
            .catch((err) => {
              console.error('Error fetching sender profile:', err);
              onNewMessage(payload.new);
            });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Subscribed to messages in conversation ${conversationId}`);
        }
      });

    return () => {
      channel.unsubscribe();
    };
  },

  /**
   * Subscribe to new conversations (realtime)
   */
  subscribeToConversations(userId, onNewConversation) {
    const channel = supabase
      .channel(`user-conversations-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversation_participants',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          // Fetch full conversation details
          supabase
            .from('conversations')
            .select(`
              *,
              conversation_participants (
                user_id,
                profiles (id, full_name, avatar_url)
              ),
              orders (id, status, total_amount)
            `)
            .eq('id', payload.new.conversation_id)
            .single()
            .then(({ data: conversation }) => {
              onNewConversation(conversation);
            })
            .catch((err) => {
              console.error('Error fetching new conversation:', err);
            });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Subscribed to conversations for user ${userId}`);
        }
      });

    return () => {
      channel.unsubscribe();
    };
  },

  /**
   * Subscribe to events that affect unread counters in realtime.
   */
  subscribeToUnreadChanges(userId, onUnreadChange) {
    const channel = supabase
      .channel(`unread-changes-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages'
        },
        (payload) => {
          if (typeof onUnreadChange === 'function') {
            onUnreadChange({ source: 'messages', payload });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversation_participants',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          if (typeof onUnreadChange === 'function') {
            onUnreadChange({ source: 'participants', payload });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversation_participants',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          if (typeof onUnreadChange === 'function') {
            onUnreadChange({ source: 'participants', payload });
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Subscribed to unread changes for user ${userId}`);
        }
      });

    return () => {
      channel.unsubscribe();
    };
  },

  /**
   * Update last_seen_at when user views a conversation
   * This marks the conversation as read for the current user
   */
  async markConversationAsSeen(conversationId, userId) {
    try {
      const { error } = await supabase
        .from('conversation_participants')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('user_id', userId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error marking conversation as seen:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get unread message count for a conversation
   */
  async getUnreadCount(conversationId, userId) {
    try {
      // Get user's last_seen_at
      const { data: participant, error: participantError } = await supabase
        .from('conversation_participants')
        .select('last_seen_at')
        .eq('conversation_id', conversationId)
        .eq('user_id', userId)
        .single();

      if (participantError) throw participantError;

      // Count messages since last_seen_at
      const { count, error: countError } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('conversation_id', conversationId)
        .gt('created_at', participant.last_seen_at);

      if (countError) throw countError;

      return { success: true, unreadCount: count || 0 };
    } catch (error) {
      console.error('Error getting unread count:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get other participants in a conversation
   */
  async getConversationParticipants(conversationId, excludeUserId = null) {
    try {
      let query = supabase
        .from('conversation_participants')
        .select(`
          user_id,
          joined_at,
          last_seen_at,
          profiles (id, full_name, avatar_url, role)
        `)
        .eq('conversation_id', conversationId);

      if (excludeUserId) {
        query = query.neq('user_id', excludeUserId);
      }

      const { data, error } = await query;

      if (error) throw error;

      return {
        success: true,
        participants: data || []
      };
    } catch (error) {
      console.error('Error fetching participants:', error);
      return { success: false, error: error.message };
    }
  }
};
