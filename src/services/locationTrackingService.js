import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';

const UPDATE_INTERVAL_MS = 10000; // Update location every 10 seconds

export const calculateDistanceMeters = (lat1, lng1, lat2, lng2) => {
  if (lat1 === lat2 && lng1 === lng2) return 0;
  const R = 6371000; // Earth's radius in meters
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const shouldUpdateLocation = (
  lastCoords,
  newCoords,
  lastUpdateTime,
  currentTime = Date.now(),
  options = {}
) => {
  const {
    minDisplacementMeters = 10,
    stationaryHeartbeatMs = 45000,
    minIntervalMs = 4000,
    highSpeedThresholdKmh = 20,
    highSpeedMinIntervalMs = 3000,
    highSpeedMinDisplacementMeters = 15,
  } = options;

  if (!lastCoords || !lastUpdateTime) {
    return { shouldUpdate: true, reason: 'initial' };
  }

  const elapsedMs = currentTime - lastUpdateTime;
  const displacement = calculateDistanceMeters(
    lastCoords.latitude,
    lastCoords.longitude,
    newCoords.latitude,
    newCoords.longitude
  );

  // Heartbeat check: if stationary for a while, update to keep presence alive
  if (elapsedMs >= stationaryHeartbeatMs) {
    return { shouldUpdate: true, reason: 'heartbeat', displacement, elapsedMs };
  }

  // Speed evaluation (speed from GPS in m/s if present, else derived from displacement/time)
  const speedKmh =
    newCoords.speed != null && newCoords.speed >= 0
      ? newCoords.speed * 3.6
      : elapsedMs > 0
      ? (displacement / (elapsedMs / 1000)) * 3.6
      : 0;

  if (speedKmh >= highSpeedThresholdKmh) {
    if (elapsedMs >= highSpeedMinIntervalMs && displacement >= highSpeedMinDisplacementMeters) {
      return { shouldUpdate: true, reason: 'high_speed_movement', displacement, elapsedMs, speedKmh };
    }
  }

  // Standard movement check
  if (displacement >= minDisplacementMeters && elapsedMs >= minIntervalMs) {
    return { shouldUpdate: true, reason: 'movement', displacement, elapsedMs };
  }

  // Stationary / jitter suppression
  return { shouldUpdate: false, reason: 'throttled_stationary', displacement, elapsedMs };
};

export const locationTrackingService = {
  locationSubscription: null,
  updateTimeout: null,
  lastCoords: null,
  lastUpdateTime: null,
  activeDeliveryCache: null, // { id, expiresAt }
  ACTIVE_DELIVERY_TTL_MS: 30000,

  resetTrackingState() {
    this.lastCoords = null;
    this.lastUpdateTime = null;
    this.activeDeliveryCache = null;
  },

  setActiveDeliveryId(deliveryId) {
    this.activeDeliveryCache = {
      id: deliveryId,
      expiresAt: Date.now() + this.ACTIVE_DELIVERY_TTL_MS,
    };
  },

  clearActiveDeliveryId() {
    this.activeDeliveryCache = null;
  },

  /**
   * Request location permissions
   */
  async requestPermissions() {
    try {
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      
      if (foregroundStatus !== 'granted') {
        return { success: false, error: 'Location permission denied' };
      }

      // Request background permission for continuous tracking
      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      
      return {
        success: true,
        foregroundGranted: foregroundStatus === 'granted',
        backgroundGranted: backgroundStatus === 'granted'
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Get current location
   */
  async getCurrentLocation() {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      return {
        success: true,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
        altitude: location.coords.altitude,
        timestamp: location.timestamp
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Start tracking rider location and update database
   */
  async startTracking(riderId) {
    try {
      // Ensure permissions
      const permResult = await this.requestPermissions();
      if (!permResult.success) {
        return permResult;
      }

      // Start foreground tracking
      this.locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: UPDATE_INTERVAL_MS,
          distanceInterval: 10, // Update when moved 10 meters
        },
        async (location) => {
          // Update location with debouncing
          this.clearUpdateTimeout();
          this.updateTimeout = setTimeout(() => {
            this.updateRiderLocation(riderId, location.coords);
          }, 1000);
        }
      );

      return {
        success: true,
        message: 'Location tracking started'
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Update rider location in database
   */
  async updateRiderLocation(riderId, coords, options = {}) {
    try {
      if (!options.force && this.lastCoords && this.lastUpdateTime) {
        const check = shouldUpdateLocation(
          this.lastCoords,
          coords,
          this.lastUpdateTime,
          Date.now(),
          options
        );
        if (!check.shouldUpdate) {
          return { success: true, throttled: true, reason: check.reason };
        }
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          address_lat: coords.latitude,
          address_lng: coords.longitude,
          updated_at: new Date().toISOString(),
          is_online: true,
          last_seen: new Date().toISOString()
        })
        .eq('id', riderId);

      if (profileError) throw profileError;

      this.lastCoords = { latitude: coords.latitude, longitude: coords.longitude };
      this.lastUpdateTime = Date.now();

      // Check cached active delivery or query Supabase
      const now = Date.now();
      let deliveryId = null;

      if (this.activeDeliveryCache && this.activeDeliveryCache.expiresAt > now) {
        deliveryId = this.activeDeliveryCache.id;
      } else {
        const { data: delivery } = await supabase
          .from('deliveries')
          .select('id')
          .eq('rider_id', riderId)
          .in('status', ['accepted', 'picked_up', 'out_for_delivery'])
          .order('assigned_at', { ascending: false })
          .limit(1)
          .single();

        deliveryId = delivery?.id || null;
        this.activeDeliveryCache = {
          id: deliveryId,
          expiresAt: now + this.ACTIVE_DELIVERY_TTL_MS,
        };
      }

      if (deliveryId) {
        await supabase
          .from('deliveries')
          .update({
            rider_lat: coords.latitude,
            rider_lng: coords.longitude
          })
          .eq('id', deliveryId);
      }

      return { success: true };
    } catch (error) {
      console.error('Error updating location:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Stop tracking location
   */
  async stopTracking(riderId) {
    try {
      if (this.locationSubscription) {
        this.locationSubscription.remove();
        this.locationSubscription = null;
      }

      this.clearUpdateTimeout();
      this.resetTrackingState();

      // Mark as offline
      await supabase
        .from('profiles')
        .update({
          is_online: false,
          last_seen: new Date().toISOString()
        })
        .eq('id', riderId);

      return { success: true, message: 'Location tracking stopped' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Get delivery route (start to end)
   */
  async getDeliveryRoute(startCoords, endCoords) {
    try {
      // Using Open Street Map routing (OSRM)
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${startCoords.longitude},${startCoords.latitude};${endCoords.longitude},${endCoords.latitude}?overview=full&geometries=geojson`
      );

      if (!response.ok) throw new Error('Route calculation failed');

      const data = await response.json();
      const route = data.routes[0];

      return {
        success: true,
        distance: route.distance / 1000, // km
        duration: route.duration / 60, // minutes
        geometry: route.geometry.coordinates
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Stream rider location to specific customers/admins
   */
  subscribeToRiderLocation(riderId, onLocationUpdate) {
    const channel = supabase
      .channel(`rider-location-${riderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${riderId}`
        },
        (payload) => {
          onLocationUpdate({
            latitude: payload.new.address_lat,
            longitude: payload.new.address_lng,
            isOnline: payload.new.is_online,
            lastSeen: payload.new.last_seen
          });
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  },

  clearUpdateTimeout() {
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
      this.updateTimeout = null;
    }
  }
};
