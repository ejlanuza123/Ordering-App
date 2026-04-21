// src/__tests__/services/chatService.test.js
import { chatService } from '../../services/chatService';

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    channel: jest.fn()
  }
}));

import { supabase } from '../../lib/supabase';

describe('chatService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getOrCreateOrderConversation', () => {
    it('returns existing conversation if found', async () => {
      const mockConversation = {
        id: 'conv-1',
        type: 'customer_rider',
        order_id: 'order-1',
        created_at: '2026-04-20T00:00:00Z'
      };

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockConversation, error: null })
          })
        })
      });

      const result = await chatService.getOrCreateOrderConversation('order-1', 'user-1', 'user-2');

      expect(result.success).toBe(true);
      expect(result.conversation).toEqual(mockConversation);
      expect(result.isNew).toBeUndefined();
    });

    it('creates new conversation if none exists', async () => {
      const mockNewConversation = {
        id: 'conv-2',
        type: 'customer_rider',
        order_id: 'order-2',
        created_at: '2026-04-20T00:00:00Z'
      };

      const insertMock = jest.fn()
        .mockReturnValueOnce({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
          })
        })
        .mockReturnValueOnce({
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: mockNewConversation, error: null })
            })
          })
        })
        .mockReturnValueOnce({
          insert: jest.fn().mockResolvedValue({ error: null })
        });

      supabase.from.mockImplementation((table) => {
        if (table === 'conversations') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
              })
            }),
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: mockNewConversation, error: null })
              })
            })
          };
        }
        if (table === 'conversation_participants') {
          return {
            insert: jest.fn().mockResolvedValue({ error: null })
          };
        }
      });

      const result = await chatService.getOrCreateOrderConversation('order-2', 'user-1', 'user-2');

      expect(result.success).toBe(true);
      expect(result.conversation).toEqual(mockNewConversation);
      expect(result.isNew).toBe(true);
    });

    it('returns error if conversation fetch fails', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database error' }
            })
          })
        })
      });

      const result = await chatService.getOrCreateOrderConversation('order-1', 'user-1', 'user-2');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });
  });

  describe('sendMessage', () => {
    it('sends a message successfully', async () => {
      const mockMessage = {
        id: 'msg-1',
        conversation_id: 'conv-1',
        sender_id: 'user-1',
        content: 'Hello',
        created_at: '2026-04-20T00:00:00Z',
        profiles: {
          id: 'user-1',
          full_name: 'John Doe',
          avatar_url: null,
          role: 'customer'
        }
      };

      supabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockMessage, error: null })
          })
        })
      });

      const result = await chatService.sendMessage('conv-1', 'user-1', 'Hello');

      expect(result.success).toBe(true);
      expect(result.message).toEqual(mockMessage);
    });

    it('returns error for empty message', async () => {
      const result = await chatService.sendMessage('conv-1', 'user-1', '   ');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Message cannot be empty');
    });

    it('returns error if send fails', async () => {
      supabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Insert failed' }
            })
          })
        })
      });

      const result = await chatService.sendMessage('conv-1', 'user-1', 'Hello');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Insert failed');
    });
  });

  describe('getMessages', () => {
    it('fetches messages for a conversation', async () => {
      const mockMessages = [
        {
          id: 'msg-1',
          conversation_id: 'conv-1',
          sender_id: 'user-1',
          content: 'First message',
          created_at: '2026-04-20T00:00:00Z',
          profiles: { id: 'user-1', full_name: 'John Doe', avatar_url: null, role: 'customer' }
        },
        {
          id: 'msg-2',
          conversation_id: 'conv-1',
          sender_id: 'user-2',
          content: 'Second message',
          created_at: '2026-04-20T00:01:00Z',
          profiles: { id: 'user-2', full_name: 'Jane Rider', avatar_url: null, role: 'rider' }
        }
      ];

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              range: jest.fn().mockResolvedValue({ data: mockMessages.reverse(), error: null })
            })
          })
        })
      });

      const result = await chatService.getMessages('conv-1', 100, 0);

      expect(result.success).toBe(true);
      expect(result.messages).toHaveLength(2);
    });
  });

  describe('markConversationAsSeen', () => {
    it('updates last_seen_at successfully', async () => {
      supabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null })
          })
        })
      });

      const result = await chatService.markConversationAsSeen('conv-1', 'user-1');

      expect(result.success).toBe(true);
    });

    it('returns error if update fails', async () => {
      supabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: { message: 'Update failed' } })
          })
        })
      });

      const result = await chatService.markConversationAsSeen('conv-1', 'user-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Update failed');
    });
  });

  describe('subscribeToMessages', () => {
    it('subscribes to messages and returns unsubscribe function', () => {
      const mockUnsubscribe = jest.fn();
      const mockOn = jest.fn().mockReturnValue({
        subscribe: jest.fn().mockReturnValue({
          unsubscribe: mockUnsubscribe
        })
      });

      supabase.channel.mockReturnValue({
        on: mockOn,
        subscribe: jest.fn().mockReturnValue({
          unsubscribe: mockUnsubscribe
        })
      });

      const mockCallback = jest.fn();
      const unsubscribe = chatService.subscribeToMessages('conv-1', mockCallback);

      expect(supabase.channel).toHaveBeenCalledWith('conversation-conv-1');
      expect(typeof unsubscribe).toBe('function');
    });
  });

  describe('getUnreadCount', () => {
    it('returns unread count', async () => {
      supabase.from.mockImplementation((table) => {
        if (table === 'conversation_participants') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({
                  data: [{ last_seen_at: '2026-04-20T00:00:00Z' }],
                  error: null
                })
              })
            })
          };
        }
        if (table === 'messages') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                gt: jest.fn().mockResolvedValue({ count: 5, error: null })
              })
            })
          };
        }
      });

      const result = await chatService.getUnreadCount('conv-1', 'user-1');

      expect(result.success).toBe(true);
      expect(result.unreadCount).toBe(5);
    });
  });
});
