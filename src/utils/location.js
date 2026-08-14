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

// Rich verified catalog of landmarks, parks, historical sites, and government centers in Puerto Princesa City
export const PUERTO_PRINCESA_LANDMARKS = [
  // Arenas & Sports Venues
  { 
    name: 'Puerto Princesa City Coliseum (Edward S. Hagedorn Coliseum)', 
    aliases: ['edward s. hagedorn coliseum', 'edward hagedorn coliseum', 'puerto princesa city coliseum', 'city coliseum', 'coliseum', 'edward s hagedorn'], 
    category: 'Coliseum / Arena', 
    icon: 'trophy', 
    barangay: 'San Pedro', 
    lat: 9.75482, 
    lng: 118.74889 
  },
  { 
    name: 'City Coliseum Park', 
    aliases: ['coliseum park', 'city coliseum park'], 
    category: 'Park', 
    icon: 'leaf', 
    barangay: 'San Pedro', 
    lat: 9.75479, 
    lng: 118.74795 
  },
  { 
    name: 'Palawan Sports Complex', 
    aliases: ['sports complex', 'palawan sports complex'], 
    category: 'Sports Complex', 
    icon: 'fitness', 
    barangay: 'Santa Monica', 
    lat: 9.78500, 
    lng: 118.73800 
  },

  // Parks, Waterfronts & Attractions
  { 
    name: 'Mendoza Park', 
    aliases: ['mendoza park', 'higinio mendoza marker', 'mendoza'], 
    category: 'Park', 
    icon: 'leaf', 
    barangay: 'Model', 
    lat: 9.74004, 
    lng: 118.73727 
  },
  { 
    name: 'Higinio Mendoza Marker', 
    aliases: ['higinio mendoza', 'mendoza marker', 'higinio mendoza marker'], 
    category: 'Historical Marker', 
    icon: 'ribbon', 
    barangay: 'Model', 
    lat: 9.74005, 
    lng: 118.73722 
  },
  { 
    name: 'Puerto Princesa City Baywalk Park', 
    aliases: ['baywalk', 'city baywalk', 'baywalk park', 'puerto princesa baywalk', 'puerto princesa city baywalk'], 
    category: 'Park / Waterfront', 
    icon: 'water', 
    barangay: 'Pagkakaisa', 
    lat: 9.74391, 
    lng: 118.73165 
  },
  { 
    name: 'Balayong People\'s Park', 
    aliases: ['balayong', 'balayong park', "balayong people's park", 'balayong stadium'], 
    category: 'Park', 
    icon: 'flower', 
    barangay: 'San Pedro', 
    lat: 9.75800, 
    lng: 118.74200 
  },
  { 
    name: 'Baker\'s Hill', 
    aliases: ['bakers hill', "baker's hill"], 
    category: 'Attraction / Park', 
    icon: 'cafe', 
    barangay: 'Santa Monica', 
    lat: 9.79600, 
    lng: 118.71800 
  },
  { 
    name: 'Mitra\'s Ranch', 
    aliases: ['mitras ranch', "mitra's ranch", 'rancho ni mitra'], 
    category: 'Attraction', 
    icon: 'trail-sign', 
    barangay: 'Santa Monica', 
    lat: 9.80100, 
    lng: 118.71500 
  },

  // Historical Landmarks & Religious Sites
  { 
    name: 'Plaza Cuartel', 
    aliases: ['plaza cuartel', 'cuartel'], 
    category: 'Historical Park', 
    icon: 'shield', 
    barangay: 'Liwanag', 
    lat: 9.73980, 
    lng: 118.72955 
  },
  { 
    name: 'Plaza Cuartel Historical Marker', 
    aliases: ['plaza cuartel marker', 'cuartel marker', 'plaza cuartel historical marker'], 
    category: 'Historical Marker', 
    icon: 'ribbon', 
    barangay: 'Liwanag', 
    lat: 9.74014, 
    lng: 118.72963 
  },
  { 
    name: 'Immaculate Conception Cathedral', 
    aliases: ['cathedral', 'immaculate conception', 'puerto princesa cathedral', 'katedral'], 
    category: 'Church', 
    icon: 'heart', 
    barangay: 'Princesa', 
    lat: 9.74040, 
    lng: 118.72990 
  },

  // Government & Institutional Buildings
  { 
    name: 'Palawan Provincial Capitol', 
    aliases: ['capitol', 'provincial capitol', 'palawan capitol', 'kapitolyo'], 
    category: 'Government', 
    icon: 'business', 
    barangay: 'Model', 
    lat: 9.73925, 
    lng: 118.74404 
  },
  { 
    name: 'Puerto Princesa City Hall', 
    aliases: ['city hall', 'puerto princesa city hall', 'munisipyo', 'bagong city hall'], 
    category: 'Government', 
    icon: 'business', 
    barangay: 'San Pedro', 
    lat: 9.75000, 
    lng: 118.74000 
  },
  { 
    name: 'Palawan Provincial Legislative Building', 
    aliases: ['legislative building', 'provincial legislative building', 'legislative'], 
    category: 'Government', 
    icon: 'business', 
    barangay: 'Model', 
    lat: 9.74000, 
    lng: 118.74000 
  },
  { 
    name: 'Palawan Museum', 
    aliases: ['palawan museum', 'museum', 'museo'], 
    category: 'Museum', 
    icon: 'library', 
    barangay: 'Model', 
    lat: 9.73967, 
    lng: 118.73697 
  },

  // Ecotourism, Bays & Nature Reserves
  { 
    name: 'Palawan Wildlife Rescue Center (Crocodile Farm)', 
    aliases: ['crocodile farm', 'palawan wildlife rescue', 'wildlife rescue', 'croc farm', 'palawan wildlife rescue and conservation center'], 
    category: 'Zoo / Wildlife', 
    icon: 'paw', 
    barangay: 'Irawan', 
    lat: 9.79923, 
    lng: 118.69372 
  },
  { 
    name: 'Honda Bay', 
    aliases: ['honda bay', 'honda bay wharf', 'honda bay port'], 
    category: 'Wharf / Tourism', 
    icon: 'boat', 
    barangay: 'Santa Lourdes', 
    lat: 9.89038, 
    lng: 118.80880 
  },
  { 
    name: 'Puerto Princesa Subterranean River (Underground River)', 
    aliases: ['underground river', 'subterranean river', 'pp underground river', 'sabang', 'underground river national park', 'puerto princesa subterranean river national park'], 
    category: 'National Park / UNESCO', 
    icon: 'sparkles', 
    barangay: 'Cabayugan', 
    lat: 10.18000, 
    lng: 118.93000 
  },
  { 
    name: 'Ugong Rock Adventures', 
    aliases: ['ugong rock', 'ugong rock adventures', 'ugong zipline'], 
    category: 'Attraction / Adventure', 
    icon: 'trail-sign', 
    barangay: 'Cabayugan', 
    lat: 10.00000, 
    lng: 118.90000 
  },

  // Commercial & Shopping Malls
  { 
    name: 'SM City Puerto Princesa', 
    aliases: ['sm', 'sm city', 'sm mall', 'sm puerto princesa'], 
    category: 'Mall', 
    icon: 'business', 
    barangay: 'San Miguel', 
    lat: 9.74820, 
    lng: 118.74950 
  },
  { 
    name: 'Robinsons Place Palawan', 
    aliases: ['robinsons', 'robinsons place', 'robinsons palawan'], 
    category: 'Mall', 
    icon: 'business', 
    barangay: 'San Manuel', 
    lat: 9.76150, 
    lng: 118.75950 
  },
  { 
    name: 'NCCC Mall Palawan', 
    aliases: ['nccc', 'nccc mall', 'nccc palawan'], 
    category: 'Mall', 
    icon: 'business', 
    barangay: 'San Pedro', 
    lat: 9.75250, 
    lng: 118.74900 
  },
  { 
    name: 'Unitop Mall Puerto Princesa', 
    aliases: ['unitop', 'unitop mall'], 
    category: 'Mall', 
    icon: 'cart', 
    barangay: 'Mandaragat', 
    lat: 9.74280, 
    lng: 118.73650 
  },

  // Terminals & Transport
  { 
    name: 'San Jose New Market & Bus Terminal', 
    aliases: ['san jose terminal', 'san jose market', 'bus terminal'], 
    category: 'Market / Terminal', 
    icon: 'bus', 
    barangay: 'San Jose', 
    lat: 9.77520, 
    lng: 118.74850 
  },
  { 
    name: 'Puerto Princesa Port / Pier', 
    aliases: ['puerto princesa port', 'port', 'pier', 'pantalan'], 
    category: 'Port', 
    icon: 'boat', 
    barangay: 'Pagkakaisa', 
    lat: 9.74050, 
    lng: 118.72900 
  },
  { 
    name: 'Puerto Princesa International Airport (PPS)', 
    aliases: ['airport', 'paliparan', 'pps airport', 'international airport'], 
    category: 'Airport', 
    icon: 'airplane', 
    barangay: 'San Miguel', 
    lat: 9.74200, 
    lng: 118.75850 
  },

  // Hospitals & Medical Centers
  { 
    name: 'Ospital ng Palawan (ONP)', 
    aliases: ['onp', 'ospital ng palawan', 'onp hospital'], 
    category: 'Hospital', 
    icon: 'medkit', 
    barangay: 'Maligaya', 
    lat: 9.74400, 
    lng: 118.73700 
  },
  { 
    name: 'Palawan Adventist Hospital', 
    aliases: ['adventist', 'adventist hospital', 'palawan adventist'], 
    category: 'Hospital', 
    icon: 'medkit', 
    barangay: 'San Pedro', 
    lat: 9.75400, 
    lng: 118.74600 
  },
  { 
    name: 'MMG-PPAC Hospital (Coop)', 
    aliases: ['mmg', 'coop hospital', 'mmg hospital'], 
    category: 'Hospital', 
    icon: 'medkit', 
    barangay: 'San Pedro', 
    lat: 9.75100, 
    lng: 118.74800 
  },

  // Schools & Universities
  { 
    name: 'Palawan State University (PSU Main)', 
    aliases: ['psu', 'psu main', 'palawan state university'], 
    category: 'University', 
    icon: 'school', 
    barangay: 'Tiniguiban', 
    lat: 9.77100, 
    lng: 118.73800 
  },
  { 
    name: 'Holy Trinity University (HTU)', 
    aliases: ['htu', 'holy trinity', 'holy trinity university'], 
    category: 'University', 
    icon: 'school', 
    barangay: 'Tiniguiban', 
    lat: 9.76400, 
    lng: 118.74350 
  },

  // Central Hub
  { 
    name: 'Petron San Pedro Hub', 
    aliases: ['petron', 'petron hub', 'petron san pedro'], 
    category: 'Petron Hub', 
    icon: 'flame', 
    barangay: 'San Pedro', 
    lat: 9.75350, 
    lng: 118.74790 
  }
];

/**
 * Instant local search engine for Puerto Princesa places, landmarks, and barangays
 */
export const searchPuertoPrincesaPlaces = (query) => {
  if (!query || !query.trim()) return [];
  const q = query.trim().toLowerCase();

  const results = [];

  // 1. Search Landmarks Catalog with Name and Aliases matching
  for (const lm of PUERTO_PRINCESA_LANDMARKS) {
    const matchName = lm.name.toLowerCase().includes(q);
    const matchCategory = lm.category.toLowerCase().includes(q);
    const matchBrgy = lm.barangay.toLowerCase().includes(q);
    const matchAlias = lm.aliases && lm.aliases.some(a => a.toLowerCase().includes(q));

    if (matchName || matchCategory || matchBrgy || matchAlias) {
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