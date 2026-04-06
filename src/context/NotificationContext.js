import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { mobileNotificationService } from '../services/mobileNotificationService';

const NotificationContext = createContext();
const SUPPORTED_ROLES = ['customer', 'rider'];
const getWelcomeNotificationKey = (userId, role) => `welcome_notification_shown_${userId}_${role}`;

export const NotificationProvider = ({ children }) => {
  const { user, role } = useAuth();
  const userId = user?.id;
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const notificationsEnabledRef = useRef(true);
  const welcomeInProgressRef = useRef(false);

  useEffect(() => {
    notificationsEnabledRef.current = notificationsEnabled;
  }, [notificationsEnabled]);

  // Send a one-time local welcome notification for first-time users and riders.
  useEffect(() => {
    if (!userId || !SUPPORTED_ROLES.includes(role)) {
      return;
    }

    const sendFirstTimeWelcomeNotification = async () => {
      if (welcomeInProgressRef.current) return;
      welcomeInProgressRef.current = true;

      try {
        const storageKey = getWelcomeNotificationKey(userId, role);
        const alreadyShown = await AsyncStorage.getItem(storageKey);

        if (alreadyShown === '1') {
          return;
        }

        const token = await mobileNotificationService.getDevicePushToken();
        if (token) {
          await mobileNotificationService.savePushToken(userId, token);
        }

        const title = role === 'rider' ? 'Welcome, Rider!' : 'Welcome to Petron San Pedro!';
        const body = role === 'rider'
          ? 'Use this app to accept deliveries, track routes, and update order status in real time.'
          : 'Use this app to order products, track deliveries, and get order updates in real time.';

        const result = await mobileNotificationService.sendLocalNotification(title, body, {
          type: 'first_time_welcome',
          role,
          userId,
        });

        if (result?.success) {
          await AsyncStorage.setItem(storageKey, '1');
        }
      } catch (error) {
        console.error('Error sending first-time welcome notification:', error?.message || error);
      } finally {
        welcomeInProgressRef.current = false;
      }
    };

    sendFirstTimeWelcomeNotification();
  }, [userId, role]);

  // Load user's notification preference
  const loadNotificationPreference = useCallback(async () => {
    if (!userId) return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('notifications_enabled')
        .eq('id', userId)
        .single();

      if (error) throw error;
      
      // Default to true if not set
      setNotificationsEnabled(data?.notifications_enabled !== false);
    } catch (error) {
      console.error('Error loading notification preference:', error.message);
      setNotificationsEnabled(true); // Default to enabled on error
    }
  }, [userId]);

  // Load notifications
  const loadNotifications = useCallback(async () => {
    if (!userId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      
      setNotifications(data || []);
      setUnreadCount(data?.filter(n => !n.is_read).length || 0);
    } catch (error) {
      console.error('Error loading notifications:', error.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Subscribe to new notifications
  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    loadNotificationPreference();
    loadNotifications();

    // Subscribe to new notifications
    const channel = supabase
      .channel('notifications-channel')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          // Only add notification if user has notifications enabled
          if (notificationsEnabledRef.current) {
            setNotifications(prev => [payload.new, ...prev]);
            setUnreadCount(prev => prev + 1);
          }
        }
      )
      .subscribe();

    // Refresh notifications when app comes to foreground
    const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        loadNotifications();
        loadNotificationPreference();
      }
    });

    return () => {
      if (channel) channel.unsubscribe();
      appStateSubscription.remove();
    };
  }, [userId, loadNotificationPreference, loadNotifications]);

  // Mark notification as read
  const markAsRead = async (notificationId) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId ? { ...n, is_read: true } : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error.message);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    if (!userId || notifications.length === 0) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) throw error;

      setNotifications(prev =>
        prev.map(n => ({ ...n, is_read: true }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error.message);
    }
  };

  // Delete notification
  const deleteNotification = async (notificationId) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      // Update unread count if the deleted notification was unread
      const deleted = notifications.find(n => n.id === notificationId);
      if (deleted && !deleted.is_read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error deleting notification:', error.message);
    }
  };

  // Clear all notifications
  const clearAll = async () => {
    if (!userId) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', userId);

      if (error) throw error;

      setNotifications([]);
      setUnreadCount(0);
    } catch (error) {
      console.error('Error clearing notifications:', error.message);
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        notificationsEnabled,
        loadNotifications,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        clearAll
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
};