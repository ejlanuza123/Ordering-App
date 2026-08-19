// src/services/storeSettingsService.js
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEY = '@petron_store_pause_settings';

let _activeChannel = null;
const _subscribers = new Set();
let _cachedSettings = null;

const notifySubscribers = (fresh) => {
  if (!fresh) return;
  _cachedSettings = fresh;
  _subscribers.forEach((cb) => {
    try {
      cb(fresh);
    } catch (e) {
      console.warn('Error in store settings subscriber callback:', e);
    }
  });
};

export const storeSettingsService = {
  /**
   * Fetch live store pause settings
   */
  async getStorePauseSettings() {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', [
          'store_is_paused',
          'store_pause_mode',
          'store_pause_title',
          'store_pause_reason',
          'store_pause_reopen_at',
          'store_allow_preorders',
          'store_auto_reopen'
        ]);

      if (error) throw error;

      const map = {};
      (data || []).forEach(row => {
        map[row.key] = row.value;
      });

      let isPaused = map.store_is_paused === 'true';
      const mode = map.store_pause_mode || 'open';
      const title = map.store_pause_title || '';
      const reason = map.store_pause_reason || '';
      const reopenAt = map.store_pause_reopen_at || '';
      const allowPreorders = map.store_allow_preorders === 'true';
      const autoReopen = map.store_auto_reopen !== 'false';

      // Auto-reopen expiration check
      if (isPaused && autoReopen && reopenAt) {
        const reopenTime = new Date(reopenAt).getTime();
        if (!Number.isNaN(reopenTime) && reopenTime <= Date.now()) {
          isPaused = false;
        }
      }

      const settings = {
        isPaused,
        mode: isPaused ? mode : 'open',
        title,
        reason,
        reopenAt,
        allowPreorders,
        autoReopen,
      };

      _cachedSettings = settings;
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(settings));
      return settings;
    } catch (err) {
      console.warn('Failed to fetch live store pause settings, loading cache:', err);
      try {
        const cached = await AsyncStorage.getItem(CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          _cachedSettings = parsed;
          return parsed;
        }
      } catch (cacheErr) {
        console.error('Error reading cached store settings:', cacheErr);
      }

      return {
        isPaused: false,
        mode: 'open',
        title: '',
        reason: '',
        reopenAt: '',
        allowPreorders: false,
        autoReopen: true,
      };
    }
  },

  /**
   * Subscribe to realtime store status changes across broadcast and postgres_changes
   */
  subscribeToStorePauseChanges(callback) {
    if (typeof callback === 'function') {
      _subscribers.add(callback);
      if (_cachedSettings) {
        callback(_cachedSettings);
      }
    }

    if (!_activeChannel) {
      _activeChannel = supabase
        .channel('store_operations_realtime_sync')
        .on('broadcast', { event: 'store_pause_changed' }, (payload) => {
          if (payload?.payload) {
            notifySubscribers(payload.payload);
          } else {
            this.getStorePauseSettings().then(notifySubscribers);
          }
        })
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'app_settings' },
          async () => {
            const fresh = await this.getStorePauseSettings();
            notifySubscribers(fresh);
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            this.getStorePauseSettings().then(notifySubscribers);
          }
        });
    }

    return () => {
      _subscribers.delete(callback);
      if (_subscribers.size === 0 && _activeChannel) {
        supabase.removeChannel(_activeChannel);
        _activeChannel = null;
      }
    };
  }
};
