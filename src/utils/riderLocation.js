import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';
import { Platform } from 'react-native';

/**
 * Rider Location Tracking Utilities
 * Handles real-time location updates for riders
 */

let hasAttemptedBackgroundPermission = false;

// Request location permissions
export const requestLocationPermissions = async ({ requestBackground = false } = {}) => {
  try {
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    
    if (foregroundStatus !== 'granted') {
      return { success: false, error: 'Foreground location permission denied' };
    }

    let backgroundGranted = false;

    if (!requestBackground) {
      return {
        success: true,
        backgroundGranted: false
      };
    }

    // attempt to request background access but don't fail if the call is rejected
    try {
      if (!hasAttemptedBackgroundPermission) {
        hasAttemptedBackgroundPermission = true;
        const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
        backgroundGranted = backgroundStatus === 'granted';
      }
    } catch (bgError) {
      // some platforms (expo managed, simulators) may reject this call
      // log it and continue with only foreground permissions
      if (Platform.OS === 'android') {
        console.warn('Background location permission unavailable. Continuing with foreground tracking only:', bgError?.message || bgError);
      } else {
        console.warn('Background permission request rejected or unavailable:', bgError);
      }
    }
    
    return { 
      success: true, 
      backgroundGranted
    };
  } catch (error) {
    console.error('Error requesting location permissions:', error);
    return { success: false, error: error.message };
  }
};

// Get current location
export const getCurrentLocation = async () => {
  try {
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High
    });

    return {
      success: true,
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy
    };
  } catch (error) {
    console.error('Error getting current location:', error);
    return { success: false, error: error.message };
  }
};

// Update rider location in database
export const updateRiderLocation = async (riderId, latitude, longitude) => {
  try {
    // Update in profiles table for general tracking
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        address_lat: latitude,
        address_lng: longitude,
        last_seen: new Date().toISOString()
      })
      .eq('id', riderId);

    if (profileError) throw profileError;

    return { success: true };
  } catch (error) {
    console.error('Error updating rider location:', error);
    return { success: false, error: error.message };
  }
};

import { shouldUpdateLocation, calculateDistanceMeters, locationTrackingService } from '../services/locationTrackingService';

export { shouldUpdateLocation, calculateDistanceMeters };

// Start location tracking with callback
export const startLocationTracking = async (riderId, onLocationUpdate, options = {}) => {
  const {
    accuracy = Location.Accuracy.High,
    distanceInterval = 10, // meters
    timeInterval = 5000, // milliseconds
  } = options;

  try {
    // Request permissions first
    const permResult = await requestLocationPermissions({ requestBackground: false });
    if (!permResult.success) {
      return permResult;
    }

    let lastCoords = null;
    let lastUpdateTime = null;

    // Watch position
    const subscription = await Location.watchPositionAsync(
      {
        accuracy,
        distanceInterval,
        timeInterval,
      },
      async (location) => {
        const { latitude, longitude, accuracy } = location.coords;
        const now = Date.now();

        const isSaver = options.batterySaver !== undefined
          ? Boolean(options.batterySaver)
          : locationTrackingService.batterySaverEnabled;

        let shouldWrite = true;
        if (isSaver && lastCoords && lastUpdateTime) {
          const check = shouldUpdateLocation(lastCoords, location.coords, lastUpdateTime, now, options);
          shouldWrite = check.shouldUpdate;
        }

        // Update database if movement or heartbeat triggers it, or continuous mode when battery saver is off
        if (shouldWrite) {
          lastCoords = { latitude, longitude };
          lastUpdateTime = now;
          await updateRiderLocation(riderId, latitude, longitude);
        }
        
        // Call callback
        if (onLocationUpdate) {
          onLocationUpdate({
            latitude,
            longitude,
            accuracy,
            timestamp: location.timestamp
          });
        }
      }
    );

    return {
      success: true,
      subscription
    };
  } catch (error) {
    console.error('Error starting location tracking:', error);
    return { success: false, error: error.message };
  }
};

// Stop location tracking
export const stopLocationTracking = (subscription) => {
  if (subscription) {
    subscription.remove();
  }
};

// Calculate distance between two points (in kilometers)
export const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
};

// Convert degrees to radians
const toRad = (deg) => {
  return deg * (Math.PI / 180);
};

// Estimate delivery time based on distance
export const estimateDeliveryTime = (distanceKm, avgSpeedKmh = 20) => {
  const timeHours = distanceKm / avgSpeedKmh;
  const timeMinutes = Math.round(timeHours * 60);
  
  // Add buffer time for preparation
  const totalMinutes = timeMinutes + 15;
  
  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  } else {
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  }
};

// Get directions URL for external map apps
export const getDirectionsUrl = (destinationLat, destinationLng, riderLat, riderLng) => {
  // Try Google Maps first
  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${riderLat},${riderLng}&destination=${destinationLat},${destinationLng}&travelmode=driving`;
  
  return googleMapsUrl;
};

// Open external map app for navigation
export const openNavigation = async (destinationLat, destinationLng) => {
  try {
    const locationResult = await getCurrentLocation();
    let riderLat, riderLng;
    
    if (locationResult.success) {
      riderLat = locationResult.latitude;
      riderLng = locationResult.longitude;
    }
    
    const url = getDirectionsUrl(destinationLat, destinationLng, riderLat, riderLng);
    
    // Use Linking to open the map
    const { Linking } = require('react-native');
    await Linking.openURL(url);
    
    return { success: true };
  } catch (error) {
    console.error('Error opening navigation:', error);
    return { success: false, error: error.message };
  }
};

// Geocode address to coordinates
export const geocodeAddress = async (address) => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
      {
        headers: {
          'User-Agent': 'PetronSanPedroApp/1.0'
        }
      }
    );
    
    const data = await response.json();
    
    if (data && data.length > 0) {
      return {
        success: true,
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon),
        displayName: data[0].display_name
      };
    }
    
    return { success: false, error: 'Address not found' };
  } catch (error) {
    console.error('Error geocoding address:', error);
    return { success: false, error: error.message };
  }
};

// Reverse geocode coordinates to address
export const reverseGeocode = async (latitude, longitude) => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
      {
        headers: {
          'User-Agent': 'PetronSanPedroApp/1.0'
        }
      }
    );
    
    const data = await response.json();
    
    if (data) {
      return {
        success: true,
        address: data.display_name,
        city: data.address?.city || data.address?.town || data.address?.municipality,
        barangay: data.address?.suburb || data.address?.barangay
      };
    }
    
    return { success: false, error: 'Location not found' };
  } catch (error) {
    console.error('Error reverse geocoding:', error);
    return { success: false, error: error.message };
  }
};

// Check if location is within service area (San Pedro, Laguna)
export const isWithinServiceArea = (latitude, longitude) => {
  // San Pedro, Laguna bounds (approximate)
  const serviceArea = {
    north: 14.38,
    south: 14.35,
    east: 121.05,
    west: 121.00
  };
  
  return (
    latitude >= serviceArea.south &&
    latitude <= serviceArea.north &&
    longitude >= serviceArea.west &&
    longitude <= serviceArea.east
  );
};

export const DEFAULT_STORE_LOCATION = {
  latitude: 9.754820,
  longitude: 118.748890,
  name: 'Petron San Pedro',
};

/**
 * Calculates a reliable static store-to-customer distance and ETA fallback
 * when live rider GPS coordinates or routing APIs are unavailable.
 *
 * @param {Object} [params]
 * @param {number} [params.destinationLat]
 * @param {number} [params.destinationLng]
 * @param {string} [params.addressText]
 * @param {Object} [params.storeCoords]
 * @returns {{ distanceKm: number, etaMinutes: number, etaText: string, isFallback: boolean }}
 */
export const getStoreToCustomerFallback = ({
  destinationLat,
  destinationLng,
  addressText = '',
  storeCoords = DEFAULT_STORE_LOCATION,
} = {}) => {
  let destLat = Number(destinationLat);
  let destLng = Number(destinationLng);

  // If coordinates are invalid or missing, attempt fallback to town centroid
  if (!Number.isFinite(destLat) || !Number.isFinite(destLng) || (destLat === 0 && destLng === 0)) {
    destLat = 9.743330;
    destLng = 118.739730;
  }

  const distanceRaw = calculateDistance(
    storeCoords.latitude,
    storeCoords.longitude,
    destLat,
    destLng
  );

  const distanceKm = Number(Math.max(0.5, distanceRaw).toFixed(1));
  const etaText = estimateDeliveryTime(distanceKm, 20);
  const etaMinutes = Math.max(15, Math.round((distanceKm / 20) * 60) + 15);

  return {
    distanceKm,
    etaMinutes,
    etaText,
    isFallback: true,
  };
};


