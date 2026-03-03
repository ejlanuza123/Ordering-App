import * as Location from 'expo-location';
import { Alert, Linking, Platform } from 'react-native';

// Request location permissions
export const requestLocationPermission = async () => {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
};

// Get current location
export const getCurrentLocation = async () => {
  try {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) {
      Alert.alert(
        'Permission Required',
        'Location permission is needed to detect your address. Please enable it in settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() }
        ]
      );
      return null;
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Highest,
    });
    
    return location;
  } catch (error) {
    console.error('Error getting location:', error);
    Alert.alert('Error', 'Failed to get your current location');
    return null;
  }
};

// Reverse geocode coordinates to address
export const reverseGeocode = async (latitude, longitude) => {
  try {
    const addresses = await Location.reverseGeocodeAsync({
      latitude,
      longitude,
    });
    
    if (addresses && addresses.length > 0) {
      const address = addresses[0];
      return formatAddress(address);
    }
    return null;
  } catch (error) {
    console.error('Error reverse geocoding:', error);
    return null;
  }
};

// Format address from geocoding result
export const formatAddress = (address) => {
  const parts = [];
  
  if (address.street) parts.push(address.street);
  if (address.district) parts.push(address.district);
  if (address.city) parts.push(address.city);
  if (address.region) parts.push(address.region);
  if (address.postalCode) parts.push(address.postalCode);
  
  return parts.join(', ');
};

// Get address from current location
export const getAddressFromCurrentLocation = async () => {
  const location = await getCurrentLocation();
  if (!location) return null;
  
  const address = await reverseGeocode(
    location.coords.latitude,
    location.coords.longitude
  );
  
  return {
    ...location,
    address,
  };
};