import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';

const MAX_NOTIFICATION_LIMIT = 100;
const DEFAULT_NOTIFICATION_LIMIT = 50;
const ANDROID_NOTIFICATION_CHANNEL = 'default';
let channelReady = false;

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export const mobileNotificationService = {
  async ensureAndroidNotificationChannel() {
    if (Platform.OS !== 'android' || channelReady) {
      return;
    }

    try {
      await Notifications.setNotificationChannelAsync(ANDROID_NOTIFICATION_CHANNEL, {
        name: 'Default',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
      channelReady = true;
    } catch (error) {
      console.error('Error creating Android notification channel:', error);
    }
  },

  getExpoProjectId() {
    return (
      Constants?.easConfig?.projectId ||
      Constants?.expoConfig?.extra?.eas?.projectId ||
      Constants?.manifest2?.extra?.eas?.projectId ||
      Constants?.manifest?.extra?.eas?.projectId ||
      null
    );
  },

  /**
   * Get device push token
   */
  async getDevicePushToken() {
    try {
      if (!Device.isDevice) {
        console.warn('Push notifications only work on physical devices');
        return null;
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('Failed to get notification permission');
        return null;
      }

      const projectId = this.getExpoProjectId();

      if (!projectId) {
        // Local notifications can still work without EAS project ID.
        console.warn('Push token skipped: EAS projectId is not configured in app config');
        return null;
      }

      const token = await Notifications.getExpoPushTokenAsync({ projectId });
      return token.data;
    } catch (error) {
      console.error('Error getting push token:', error);
      return null;
    }
  },

  /**
   * Set up notification listeners
   */
  setupNotificationListeners(onNotificationReceived) {
    // Notification received while app is in foreground
    const foregroundSubscription = Notifications.addNotificationReceivedListener(
      (notification) => {
        onNotificationReceived(notification);
      }
    );

    // Notification tapped 
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const { notification } = response;
        onNotificationReceived(notification, 'tapped');
      }
    );

    return () => {
      foregroundSubscription.remove();
      responseSubscription.remove();
    };
  },

  /**
   * Save push token to database
   */
  async savePushToken(userId, token) {
    if (!userId) {
      return { success: false, error: 'Missing userId' };
    }

    if (!token || typeof token !== 'string' || !token.trim()) {
      return { success: false, error: 'Invalid push token' };
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ fcm_token: token.trim() })
        .eq('id', userId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error saving push token:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Send local test notification
   */
  async sendLocalNotification(title, message, data = {}) {
    try {
      await this.ensureAndroidNotificationChannel();

      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body: message,
          data,
          sound: true,
          badge: 1,
          ...(Platform.OS === 'android' ? { channelId: ANDROID_NOTIFICATION_CHANNEL } : {}),
        },
        trigger: null,
      });
      return { success: true };
    } catch (error) {
      console.error('Error sending notification:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Subscribe to notifications from Supabase
   */
  subscribeToNotifications(userId, onNewNotification) {
    if (!userId) {
      return () => {};
    }

    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          const notification = payload.new;
          // Show local notification
          this.ensureAndroidNotificationChannel();
          Notifications.scheduleNotificationAsync({
            content: {
              title: notification.title,
              body: notification.message,
              data: { notificationId: notification.id, ...notification.data },
              sound: true,
              badge: 1,
              ...(Platform.OS === 'android' ? { channelId: ANDROID_NOTIFICATION_CHANNEL } : {}),
            },
            trigger: null,
          }).catch((error) => {
            console.error('Error scheduling local notification:', error);
          });

          onNewNotification(notification);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Subscribed to notifications');
        }
      });

    return () => {
      channel.unsubscribe();
    };
  },

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId) {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get all notifications for user
   */
  async getNotifications(userId, limit = 50) {
    if (!userId) {
      return { success: false, error: 'Missing userId' };
    }

    const parsedLimit = Number.parseInt(String(limit), 10);
    const safeLimit = Number.isFinite(parsedLimit)
      ? Math.max(1, Math.min(parsedLimit, MAX_NOTIFICATION_LIMIT))
      : DEFAULT_NOTIFICATION_LIMIT;

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(safeLimit);

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error fetching notifications:', error);
      return { success: false, error: error.message };
    }
  }
};
