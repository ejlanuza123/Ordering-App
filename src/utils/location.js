// src/utils/location.js
import * as Location from 'expo-location';
import { Alert, Linking, Platform } from 'react-native';

// Official Puerto Princesa City Barangays with GPS centroids & matching aliases
export const PUERTO_PRINCESA_BARANGAYS = [
  // Commercial & Urban Hubs
  { name: 'San Pedro', aliases: ['san pedro', 'petron san pedro', 'san pedro national highway'], lat: 9.7535, lng: 118.7479 },
  { name: 'San Miguel', aliases: ['san miguel', 'airport', 'rizal ave', 'miguel'], lat: 9.7460, lng: 118.7520 },
  { name: 'San Jose', aliases: ['san jose', 'new market', 'terminal', 'san jose terminal'], lat: 9.7750, lng: 118.7480 },
  { name: 'Tiniguiban', aliases: ['tiniguiban', 'psu', 'coliseum', 'palawan state'], lat: 9.7680, lng: 118.7420 },
  { name: 'San Manuel', aliases: ['san manuel', 'manuel', 'bm road'], lat: 9.7610, lng: 118.7620 },
  { name: 'Santa Monica', aliases: ['santa monica', 'sta. monica', 'sta monica', 'mitra', 'city hall'], lat: 9.7890, lng: 118.7360 },
  { name: 'Bancao-Bancao', aliases: ['bancao-bancao', 'bancao bancao', 'bancao', 'pristine beach'], lat: 9.7320, lng: 118.7450 },
  { name: 'Mandaragat', aliases: ['mandaragat', 'lacao', 'manalo'], lat: 9.7430, lng: 118.7370 },
  { name: 'Sicsican', aliases: ['sicsican', 'fariñas'], lat: 9.8050, lng: 118.7200 },
  { name: 'Irawan', aliases: ['irawan', 'chattoc', 'flora and fauna'], lat: 9.8150, lng: 118.6850 },
  { name: 'Tagburos', aliases: ['tagburos', 'fisheries'], lat: 9.8250, lng: 118.7480 },
  { name: 'Santa Lourdes', aliases: ['santa lourdes', 'sta. lourdes', 'sta lourdes', 'honda bay', 'honda bay wharf'], lat: 9.8450, lng: 118.7350 },

  // Poblacion / Downtown Districts
  { name: 'Bagong Silang', aliases: ['bagong silang'], lat: 9.7400, lng: 118.7380 },
  { name: 'Bagong Sikat', aliases: ['bagong sikat'], lat: 9.7390, lng: 118.7320 },
  { name: 'Bagong Pag-asa', aliases: ['bagong pag-asa', 'bagong pagasa'], lat: 9.7420, lng: 118.7350 },
  { name: 'Pagkakaisa', aliases: ['pagkakaisa', 'baywalk', 'port'], lat: 9.7410, lng: 118.7300 },
  { name: 'Mabuhay', aliases: ['mabuhay'], lat: 9.7440, lng: 118.7340 },
  { name: 'Model', aliases: ['model', 'barracks'], lat: 9.7450, lng: 118.7390 },
  { name: 'Milagrosa', aliases: ['milagrosa'], lat: 9.7470, lng: 118.7430 },
  { name: 'Maningning', aliases: ['maningning'], lat: 9.7450, lng: 118.7410 },
  { name: 'Maunlad', aliases: ['maunlad'], lat: 9.7460, lng: 118.7370 },
  { name: 'Manggahan', aliases: ['manggahan'], lat: 9.7480, lng: 118.7380 },
  { name: 'Masipag', aliases: ['masipag'], lat: 9.7490, lng: 118.7390 },
  { name: 'Matiyaga', aliases: ['matiyaga'], lat: 9.7470, lng: 118.7360 },
  { name: 'Princesa', aliases: ['princesa', 'cathedral'], lat: 9.7430, lng: 118.7290 },
  { name: 'Tagumpay', aliases: ['tagumpay'], lat: 9.7440, lng: 118.7310 },
  { name: 'Liwanag', aliases: ['liwanag'], lat: 9.7400, lng: 118.7330 },
  { name: 'Tanglaw', aliases: ['tanglaw'], lat: 9.7390, lng: 118.7350 },
  { name: 'Maligaya', aliases: ['maligaya'], lat: 9.7430, lng: 118.7360 },

  // Extended Corridors
  { name: 'Iwahig', aliases: ['iwahig', 'penal colony'], lat: 9.7420, lng: 118.6700 },
  { name: 'Montible', aliases: ['montible'], lat: 9.7150, lng: 118.6400 },
  { name: 'Luzviminda', aliases: ['luzviminda'], lat: 9.6650, lng: 118.6780 },
  { name: 'Mangingisda', aliases: ['mangingisda'], lat: 9.7020, lng: 118.7180 },
  { name: 'Santa Cruz', aliases: ['santa cruz', 'sta. cruz', 'sta cruz'], lat: 9.6350, lng: 118.6650 },
  { name: 'Bacungan', aliases: ['bacungan', 'nagtabon'], lat: 9.9050, lng: 118.7050 },
  { name: 'San Rafael', aliases: ['san rafael', 'rafael'], lat: 9.9650, lng: 118.7800 },
  { name: 'Cabayugan', aliases: ['cabayugan', 'sabang', 'underground river'], lat: 10.1950, lng: 118.8950 },
  { name: 'Inagawan', aliases: ['inagawan'], lat: 9.5500, lng: 118.6200 }
];

/**
 * Detect nearest official Puerto Princesa Barangay from coordinates or text
 */
export const detectNearestBarangay = (latitude, longitude, textHint = '') => {
  const cleanHint = (textHint || '').toLowerCase().trim();

  // 1. Check text hint against aliases
  if (cleanHint) {
    for (const b of PUERTO_PRINCESA_BARANGAYS) {
      if (b.aliases.some(alias => cleanHint.includes(alias))) {
        return b.name;
      }
    }
  }

  // 2. Spatial centroid nearest neighbor
  if (latitude && longitude && !isNaN(latitude) && !isNaN(longitude)) {
    let nearest = PUERTO_PRINCESA_BARANGAYS[0];
    let minDistance = Infinity;

    for (const b of PUERTO_PRINCESA_BARANGAYS) {
      const d = Math.hypot(b.lat - latitude, b.lng - longitude);
      if (d < minDistance) {
        minDistance = d;
        nearest = b;
      }
    }

    if (minDistance < 0.15) {
      return nearest.name;
    }
  }

  return 'San Pedro';
};

// Request location permissions
export const requestLocationPermission = async () => {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  } catch (err) {
    console.error('Error requesting location permission:', err);
    return false;
  }
};

// Get high-accuracy GPS location
export const getCurrentLocation = async () => {
  try {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) {
      Alert.alert(
        'Permission Required',
        'Location permission is needed to detect your address accurately. Please enable it in your device settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() }
        ]
      );
      return null;
    }

    // Try last known position for instant responsiveness
    const lastKnown = await Location.getLastKnownPositionAsync({});

    // Request fresh high-precision GPS hardware lock
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Highest,
      timeInterval: 5000,
    });
    
    return location || lastKnown;
  } catch (error) {
    console.error('Error getting location:', error);
    // Fallback to last known if available
    try {
      const fallback = await Location.getLastKnownPositionAsync({});
      if (fallback) return fallback;
    } catch (_) {}
    
    Alert.alert('Location Notice', 'Could not get exact GPS lock. You can pin your location manually on the map.');
    return null;
  }
};

/**
 * Format intelligent Philippine address ensuring verified Barangay
 */
export const formatAddress = (addressObj, lat = null, lng = null) => {
  if (!addressObj) return '';

  const parts = [];
  const pushUnique = (val) => {
    if (val && typeof val === 'string') {
      const clean = val.trim();
      if (clean && !parts.some(p => p.toLowerCase() === clean.toLowerCase())) {
        parts.push(clean);
      }
    }
  };

  // 1. House / Building / Landmark
  if (addressObj.name && addressObj.name !== addressObj.street) {
    pushUnique(addressObj.name);
  }
  if (addressObj.streetNumber) {
    pushUnique(addressObj.streetNumber);
  }

  // 2. Street / Road
  if (addressObj.street) {
    pushUnique(addressObj.street);
  }

  // 3. Barangay Resolution
  const rawBarangay = addressObj.district || addressObj.subregion || addressObj.suburb;
  const detectedBrgy = detectNearestBarangay(lat, lng, rawBarangay || addressObj.street);
  
  if (detectedBrgy) {
    pushUnique(`Brgy. ${detectedBrgy}`);
  }

  // 4. City, Province, Postal Code
  pushUnique('Puerto Princesa City');
  pushUnique('Palawan');
  if (addressObj.postalCode) {
    pushUnique(addressObj.postalCode);
  }

  return parts.join(', ');
};

// Reverse geocode coordinates to structured address with localized fallback
export const reverseGeocode = async (latitude, longitude) => {
  try {
    // 1. Try Expo native geocoder
    const addresses = await Location.reverseGeocodeAsync({
      latitude,
      longitude,
    });
    
    if (addresses && addresses.length > 0) {
      return formatAddress(addresses[0], latitude, longitude);
    }
  } catch (nativeErr) {
    console.log('Native reverse geocode failed, falling back to OSM Nominatim:', nativeErr.message);
  }

  // 2. Fallback to Nominatim OSM API
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&addressdetails=1&zoom=18&accept-language=en`;
    const res = await fetch(url, { headers: { 'User-Agent': 'PetronSanPedroApp/2.0' } });
    const data = await res.json();

    if (data && data.address) {
      const a = data.address;
      const street = a.road || a.street || a.pedestrian || a.residential || '';
      const detectedBrgy = detectNearestBarangay(latitude, longitude, a.suburb || a.village || a.neighbourhood || a.city_district || street);

      const parts = [];
      if (a.house_number) parts.push(a.house_number);
      if (street) parts.push(street);
      if (detectedBrgy) parts.push(`Brgy. ${detectedBrgy}`);
      parts.push('Puerto Princesa City');
      parts.push('Palawan');

      return parts.join(', ');
    }
  } catch (osmErr) {
    console.log('OSM reverse geocode failed:', osmErr.message);
  }

  // 3. Ultimate deterministic fallback via localized barangay geometry
  const fallbackBrgy = detectNearestBarangay(latitude, longitude);
  return `Brgy. ${fallbackBrgy}, Puerto Princesa City, Palawan`;
};

// Get address from current high-accuracy location
export const getAddressFromCurrentLocation = async () => {
  const location = await getCurrentLocation();
  if (!location?.coords) return null;
  
  const address = await reverseGeocode(
    location.coords.latitude,
    location.coords.longitude
  );
  
  return {
    ...location,
    address,
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracy: location.coords.accuracy || 10
  };
};