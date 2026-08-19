// src/services/storeSettingsService.js
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEY = '@petron_store_pause_settings';

export const storeSettingsService = {
  _cachedSettings: null,

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

      this._cachedSettings = settings;
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(settings));
      return settings;
    } catch (err) {
      console.warn('Failed to fetch live store pause settings, loading cache:', err);
      try {
        const cached = await AsyncStorage.getItem(CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          this._cachedSettings = parsed;
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
   * Subscribe to realtime store status changes
   */
  subscribeToStorePauseChanges(callback) {
    const channel = supabase
      .channel('public:app_settings_store_pause')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_settings' },
        async () => {
          const fresh = await this.getStorePauseSettings();
          if (typeof callback === 'function') {
            callback(fresh);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }
};
