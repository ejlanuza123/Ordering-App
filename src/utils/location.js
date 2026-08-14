// src/utils/location.js
import * as Location from 'expo-location';
import { Alert, Linking, Platform } from 'react-native';

// Official Puerto Princesa City Barangays with GPS centroids & strict matching aliases
export const PUERTO_PRINCESA_BARANGAYS = [
  // Commercial & Urban Hubs
  { name: 'San Pedro', aliases: ['san pedro', 'brgy san pedro', 'barangay san pedro'], lat: 9.7535, lng: 118.7479 },
  { name: 'San Miguel', aliases: ['san miguel', 'brgy san miguel', 'barangay san miguel'], lat: 9.7460, lng: 118.7520 },
  { name: 'San Jose', aliases: ['san jose', 'brgy san jose', 'barangay san jose'], lat: 9.7750, lng: 118.7480 },
  { name: 'Tiniguiban', aliases: ['tiniguiban', 'brgy tiniguiban', 'barangay tiniguiban'], lat: 9.7680, lng: 118.7420 },
  { name: 'San Manuel', aliases: ['san manuel', 'brgy san manuel', 'barangay san manuel'], lat: 9.7610, lng: 118.7620 },
  { name: 'Santa Monica', aliases: ['santa monica', 'sta. monica', 'sta monica', 'brgy santa monica'], lat: 9.7890, lng: 118.7360 },
  { name: 'Bancao-Bancao', aliases: ['bancao-bancao', 'bancao bancao', 'bancao', 'brgy bancao-bancao'], lat: 9.7320, lng: 118.7450 },
  { name: 'Mandaragat', aliases: ['mandaragat', 'brgy mandaragat', 'barangay mandaragat'], lat: 9.7430, lng: 118.7370 },
  { name: 'Sicsican', aliases: ['sicsican', 'brgy sicsican', 'barangay sicsican'], lat: 9.8050, lng: 118.7200 },
  { name: 'Irawan', aliases: ['irawan', 'brgy irawan', 'barangay irawan'], lat: 9.8150, lng: 118.6850 },
  { name: 'Tagburos', aliases: ['tagburos', 'brgy tagburos', 'barangay tagburos'], lat: 9.8250, lng: 118.7480 },
  { name: 'Santa Lourdes', aliases: ['santa lourdes', 'sta. lourdes', 'sta lourdes', 'brgy santa lourdes'], lat: 9.8450, lng: 118.7350 },

  // Poblacion / Downtown Districts
  { name: 'Bagong Silang', aliases: ['bagong silang', 'brgy bagong silang'], lat: 9.7400, lng: 118.7380 },
  { name: 'Bagong Sikat', aliases: ['bagong sikat', 'brgy bagong sikat'], lat: 9.7390, lng: 118.7320 },
  { name: 'Bagong Pag-asa', aliases: ['bagong pag-asa', 'bagong pagasa', 'brgy bagong pag-asa'], lat: 9.7420, lng: 118.7350 },
  { name: 'Pagkakaisa', aliases: ['pagkakaisa', 'brgy pagkakaisa'], lat: 9.7410, lng: 118.7300 },
  { name: 'Mabuhay', aliases: ['mabuhay', 'brgy mabuhay'], lat: 9.7440, lng: 118.7340 },
  { name: 'Model', aliases: ['model', 'brgy model'], lat: 9.7450, lng: 118.7390 },
  { name: 'Milagrosa', aliases: ['milagrosa', 'brgy milagrosa'], lat: 9.7470, lng: 118.7430 },
  { name: 'Maningning', aliases: ['maningning', 'brgy maningning', 'barangay maningning'], lat: 9.7450, lng: 118.7410 },
  { name: 'Maunlad', aliases: ['maunlad', 'brgy maunlad'], lat: 9.7460, lng: 118.7370 },
  { name: 'Manggahan', aliases: ['manggahan', 'brgy manggahan'], lat: 9.7480, lng: 118.7380 },
  { name: 'Masipag', aliases: ['masipag', 'brgy masipag'], lat: 9.7490, lng: 118.7390 },
  { name: 'Matiyaga', aliases: ['matiyaga', 'brgy matiyaga'], lat: 9.7470, lng: 118.7360 },
  { name: 'Princesa', aliases: ['princesa', 'brgy princesa'], lat: 9.7430, lng: 118.7290 },
  { name: 'Tagumpay', aliases: ['tagumpay', 'brgy tagumpay'], lat: 9.7440, lng: 118.7310 },
  { name: 'Liwanag', aliases: ['liwanag', 'brgy liwanag'], lat: 9.7400, lng: 118.7330 },
  { name: 'Tanglaw', aliases: ['tanglaw', 'brgy tanglaw'], lat: 9.7390, lng: 118.7350 },
  { name: 'Maligaya', aliases: ['maligaya', 'brgy maligaya'], lat: 9.7430, lng: 118.7360 },

  // Extended Corridors
  { name: 'Iwahig', aliases: ['iwahig', 'brgy iwahig'], lat: 9.7420, lng: 118.6700 },
  { name: 'Montible', aliases: ['montible', 'brgy montible'], lat: 9.7150, lng: 118.6400 },
  { name: 'Luzviminda', aliases: ['luzviminda', 'brgy luzviminda'], lat: 9.6650, lng: 118.6780 },
  { name: 'Mangingisda', aliases: ['mangingisda', 'brgy mangingisda'], lat: 9.7020, lng: 118.7180 },
  { name: 'Santa Cruz', aliases: ['santa cruz', 'sta. cruz', 'sta cruz', 'brgy santa cruz'], lat: 9.6350, lng: 118.6650 },
  { name: 'Bacungan', aliases: ['bacungan', 'brgy bacungan'], lat: 9.9050, lng: 118.7050 },
  { name: 'San Rafael', aliases: ['san rafael', 'brgy san rafael'], lat: 9.9650, lng: 118.7800 },
  { name: 'Cabayugan', aliases: ['cabayugan', 'brgy cabayugan'], lat: 10.1950, lng: 118.8950 },
  { name: 'Inagawan', aliases: ['inagawan', 'brgy inagawan'], lat: 9.5500, lng: 118.6200 }
];

// Rich catalog of popular landmarks, malls, terminals, arenas, hospitals in Puerto Princesa City
export const PUERTO_PRINCESA_LANDMARKS = [
  // Commercial & Shopping Malls
  { name: 'SM City Puerto Princesa', category: 'Mall', icon: 'business', barangay: 'San Miguel', lat: 9.7482, lng: 118.7495 },
  { name: 'Robinsons Place Palawan', category: 'Mall', icon: 'business', barangay: 'San Manuel', lat: 9.7615, lng: 118.7595 },
  { name: 'NCCC Mall Palawan', category: 'Mall', icon: 'business', barangay: 'San Pedro', lat: 9.7525, lng: 118.7490 },
  { name: 'Unitop Mall Puerto Princesa', category: 'Mall', icon: 'cart', barangay: 'Mandaragat', lat: 9.7428, lng: 118.7365 },
  { name: 'Go Hotels Puerto Princesa', category: 'Hotel', icon: 'bed', barangay: 'San Manuel', lat: 9.7620, lng: 118.7590 },
  
  // Public Markets, Terminals & Transport
  { name: 'San Jose New Market & Bus Terminal', category: 'Market / Terminal', icon: 'bus', barangay: 'San Jose', lat: 9.7752, lng: 118.7485 },
  { name: 'Old Public Market (Poblacion)', category: 'Market', icon: 'basket', barangay: 'Tagumpay', lat: 9.7435, lng: 118.7305 },
  { name: 'Puerto Princesa Port / Pier', category: 'Port', icon: 'boat', barangay: 'Pagkakaisa', lat: 9.7405, lng: 118.7290 },
  { name: 'Puerto Princesa International Airport (PPS)', category: 'Airport', icon: 'airplane', barangay: 'San Miguel', lat: 9.7420, lng: 118.7585 },

  // Sports, Arenas & Parks
  { name: 'Puerto Princesa City Coliseum', category: 'Coliseum / Arena', icon: 'trophy', barangay: 'Tiniguiban', lat: 9.7675, lng: 118.7430 },
  { name: 'Palawan Sports Complex', category: 'Sports Complex', icon: 'fitness', barangay: 'Santa Monica', lat: 9.7850, lng: 118.7380 },
  { name: 'Puerto Princesa City Baywalk', category: 'Park / Waterfront', icon: 'water', barangay: 'Pagkakaisa', lat: 9.7410, lng: 118.7320 },
  { name: 'Mendoza Park', category: 'Park', icon: 'leaf', barangay: 'Model', lat: 9.7445, lng: 118.7385 },
  { name: 'Balayong People’s Park', category: 'Park', icon: 'flower', barangay: 'Santa Monica', lat: 9.7870, lng: 118.7340 },
  { name: 'Baker’s Hill', category: 'Attraction / Park', icon: 'cafe', barangay: 'Santa Monica', lat: 9.7960, lng: 118.7180 },
  { name: 'Mitra’s Ranch', category: 'Attraction', icon: 'trail-sign', barangay: 'Santa Monica', lat: 9.8010, lng: 118.7150 },
  { name: 'Plaza Cuartel', category: 'Historical Park', icon: 'shield', barangay: 'Liwanag', lat: 9.7430, lng: 118.7280 },
  { name: 'Immaculate Conception Cathedral', category: 'Church', icon: 'heart', barangay: 'Princesa', lat: 9.7425, lng: 118.7288 },
  { name: 'Pristine Beach', category: 'Beach', icon: 'sunny', barangay: 'Bancao-Bancao', lat: 9.7280, lng: 118.7460 },
  { name: 'BM Beach', category: 'Beach', icon: 'sunny', barangay: 'San Manuel', lat: 9.7580, lng: 118.7750 },
  { name: 'Honda Bay Wharf', category: 'Wharf / Tourism', icon: 'boat', barangay: 'Santa Lourdes', lat: 9.8465, lng: 118.7375 },
  { name: 'Iwahig Firefly Watching / Penal Farm', category: 'Attraction', icon: 'sparkles', barangay: 'Iwahig', lat: 9.7420, lng: 118.6650 },
  { name: 'Palawan Wildlife Rescue (Crocodile Farm)', category: 'Zoo / Wildlife', icon: 'paw', barangay: 'Irawan', lat: 9.8140, lng: 118.6820 },

  // Government & Institutions
  { name: 'Puerto Princesa City Hall', category: 'Government', icon: 'business', barangay: 'Santa Monica', lat: 9.7890, lng: 118.7355 },
  { name: 'Palawan Provincial Capitol', category: 'Government', icon: 'business', barangay: 'Tiniguiban', lat: 9.7660, lng: 118.7445 },

  // Hospitals & Medical Centers
  { name: 'Ospital ng Palawan (ONP)', category: 'Hospital', icon: 'medkit', barangay: 'Maligaya', lat: 9.7440, lng: 118.7370 },
  { name: 'Palawan Adventist Hospital', category: 'Hospital', icon: 'medkit', barangay: 'San Pedro', lat: 9.7540, lng: 118.7460 },
  { name: 'MMG-PPAC Hospital (Coop)', category: 'Hospital', icon: 'medkit', barangay: 'San Pedro', lat: 9.7510, lng: 118.7480 },

  // Schools & Universities
  { name: 'Palawan State University (PSU Main)', category: 'University', icon: 'school', barangay: 'Tiniguiban', lat: 9.7710, lng: 118.7380 },
  { name: 'Holy Trinity University (HTU)', category: 'University', icon: 'school', barangay: 'Tiniguiban', lat: 9.7640, lng: 118.7435 },
  { name: 'Western Philippines University (WPU)', category: 'University', icon: 'school', barangay: 'Santa Monica', lat: 9.7820, lng: 118.7410 },
  { name: 'Palawan National School (PNS)', category: 'School', icon: 'school', barangay: 'Model', lat: 9.7465, lng: 118.7400 },

  // Petron Central Station
  { name: 'Petron San Pedro Hub', category: 'Petron Hub', icon: 'flame', barangay: 'San Pedro', lat: 9.7535, lng: 118.7479 }
];

/**
 * Instant local search engine for Puerto Princesa places, landmarks, and barangays
 */
export const searchPuertoPrincesaPlaces = (query) => {
  if (!query || !query.trim()) return [];
  const q = query.trim().toLowerCase();

  const results = [];

  // 1. Search Landmarks Catalog
  for (const lm of PUERTO_PRINCESA_LANDMARKS) {
    const matchName = lm.name.toLowerCase().includes(q);
    const matchCategory = lm.category.toLowerCase().includes(q);
    const matchBrgy = lm.barangay.toLowerCase().includes(q);

    if (matchName || matchCategory || matchBrgy) {
      results.push({
        id: `landmark-${lm.name}`,
        name: lm.name,
        category: lm.category,
        barangay: lm.barangay,
        icon: lm.icon || 'location',
        lat: lm.lat,
        lng: lm.lng,
        type: 'landmark',
      });
    }
  }

  // 2. Search Barangays
  for (const brgy of PUERTO_PRINCESA_BARANGAYS) {
    const matchName = brgy.name.toLowerCase().includes(q);
    const matchAlias = brgy.aliases && brgy.aliases.some(a => a.toLowerCase().includes(q));

    if (matchName || matchAlias) {
      results.push({
        id: `brgy-${brgy.name}`,
        name: `Brgy. ${brgy.name}`,
        category: 'Barangay',
        barangay: brgy.name,
        icon: 'navigate-circle',
        lat: brgy.lat,
        lng: brgy.lng,
        type: 'barangay',
      });
    }
  }

  return results;
};

/**
 * Detect nearest official Puerto Princesa Barangay from coordinates or text
 */
export const detectNearestBarangay = (latitude, longitude, textHint = '') => {
  const hasValidCoords = latitude != null && longitude != null && !isNaN(latitude) && !isNaN(longitude);

  // 1. Spatial centroid nearest neighbor (Highest precision for map pins)
  if (hasValidCoords) {
    let nearest = PUERTO_PRINCESA_BARANGAYS[0];
    let minDistance = Infinity;

    for (const brgy of PUERTO_PRINCESA_BARANGAYS) {
      const distance = Math.hypot(brgy.lat - latitude, brgy.lng - longitude);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = brgy;
      }
    }
    return nearest.name;
  }

  // 2. Text alias fallback when coordinates are absent
  if (textHint && typeof textHint === 'string') {
    const cleanHint = textHint.toLowerCase();
    for (const brgy of PUERTO_PRINCESA_BARANGAYS) {
      if (brgy.aliases.some(alias => cleanHint.includes(alias))) {
        return brgy.name;
      }
    }
  }

  return 'San Pedro'; // Default Puerto Princesa commercial hub
};

/**
 * Formats a clean Philippine address structure
 */
export const formatAddress = (addressObj, lat = null, lng = null) => {
  if (!addressObj) return 'Puerto Princesa City, Palawan';

  const parts = [];

  // Street number and name
  if (addressObj.name && addressObj.name !== addressObj.street) {
    parts.push(addressObj.name);
  }
  if (addressObj.street) {
    parts.push(addressObj.street);
  }

  // Barangay detection
  const detectedBrgy = detectNearestBarangay(
    lat, 
    lng, 
    addressObj.district || addressObj.subregion || addressObj.name || ''
  );
  parts.push(`Brgy. ${detectedBrgy}`);

  // City & Province
  parts.push('Puerto Princesa City');
  parts.push('Palawan');

  return parts.filter(Boolean).join(', ');
};

/**
 * High-accuracy GPS location requester
 */
export const requestLocationPermission = async () => {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.warn('Location permission request failed:', error);
    return false;
  }
};