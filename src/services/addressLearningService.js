// src/services/addressLearningService.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

const STORAGE_KEY = 'address_corrections_memory';
const MATCH_THRESHOLD_DEG = 0.0012; // ~120 meters radius for pin proximity matching

class AddressLearningService {
  constructor() {
    this.memoryCache = [];
    this.initialized = false;
    this.init();
  }

  async init() {
    try {
      // 1. Load local offline corrections
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.memoryCache = JSON.parse(raw);
      }

      // 2. Fetch recent community corrections from Supabase
      this.syncRemoteCorrections().catch(() => {});
    } catch (e) {
      console.log('Error initializing address learning service:', e.message);
    } finally {
      this.initialized = true;
    }
  }

  async syncRemoteCorrections() {
    try {
      const { data, error } = await supabase
        .from('address_corrections')
        .select('latitude, longitude, barangay, street, landmark, full_address')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        // Table might not exist yet or offline
        return;
      }

      if (data && data.length > 0) {
        // Merge into local cache avoiding duplicates
        const existingKeys = new Set(this.memoryCache.map(m => `${m.latitude.toFixed(4)},${m.longitude.toFixed(4)}`));
        
        data.forEach(item => {
          const key = `${item.latitude.toFixed(4)},${item.longitude.toFixed(4)}`;
          if (!existingKeys.has(key)) {
            this.memoryCache.push(item);
            existingKeys.add(key);
          }
        });

        // Persist merged cache locally
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.memoryCache.slice(0, 150)));
      }
    } catch (e) {
      // Ignore network sync issues silently
    }
  }

  /**
   * Find if there is a remembered address correction for these coordinates
   */
  getLearnedCorrection(latitude, longitude) {
    if (!latitude || !longitude || isNaN(latitude) || isNaN(longitude)) {
      return null;
    }

    let closest = null;
    let minDistance = Infinity;

    for (const item of this.memoryCache) {
      const dist = Math.hypot(item.latitude - latitude, item.longitude - longitude);
      if (dist < MATCH_THRESHOLD_DEG && dist < minDistance) {
        minDistance = dist;
        closest = item;
      }
    }

    return closest;
  }

  /**
   * Register a user-corrected address for a coordinate point
   */
  async registerCorrection({ latitude, longitude, barangay, street, landmark, fullAddress }) {
    if (!latitude || !longitude || !barangay) return;

    const correction = {
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      barangay: barangay.trim(),
      street: street ? street.trim() : '',
      landmark: landmark ? landmark.trim() : '',
      full_address: fullAddress ? fullAddress.trim() : '',
      updated_at: new Date().toISOString(),
    };

    // 1. Update In-Memory Cache (Immediate)
    const existingIndex = this.memoryCache.findIndex(
      m => Math.hypot(m.latitude - correction.latitude, m.longitude - correction.longitude) < 0.0003
    );

    if (existingIndex >= 0) {
      this.memoryCache[existingIndex] = { ...this.memoryCache[existingIndex], ...correction };
    } else {
      this.memoryCache.unshift(correction);
    }

    // 2. Persist to Local AsyncStorage
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.memoryCache.slice(0, 150)));
    } catch (err) {
      console.warn('Could not save correction to local storage:', err.message);
    }

    // 3. Persist to Supabase in Background
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id || null;

      await supabase.from('address_corrections').insert({
        user_id: userId,
        latitude: correction.latitude,
        longitude: correction.longitude,
        barangay: correction.barangay,
        street: correction.street,
        landmark: correction.landmark,
        full_address: correction.full_address,
        source: 'user_correction',
      });
    } catch (remoteErr) {
      // Remote table might be offline or undergoing migration, local storage ensures reliability
    }
  }
}

export const addressLearningService = new AddressLearningService();
