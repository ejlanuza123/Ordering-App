// src/utils/location.js
import * as Location from 'expo-location';
import { Alert, Linking, Platform } from 'react-native';

// Official Puerto Princesa City Barangays with GPS centroids & strict matching aliases
export const PUERTO_PRINCESA_BARANGAYS = [
  // Commercial & Urban Hubs
  { name: 'San Pedro', aliases: ['san pedro', 'brgy san pedro', 'barangay san pedro'], lat: 9.754820, lng: 118.748890 },
  { name: 'San Miguel', aliases: ['san miguel', 'brgy san miguel', 'barangay san miguel'], lat: 9.743330, lng: 118.739730 },
  { name: 'San Jose', aliases: ['san jose', 'brgy san jose', 'barangay san jose'], lat: 9.775000, lng: 118.748000 },
  { name: 'Tiniguiban', aliases: ['tiniguiban', 'brgy tiniguiban', 'barangay tiniguiban'], lat: 9.768000, lng: 118.742000 },
  { name: 'San Manuel', aliases: ['san manuel', 'brgy san manuel', 'barangay san manuel'], lat: 9.767098, lng: 118.748170 },
  { name: 'Santa Monica', aliases: ['santa monica', 'sta. monica', 'sta monica', 'brgy santa monica', 'brgy sta monica', 'brgy. sta. monica'], lat: 9.789000, lng: 118.736000 },
  { name: 'Bancao-Bancao', aliases: ['bancao-bancao', 'bancao bancao', 'bancao', 'brgy bancao-bancao'], lat: 9.732000, lng: 118.745000 },
  { name: 'Mandaragat', aliases: ['mandaragat', 'brgy mandaragat', 'barangay mandaragat'], lat: 9.743000, lng: 118.737000 },
  { name: 'Sicsican', aliases: ['sicsican', 'brgy sicsican', 'barangay sicsican'], lat: 9.805000, lng: 118.720000 },
  { name: 'Irawan', aliases: ['irawan', 'brgy irawan', 'barangay irawan'], lat: 9.799230, lng: 118.693720 },
  { name: 'Tagburos', aliases: ['tagburos', 'brgy tagburos', 'barangay tagburos'], lat: 9.825000, lng: 118.748000 },
  { name: 'Santa Lourdes', aliases: ['santa lourdes', 'sta. lourdes', 'sta lourdes', 'brgy santa lourdes'], lat: 9.845000, lng: 118.735000 },

  // Poblacion / Downtown Districts
  { name: 'Tagumpay', aliases: ['tagumpay', 'brgy tagumpay', 'barangay tagumpay'], lat: 9.739197, lng: 118.741160 },
  { name: 'Model', aliases: ['model', 'brgy model', 'barangay model'], lat: 9.740040, lng: 118.737270 },
  { name: 'Mabuhay', aliases: ['mabuhay', 'brgy mabuhay', 'barangay mabuhay'], lat: 9.739924, lng: 118.729580 },
  { name: 'Matiyaga', aliases: ['matiyaga', 'brgy matiyaga', 'barangay matiyaga'], lat: 9.743914, lng: 118.731650 },
  { name: 'Tanglaw', aliases: ['tanglaw', 'brgy tanglaw', 'barangay tanglaw'], lat: 9.739670, lng: 118.736970 },
  { name: 'Maligaya', aliases: ['maligaya', 'brgy maligaya', 'barangay maligaya'], lat: 9.740400, lng: 118.729900 },
  { name: 'Liwanag', aliases: ['liwanag', 'brgy liwanag', 'barangay liwanag'], lat: 9.740000, lng: 118.733000 },
  { name: 'Bagong Silang', aliases: ['bagong silang', 'brgy bagong silang'], lat: 9.740000, lng: 118.738000 },
  { name: 'Bagong Sikat', aliases: ['bagong sikat', 'brgy bagong sikat'], lat: 9.739000, lng: 118.732000 },
  { name: 'Bagong Pag-asa', aliases: ['bagong pag-asa', 'bagong pagasa', 'brgy bagong pag-asa'], lat: 9.742000, lng: 118.735000 },
  { name: 'Pagkakaisa', aliases: ['pagkakaisa', 'brgy pagkakaisa'], lat: 9.741000, lng: 118.730000 },
  { name: 'Milagrosa', aliases: ['milagrosa', 'brgy milagrosa'], lat: 9.747000, lng: 118.743000 },
  { name: 'Maningning', aliases: ['maningning', 'brgy maningning', 'barangay maningning'], lat: 9.745000, lng: 118.741000 },
  { name: 'Maunlad', aliases: ['maunlad', 'brgy maunlad'], lat: 9.746000, lng: 118.737000 },
  { name: 'Manggahan', aliases: ['manggahan', 'brgy manggahan'], lat: 9.748000, lng: 118.738000 },
  { name: 'Masipag', aliases: ['masipag', 'brgy masipag'], lat: 9.749000, lng: 118.739000 },
  { name: 'Princesa', aliases: ['princesa', 'brgy princesa'], lat: 9.743000, lng: 118.729000 },

  // Extended Corridors
  { name: 'Iwahig', aliases: ['iwahig', 'brgy iwahig'], lat: 9.742000, lng: 118.670000 },
  { name: 'Montible', aliases: ['montible', 'brgy montible'], lat: 9.715000, lng: 118.640000 },
  { name: 'Luzviminda', aliases: ['luzviminda', 'brgy luzviminda'], lat: 9.665000, lng: 118.678000 },
  { name: 'Mangingisda', aliases: ['mangingisda', 'brgy mangingisda'], lat: 9.702000, lng: 118.718000 },
  { name: 'Santa Cruz', aliases: ['santa cruz', 'sta. cruz', 'sta cruz', 'brgy santa cruz'], lat: 9.635000, lng: 118.665000 },
  { name: 'Bacungan', aliases: ['bacungan', 'brgy bacungan'], lat: 9.905000, lng: 118.705000 },
  { name: 'San Rafael', aliases: ['san rafael', 'brgy san rafael'], lat: 9.965000, lng: 118.780000 },
  { name: 'Cabayugan', aliases: ['cabayugan', 'brgy cabayugan'], lat: 10.180000, lng: 118.930000 },
  { name: 'Inagawan', aliases: ['inagawan', 'brgy inagawan'], lat: 9.550000, lng: 118.620000 }
];

// Rich verified catalog of landmarks, parks, historical sites, and malls in Puerto Princesa City
export const PUERTO_PRINCESA_LANDMARKS = [
  // 1. SM City Puerto Princesa
  { 
    name: 'SM City Puerto Princesa', 
    address: 'Malvar St. cor. Lacao St.',
    aliases: ['sm', 'sm city', 'sm mall', 'sm puerto princesa', 'sm palawan'], 
    category: 'Mall', 
    icon: 'business', 
    barangay: 'San Miguel', 
    lat: 9.743330, 
    lng: 118.739730 
  },

  // 2. Robinsons Place Palawan
  { 
    name: 'Robinsons Place Palawan', 
    address: 'National Highway',
    aliases: ['robinsons', 'robinsons place', 'robinsons palawan', 'rob place'], 
    category: 'Mall', 
    icon: 'business', 
    barangay: 'San Manuel', 
    lat: 9.767098, 
    lng: 118.748170 
  },

  // 3. NCCC Mall Palawan
  { 
    name: 'NCCC Mall Palawan', 
    address: '89 Lacao St.',
    aliases: ['nccc', 'nccc mall', 'nccc palawan', 'nccc lacao'], 
    category: 'Mall', 
    icon: 'business', 
    barangay: 'Tagumpay', 
    lat: 9.739197, 
    lng: 118.741160 
  },

  // 4. MCA Market Mall
  { 
    name: 'MCA Market Mall', 
    address: 'Puerto Princesa City',
    aliases: ['mca', 'mca market mall', 'mca mall'], 
    category: 'Mall', 
    icon: 'cart', 
    barangay: 'Tagumpay', 
    lat: 9.746150, 
    lng: 118.746870 
  },

  // 5. Edward S. Hagedorn Coliseum
  { 
    name: 'Edward S. Hagedorn Coliseum (City Coliseum)', 
    address: 'Peneyra Rd.',
    aliases: ['edward s. hagedorn coliseum', 'edward hagedorn coliseum', 'puerto princesa city coliseum', 'city coliseum', 'coliseum', 'edward s hagedorn', 'hagedorn coliseum'], 
    category: 'Coliseum / Arena', 
    icon: 'trophy', 
    barangay: 'San Pedro', 
    lat: 9.754820, 
    lng: 118.748890 
  },

  // 6. Mendoza Park
  { 
    name: 'Mendoza Park', 
    address: 'H. Mendoza St.',
    aliases: ['mendoza park', 'mendoza', 'higinio mendoza'], 
    category: 'Park', 
    icon: 'leaf', 
    barangay: 'Model', 
    lat: 9.740040, 
    lng: 118.737270 
  },

  // 7. Plaza Cuartel
  { 
    name: 'Plaza Cuartel', 
    address: 'Taft St.',
    aliases: ['plaza cuartel', 'cuartel', 'cuartel plaza'], 
    category: 'Historical Park', 
    icon: 'shield', 
    barangay: 'Mabuhay', 
    lat: 9.739924, 
    lng: 118.729580 
  },

  // 8. Puerto Princesa City Baywalk Park
  { 
    name: 'Puerto Princesa City Baywalk Park', 
    address: 'Sandoval St.',
    aliases: ['baywalk', 'city baywalk', 'baywalk park', 'puerto princesa baywalk', 'puerto princesa city baywalk', 'sandoval baywalk'], 
    category: 'Park / Waterfront', 
    icon: 'water', 
    barangay: 'Matiyaga', 
    lat: 9.743914, 
    lng: 118.731650 
  },

  // 9. Palawan Provincial Capitol
  { 
    name: 'Palawan Provincial Capitol', 
    address: 'Fernandez St.',
    aliases: ['capitol', 'provincial capitol', 'palawan capitol', 'kapitolyo', 'capitol building'], 
    category: 'Government', 
    icon: 'business', 
    barangay: 'Santa Monica', 
    lat: 9.739250, 
    lng: 118.744040 
  },

  // 10. Palawan Museum
  { 
    name: 'Palawan Museum', 
    address: 'Valencia St.',
    aliases: ['palawan museum', 'museum', 'museo', 'palawan museum valencia'], 
    category: 'Museum', 
    icon: 'library', 
    barangay: 'Tanglaw', 
    lat: 9.739670, 
    lng: 118.736970 
  },

  // 11. Puerto Princesa International Airport
  { 
    name: 'Puerto Princesa International Airport', 
    address: 'National Highway',
    aliases: ['airport', 'paliparan', 'pps airport', 'international airport', 'puerto princesa airport'], 
    category: 'Airport', 
    icon: 'airplane', 
    barangay: 'San Miguel', 
    lat: 9.742220, 
    lng: 118.758610 
  },

  // 12. Palawan Wildlife Rescue & Conservation Center
  { 
    name: 'Palawan Wildlife Rescue & Conservation Center', 
    address: 'Puerto Princesa South Road',
    aliases: ['crocodile farm', 'palawan wildlife rescue', 'wildlife rescue', 'croc farm', 'palawan wildlife rescue and conservation center', 'crocodile sanctuary'], 
    category: 'Zoo / Wildlife', 
    icon: 'paw', 
    barangay: 'Irawan', 
    lat: 9.799230, 
    lng: 118.693720 
  },

  // 13. Princess Eulalia Park
  { 
    name: 'Princess Eulalia Park', 
    address: 'Rizal Ave.',
    aliases: ['princess eulalia park', 'eulalia park', 'princess eulalia', 'eulalia'], 
    category: 'Park', 
    icon: 'flower', 
    barangay: 'Liwanag', 
    lat: 9.740000, 
    lng: 118.733000 
  },

  // 14. Immaculate Conception Cathedral
  { 
    name: 'Immaculate Conception Cathedral', 
    address: 'Taft St.',
    aliases: ['cathedral', 'immaculate conception', 'puerto princesa cathedral', 'katedral', 'taft cathedral'], 
    category: 'Church', 
    icon: 'heart', 
    barangay: 'Maligaya', 
    lat: 9.740400, 
    lng: 118.729900 
  },

  // 15. Special Battalion WWII Memorial Museum
  { 
    name: 'Special Battalion WWII Memorial Museum', 
    address: 'Rizal Ave.',
    aliases: ['wwii museum', 'special battalion', 'world war 2 museum', 'ww2 memorial museum', 'special battalion wwii memorial museum'], 
    category: 'Museum', 
    icon: 'library', 
    barangay: 'Model', 
    lat: 9.739040, 
    lng: 118.736550 
  },

  // 16. Puerto Princesa Old Public Market
  { 
    name: 'Old Public Market', 
    address: 'Valencia St. / Malvar St.',
    aliases: ['old public market', 'public market', 'old market', 'palengke', 'puerto princesa old public market', 'tiangge', 'lumang palengke'], 
    category: 'Market', 
    icon: 'basket', 
    barangay: 'Tagumpay', 
    lat: 9.7422666, 
    lng: 118.7333285 
  },

  // Additional Noteworthy Sites
  { 
    name: 'Puerto Princesa City New Public Market', 
    address: 'Market Site, San Jose',
    aliases: ['new public market', 'puerto princesa city new public market', 'new market', 'san jose new market', 'bagong palengke', 'new market terminal'], 
    category: 'Market', 
    icon: 'basket', 
    barangay: 'San Jose', 
    lat: 9.7462458, 
    lng: 118.7370428 
  },
  { 
    name: 'City Coliseum Park', 
    address: 'Peneyra Rd.',
    aliases: ['coliseum park', 'city coliseum park'], 
    category: 'Park', 
    icon: 'leaf', 
    barangay: 'San Pedro', 
    lat: 9.754790, 
    lng: 118.747950 
  },
  { 
    name: 'Balayong People\'s Park', 
    address: 'San Pedro',
    aliases: ['balayong', 'balayong park', "balayong people's park", 'balayong stadium'], 
    category: 'Park', 
    icon: 'flower', 
    barangay: 'San Pedro', 
    lat: 9.758000, 
    lng: 118.742000 
  },
  { 
    name: 'Palawan Provincial Legislative Building', 
    address: 'Fernandez St.',
    aliases: ['legislative building', 'provincial legislative building', 'legislative'], 
    category: 'Government', 
    icon: 'business', 
    barangay: 'Model', 
    lat: 9.740000, 
    lng: 118.740000 
  },
  { 
    name: 'Honda Bay', 
    address: 'National Highway, Sta. Lourdes',
    aliases: ['honda bay', 'honda bay wharf', 'honda bay port'], 
    category: 'Wharf / Tourism', 
    icon: 'boat', 
    barangay: 'Santa Lourdes', 
    lat: 9.890380, 
    lng: 118.808800 
  },
  { 
    name: 'Puerto Princesa Subterranean River (Underground River)', 
    address: 'Cabayugan',
    aliases: ['underground river', 'subterranean river', 'pp underground river', 'sabang', 'underground river national park'], 
    category: 'National Park / UNESCO', 
    icon: 'sparkles', 
    barangay: 'Cabayugan', 
    lat: 10.180000, 
    lng: 118.930000 
  },
  { 
    name: 'Ugong Rock Adventures', 
    address: 'Cabayugan',
    aliases: ['ugong rock', 'ugong rock adventures', 'ugong zipline'], 
    category: 'Attraction / Adventure', 
    icon: 'trail-sign', 
    barangay: 'Cabayugan', 
    lat: 10.000000, 
    lng: 118.900000 
  },
  { 
    name: 'San Jose New Market & Bus Terminal', 
    address: 'San Jose',
    aliases: ['san jose terminal', 'san jose market', 'bus terminal'], 
    category: 'Market / Terminal', 
    icon: 'bus', 
    barangay: 'San Jose', 
    lat: 9.775200, 
    lng: 118.748500 
  },
  { 
    name: 'Ospital ng Palawan (ONP)', 
    address: '220 Malvar St.',
    aliases: ['onp', 'ospital ng palawan', 'onp hospital', 'ospital'], 
    category: 'Hospital', 
    icon: 'medkit', 
    barangay: 'San Miguel', 
    lat: 9.7478371, 
    lng: 118.7416775 
  },
  { 
    name: 'Palawan State University (PSU Main)', 
    address: 'Tiniguiban Heights',
    aliases: ['psu', 'psu main', 'palawan state university'], 
    category: 'University', 
    icon: 'school', 
    barangay: 'Tiniguiban', 
    lat: 9.771000, 
    lng: 118.738000 
  },
  { 
    name: 'Holy Trinity University (HTU)', 
    address: 'Quezon St.',
    aliases: ['htu', 'holy trinity', 'holy trinity university'], 
    category: 'University', 
    icon: 'school', 
    barangay: 'Tiniguiban', 
    lat: 9.764000, 
    lng: 118.743500 
  },
  { 
    name: 'Petron San Pedro Hub', 
    address: 'National Highway, San Pedro',
    aliases: ['petron', 'petron hub', 'petron san pedro'], 
    category: 'Petron Hub', 
    icon: 'flame', 
    barangay: 'San Pedro', 
    lat: 9.753500, 
    lng: 118.747900 
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
    const matchAddress = lm.address && lm.address.toLowerCase().includes(q);
    const matchCategory = lm.category.toLowerCase().includes(q);
    const matchBrgy = lm.barangay.toLowerCase().includes(q);
    const matchAlias = lm.aliases && lm.aliases.some(a => a.toLowerCase().includes(q));

    if (matchName || matchAddress || matchCategory || matchBrgy || matchAlias) {
      results.push({
        id: `landmark-${lm.name}`,
        name: lm.name,
        address: lm.address || '',
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
 * Uses high-precision landmark proximity (~300m) + spatial centroid nearest neighbor
 */
export const detectNearestBarangay = (latitude, longitude, textHint = '') => {
  const hasValidCoords = latitude != null && longitude != null && !isNaN(latitude) && !isNaN(longitude);

  if (hasValidCoords) {
    // 1. High-precision landmark proximity matching (~300m radius = ~0.0030 deg)
    let closestLandmark = null;
    let minLandmarkDist = Infinity;
    for (const lm of PUERTO_PRINCESA_LANDMARKS) {
      if (lm.lat && lm.lng) {
        const dist = Math.hypot(lm.lat - latitude, lm.lng - longitude);
        if (dist < minLandmarkDist) {
          minLandmarkDist = dist;
          closestLandmark = lm;
        }
      }
    }

    if (closestLandmark && minLandmarkDist < 0.0030 && closestLandmark.barangay) {
      return closestLandmark.barangay;
    }

    // 2. Spatial centroid nearest neighbor
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

  // 3. Text alias fallback when coordinates are absent
  if (textHint && typeof textHint === 'string') {
    const cleanHint = textHint.toLowerCase();
    
    // Check landmark name / aliases first
    for (const lm of PUERTO_PRINCESA_LANDMARKS) {
      if (cleanHint.includes(lm.name.toLowerCase()) || (lm.aliases && lm.aliases.some(a => cleanHint.includes(a)))) {
        return lm.barangay;
      }
    }

    // Check barangay names / aliases
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