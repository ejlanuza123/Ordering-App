import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';

const UPDATE_INTERVAL_MS = 10000; // Update location every 10 seconds

export const locationTrackingService = {
  locationSubscription: null,
  updateTimeout: null,

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
  async updateRiderLocation(riderId, coords) {
    try {
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

      // Also update active delivery if exists
      const { data: delivery } = await supabase
        .from('deliveries')
        .select('id')
        .eq('rider_id', riderId)
        .in('status', ['accepted', 'picked_up'])
        .order('assigned_at', { ascending: false })
        .limit(1)
        .single();

      if (delivery) {
        await supabase
          .from('deliveries')
          .update({
            rider_lat: coords.latitude,
            rider_lng: coords.longitude
          })
          .eq('id', delivery.id);
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
