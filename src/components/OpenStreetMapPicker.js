// src/components/OpenStreetMapPicker.js
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  FlatList,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { 
  requestLocationPermission, 
  detectNearestBarangay, 
  searchPuertoPrincesaPlaces,
  PUERTO_PRINCESA_BARANGAYS,
  PUERTO_PRINCESA_LANDMARKS
} from '../utils/location';
import { addressLearningService } from '../services/addressLearningService';

export default function OpenStreetMapPicker({
  visible,
  onClose,
  onSelectAddress,
  initialAddress,
}) {
  const insets = useSafeAreaInsets();
  const { colors, isDarkMode } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDarkMode), [colors, isDarkMode]);
  const webViewRef = useRef(null);
  const webViewReadyRef = useRef(false);
  const pendingLocationRef = useRef(null);
  const searchDebounceRef = useRef(null);

  // States
  const [loading, setLoading] = useState(true);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [detectedBarangay, setDetectedBarangay] = useState('San Pedro');
  const [streetAddress, setStreetAddress] = useState('');
  const [purokLandmark, setPurokLandmark] = useState('');
  const [fullAddress, setFullAddress] = useState(initialAddress || '');
  const [gpsAccuracy, setGpsAccuracy] = useState(null);
  const [isMoving, setIsMoving] = useState(false);
  const [isLearnedMemory, setIsLearnedMemory] = useState(false);
  const [isManuallyCorrected, setIsManuallyCorrected] = useState(false);

  // Search and Landmark Suggestions States
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);

  // Barangay Selector Modal state
  const [showBarangayModal, setShowBarangayModal] = useState(false);
  const [barangaySearch, setBarangaySearch] = useState('');

  // Pin animation
  const pinElevateAnim = useRef(new Animated.Value(0)).current;

  // Default Puerto Princesa City Hub coordinates (Petron San Pedro)
  const PUERTO_PRINCESA_DEFAULT = {
    lat: 9.7534772,
    lng: 118.7478688
  };

  const handleMapMovementState = (moving) => {
    setIsMoving(moving);
    Animated.spring(pinElevateAnim, {
      toValue: moving ? -16 : 0,
      friction: 6,
      tension: 60,
      useNativeDriver: true,
    }).start();
  };

  const assembleAddress = useCallback((street, brgy, landmark) => {
    const parts = [];
    if (landmark && landmark.trim()) parts.push(landmark.trim());
    if (street && street.trim()) parts.push(street.trim());
    if (brgy) parts.push(`Brgy. ${brgy}`);
    parts.push('Puerto Princesa City');
    parts.push('Palawan');

    const combined = parts.join(', ');
    setFullAddress(combined);
    return combined;
  }, []);

  const sendLocationToWebView = (latitude, longitude) => {
    const payload = JSON.stringify({
      type: 'SET_LOCATION',
      lat: latitude,
      lon: longitude
    });

    if (webViewRef.current && webViewReadyRef.current) {
      webViewRef.current.postMessage(payload);
      return;
    }

    pendingLocationRef.current = payload;
  };

  const mapHtml = React.useMemo(() => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body, #map { height: 100vh; width: 100vw; background: ${isDarkMode ? '#0f172a' : '#f8fafc'}; overflow: hidden; }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          let map;
          let moveTimeout;
          let mapInitialized = false;

          function initMap(lat, lon) {
            if (mapInitialized) return;
            mapInitialized = true;

            map = L.map('map', {
              zoomControl: false,
              attributionControl: false
            }).setView([lat, lon], 17);

            ${isDarkMode ? `
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
              subdomains: 'abcd',
              maxZoom: 19,
              attribution: '&copy; OpenStreetMap & CartoDB'
            }).addTo(map);
            ` : `
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
              maxZoom: 19,
              attribution: '&copy; OpenStreetMap contributors'
            }).addTo(map);
            `}

            // Add Puerto Princesa Store Hub Marker
            const hubIcon = L.divIcon({
              html: '<div style="background:${colors.primary};color:white;padding:4px 8px;border-radius:12px;font-size:10px;font-weight:bold;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);white-space:nowrap">⛽ Petron Hub</div>',
              className: '',
              iconAnchor: [35, 12]
            });
            L.marker([9.7535, 118.7479], { icon: hubIcon }).addTo(map);

            // Center movement listeners
            map.on('movestart', function() {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'MAP_MOVE_START'
              }));
            });

            map.on('moveend', function() {
              const center = map.getCenter();
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'MAP_MOVE_END',
                lat: center.lat,
                lng: center.lng
              }));

              clearTimeout(moveTimeout);
              moveTimeout = setTimeout(function() {
                fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=' + center.lat + '&lon=' + center.lng + '&zoom=18&addressdetails=1', {
                  headers: { 'User-Agent': 'PetronSanPedroApp/2.0' }
                })
                .then(function(res) { return res.json(); })
                .then(function(data) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'LOCATION_RESOLVED',
                    lat: center.lat,
                    lng: center.lng,
                    displayName: data.display_name || '',
                    addressDetails: data.address || {}
                  }));
                })
                .catch(function(err) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'LOCATION_RESOLVED',
                    lat: center.lat,
                    lng: center.lng,
                    displayName: '',
                    addressDetails: {}
                  }));
                });
              }, 400);
            });

            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'MAP_READY'
            }));
          }

          function handleIncoming(raw) {
            try {
              const data = JSON.parse(raw);
              if (data.type === 'SET_LOCATION') {
                if (!mapInitialized) {
                  initMap(data.lat, data.lon);
                  return;
                }
                map.flyTo([data.lat, data.lon], 18, { duration: 1.0 });
              }
            } catch (_) {}
          }

          window.addEventListener('message', (e) => handleIncoming(e.data));
          document.addEventListener('message', (e) => handleIncoming(e.data));
        </script>
      </body>
      </html>
    `;
  }, [isDarkMode, colors.primary]);

  useEffect(() => {
    if (visible) {
      getCurrentGPSLocation();
    }
  }, [visible]);

  const getCurrentGPSLocation = async () => {
    try {
      setLoading(true);
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) {
        sendLocationToWebView(PUERTO_PRINCESA_DEFAULT.lat, PUERTO_PRINCESA_DEFAULT.lng);
        setSelectedLocation(PUERTO_PRINCESA_DEFAULT);
        setLoading(false);
        return;
      }

      const lastKnown = await Location.getLastKnownPositionAsync({});
      if (lastKnown?.coords) {
        sendLocationToWebView(lastKnown.coords.latitude, lastKnown.coords.longitude);
        setSelectedLocation({ latitude: lastKnown.coords.latitude, longitude: lastKnown.coords.longitude });
        setGpsAccuracy(lastKnown.coords.accuracy ? Math.round(lastKnown.coords.accuracy) : null);
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 4000,
      });

      const { latitude, longitude, accuracy } = location.coords;
      sendLocationToWebView(latitude, longitude);
      setSelectedLocation({ latitude, longitude });
      setGpsAccuracy(accuracy ? Math.round(accuracy) : null);
    } catch (error) {
      console.warn('GPS lock error, falling back to default:', error.message);
      sendLocationToWebView(PUERTO_PRINCESA_DEFAULT.lat, PUERTO_PRINCESA_DEFAULT.lng);
      setSelectedLocation(PUERTO_PRINCESA_DEFAULT);
    } finally {
      setLoading(false);
    }
  };

  const handleWebViewMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === 'MAP_MOVE_START') {
        handleMapMovementState(true);
        setIsGeocoding(true);
      } else if (data.type === 'MAP_MOVE_END') {
        handleMapMovementState(false);
      } else if (data.type === 'LOCATION_RESOLVED') {
        setIsGeocoding(false);
        setSelectedLocation({
          latitude: data.lat,
          longitude: data.lng
        });

        // 1. Check if there is a learned/corrected address in memory for this coordinate
        const learned = addressLearningService.getLearnedCorrection(data.lat, data.lng);

        if (learned && learned.barangay) {
          setIsLearnedMemory(true);
          setDetectedBarangay(learned.barangay);
          if (learned.street && !streetAddress) {
            setStreetAddress(learned.street);
          }
          if (learned.landmark && !purokLandmark) {
            setPurokLandmark(learned.landmark);
          }
          assembleAddress(learned.street || streetAddress, learned.barangay, learned.landmark || purokLandmark);
          return;
        }

        setIsLearnedMemory(false);

        // 2. Precise spatial nearest-neighbor detection
        const a = data.addressDetails;
        const streetHint = a ? (a.road || a.street || a.pedestrian || a.residential || a.building || a.amenity || '') : '';
        const rawBrgyHint = a ? (a.suburb || a.village || a.neighbourhood || a.city_district || '') : '';
        const brgy = detectNearestBarangay(data.lat, data.lng, rawBrgyHint);
        setDetectedBarangay(brgy);

        // 3. Extract street name
        const detectedStreet = streetHint || (a?.house_number ? `#${a.house_number}` : 'Main Road');
        setStreetAddress(detectedStreet);

        // 4. Assemble full formatted address
        assembleAddress(detectedStreet, brgy, purokLandmark);
      } else if (data.type === 'MAP_READY') {
        setLoading(false);
        webViewReadyRef.current = true;
        if (pendingLocationRef.current && webViewRef.current) {
          webViewRef.current.postMessage(pendingLocationRef.current);
          pendingLocationRef.current = null;
        }
      }
    } catch (err) {
      console.error('Error handling WebView message:', err);
      setIsGeocoding(false);
    }
  };

  // Search handler: instantaneous local landmark lookup + debounced online lookup
  const handleSearchQueryChange = (query) => {
    setSearchQuery(query);

    if (!query || !query.trim()) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    // 1. Instant local landmark & barangay search (0ms latency)
    const localMatches = searchPuertoPrincesaPlaces(query);
    setSearchResults(localMatches);
    setShowSearchResults(true);

    // 2. Debounced online OSM search if query has more than 2 chars
    if (query.trim().length >= 2) {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }

      searchDebounceRef.current = setTimeout(async () => {
        try {
          setIsSearchingOnline(true);
          const encoded = encodeURIComponent(query.trim() + ' Puerto Princesa Palawan');
          const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encoded}&viewbox=118.60,10.25,118.95,9.50&bounded=0&limit=5&addressdetails=1&countrycodes=PH&accept-language=en`;
          const res = await fetch(url, { headers: { 'User-Agent': 'PetronSanPedroApp/2.0' } });
          const onlineData = await res.json();

          if (onlineData && onlineData.length > 0) {
            const mappedOnline = onlineData.map(item => {
              const b = detectNearestBarangay(parseFloat(item.lat), parseFloat(item.lon), item.display_name);
              return {
                id: `online-${item.place_id || item.lat}`,
                name: item.name || item.display_name.split(',')[0],
                category: 'Location',
                barangay: b,
                icon: 'location-outline',
                lat: parseFloat(item.lat),
                lng: parseFloat(item.lon),
                type: 'online',
              };
            });

            // Merge local and online uniquely
            setSearchResults(prev => {
              const combined = [...localMatches];
              mappedOnline.forEach(onItem => {
                if (!combined.some(c => Math.hypot(c.lat - onItem.lat, c.lng - onItem.lng) < 0.001)) {
                  combined.push(onItem);
                }
              });
              return combined;
            });
          }
        } catch (e) {
          // Keep local matches if offline
        } finally {
          setIsSearchingOnline(false);
        }
      }, 400);
    }
  };

  // User taps a search suggestion or landmark
  const handleSelectSearchResult = (item) => {
    setShowSearchResults(false);
    setSearchQuery(item.name);

    // Pan map to landmark
    sendLocationToWebView(item.lat, item.lng);

    // Set Barangay and Street details
    setDetectedBarangay(item.barangay);
    if (item.type === 'landmark' || item.type === 'online') {
      setStreetAddress(item.name);
    }
    assembleAddress(item.name, item.barangay, purokLandmark);
  };

  // User manually selects a Barangay from the list
  const handleSelectBarangay = (barangayItem) => {
    setDetectedBarangay(barangayItem.name);
    setIsManuallyCorrected(true);
    assembleAddress(streetAddress, barangayItem.name, purokLandmark);
    setShowBarangayModal(false);
  };

  const handleConfirm = () => {
    if (!selectedLocation) {
      Alert.alert('Please drop a pin', 'Please wait for the map to finish locating your delivery address.');
      return;
    }

    const finalAddress = assembleAddress(streetAddress, detectedBarangay, purokLandmark);

    if (isManuallyCorrected || isLearnedMemory || purokLandmark || streetAddress) {
      addressLearningService.registerCorrection({
        latitude: selectedLocation.latitude,
        longitude: selectedLocation.longitude,
        barangay: detectedBarangay,
        street: streetAddress,
        landmark: purokLandmark,
        fullAddress: finalAddress,
      });
    }

    onSelectAddress({
      latitude: selectedLocation.latitude,
      longitude: selectedLocation.longitude,
      address: finalAddress,
      barangay: detectedBarangay,
      street: streetAddress,
      landmark: purokLandmark
    });

    onClose();
  };

  // Filter barangays for the selector modal
  const filteredBarangays = PUERTO_PRINCESA_BARANGAYS.filter(b => 
    b.name.toLowerCase().includes(barangaySearch.toLowerCase())
  );

  return (
    <Modal
      animationType="slide"
      visible={visible}
      onRequestClose={onClose}
      presentationStyle="fullScreen"
    >
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Pin Delivery Location</Text>
            <Text style={styles.headerSubtitle}>Puerto Princesa City, Palawan</Text>
          </View>
          <TouchableOpacity onPress={handleConfirm} style={styles.confirmHeaderButton}>
            <Text style={styles.confirmHeaderButtonText}>Done</Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar Container */}
        <View style={styles.searchSectionWrapper}>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={18} color={colors.textSecondary} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search landmark (e.g. Coliseum, SM, NCCC, Mitra)..."
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={handleSearchQueryChange}
              onFocus={() => {
                if (searchQuery.trim()) {
                  setShowSearchResults(true);
                }
              }}
              returnKeyType="search"
            />
            {isSearchingOnline && (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 6 }} />
            )}
            {searchQuery ? (
              <TouchableOpacity 
                onPress={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                  setShowSearchResults(false);
                }} 
                style={styles.clearSearch}
              >
                <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Quick Popular Landmark Chips */}
          {!showSearchResults && (
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quickChipsContainer}
            >
              <Text style={styles.quickChipsLabel}>Popular:</Text>
              {PUERTO_PRINCESA_LANDMARKS.slice(0, 6).map((item) => (
                <TouchableOpacity
                  key={item.name}
                  style={styles.quickChip}
                  onPress={() => handleSelectSearchResult(item)}
                >
                  <Text style={styles.quickChipText}>{item.name.replace('Puerto Princesa ', '').replace('Palawan ', '')}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Live Search Suggestions Dropdown List */}
          {showSearchResults && (
            <View style={styles.searchResultsDropdown}>
              {searchResults.length > 0 ? (
                <FlatList
                  data={searchResults}
                  keyExtractor={(item) => item.id}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.searchResultItem}
                      onPress={() => handleSelectSearchResult(item)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.resultIconWrapper}>
                        <Ionicons name={item.icon || 'location'} size={18} color="#0033A0" />
                      </View>
                      <View style={styles.resultTextContainer}>
                        <Text style={styles.resultItemTitle} numberOfLines={1}>
                          {item.name}
                        </Text>
                        <Text style={styles.resultItemSubtitle} numberOfLines={1}>
                          {item.category} • Brgy. {item.barangay}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={14} color="#94a3b8" />
                    </TouchableOpacity>
                  )}
                  ItemSeparatorComponent={() => <View style={styles.searchSeparator} />}
                  style={{ maxHeight: 220 }}
                />
              ) : (
                <View style={styles.noResultsBox}>
                  <Ionicons name="compass-outline" size={24} color="#94a3b8" />
                  <Text style={styles.noResultsText}>
                    No places found. Move the map pin to select this exact location.
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Map Canvas with Center Fixed Crosshair */}
        <View style={styles.mapContainer}>
          {loading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#0033A0" />
              <Text style={styles.loadingText}>Locating map position...</Text>
            </View>
          )}

          <WebView
            ref={webViewRef}
            source={{ html: mapHtml }}
            onMessage={handleWebViewMessage}
            onLoadEnd={() => {
              webViewReadyRef.current = true;
              if (pendingLocationRef.current && webViewRef.current) {
                webViewRef.current.postMessage(pendingLocationRef.current);
                pendingLocationRef.current = null;
              }
            }}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            style={styles.webview}
          />

          {/* Center Crosshair Pin */}
          <View style={styles.centerPinWrapper} pointerEvents="none">
            <Animated.View style={[styles.centerPinContainer, { transform: [{ translateY: pinElevateAnim }] }]}>
              <View style={styles.customPin}>
                <Ionicons name="location" size={42} color="#ED2939" />
                <View style={styles.pinDot} />
              </View>
            </Animated.View>
            <View style={[styles.pinShadow, isMoving && styles.pinShadowElevated]} />
          </View>

          {/* Floating Map Controls */}
          <View style={styles.floatingControls}>
            {gpsAccuracy !== null && (
              <View style={styles.accuracyBadge}>
                <View style={[styles.accuracyDot, { backgroundColor: gpsAccuracy <= 15 ? '#10B981' : '#F59E0B' }]} />
                <Text style={styles.accuracyText}>GPS ±{gpsAccuracy}m</Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.recenterButton}
              onPress={getCurrentGPSLocation}
              activeOpacity={0.8}
            >
              <Ionicons name="locate" size={22} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Structured Bottom Address Sheet */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.bottomSheetContainer}
        >
          <ScrollView
            style={styles.bottomSheet}
            contentContainerStyle={[styles.bottomSheetContent, { paddingBottom: insets.bottom + 12 }]}
            keyboardShouldPersistTaps="handled"
          >
            {/* Live Location Status & Interactive Barangay Switcher */}
            <View style={styles.sheetTopRow}>
              <TouchableOpacity
                style={[styles.barangayPillTouchable, (isLearnedMemory || isManuallyCorrected) && styles.barangayPillLearned]}
                onPress={() => setShowBarangayModal(true)}
                activeOpacity={0.7}
              >
                <Ionicons 
                  name={isLearnedMemory || isManuallyCorrected ? "bookmark" : "shield-checkmark"} 
                  size={14} 
                  color={isLearnedMemory || isManuallyCorrected ? "#16a34a" : colors.primary} 
                />
                <Text style={[styles.barangayPillText, (isLearnedMemory || isManuallyCorrected) && styles.barangayPillTextLearned]}>
                  Brgy. {detectedBarangay}
                </Text>
                <Ionicons 
                  name="chevron-down" 
                  size={13} 
                  color={isLearnedMemory || isManuallyCorrected ? "#16a34a" : colors.primary} 
                  style={{ marginLeft: 2 }} 
                />
              </TouchableOpacity>

              {isGeocoding ? (
                <View style={styles.geocodingStatus}>
                  <ActivityIndicator size="small" color="#ED2939" />
                  <Text style={styles.geocodingText}>Pinning...</Text>
                </View>
              ) : isLearnedMemory ? (
                <Text style={styles.learnedLabel}>⭐ Remembered Location</Text>
              ) : isManuallyCorrected ? (
                <Text style={styles.learnedLabel}>✓ Custom Corrected</Text>
              ) : (
                <Text style={styles.precisionLabel}>Tap to change Brgy</Text>
              )}
            </View>

            {/* Street / Location Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Street / Road / Building</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="navigate-outline" size={18} color={colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  value={streetAddress}
                  onChangeText={(val) => {
                    setStreetAddress(val);
                    assembleAddress(val, detectedBarangay, purokLandmark);
                  }}
                  placeholder="Street name or nearby building"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
            </View>

            {/* Purok / Sitio / Landmark / House # */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Purok / Sitio / House # / Landmark (Optional)</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="home-outline" size={18} color={colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  value={purokLandmark}
                  onChangeText={(val) => {
                    setPurokLandmark(val);
                    assembleAddress(streetAddress, detectedBarangay, val);
                  }}
                  placeholder="e.g. Purok Masipag, Red gate beside Chapel"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
            </View>

            {/* Address Summary Preview */}
            <View style={styles.addressPreviewBox}>
              <Ionicons name="pin" size={16} color={colors.primary} style={{ marginTop: 2 }} />
              <Text style={styles.addressPreviewText} numberOfLines={2}>
                {fullAddress || 'Move the map to set exact delivery pin'}
              </Text>
            </View>

            {/* Confirm Button */}
            <TouchableOpacity
              style={[styles.confirmButtonBig, isGeocoding && styles.confirmButtonDisabled]}
              onPress={handleConfirm}
              disabled={isGeocoding}
              activeOpacity={0.85}
            >
              <Text style={styles.confirmButtonBigText}>Confirm Delivery Address</Text>
              <Ionicons name="arrow-forward" size={18} color="#ffffff" style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Searchable Barangay Selector Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={showBarangayModal}
          onRequestClose={() => setShowBarangayModal(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.barangayModalContent}>
              <View style={styles.barangayModalHeader}>
                <View>
                  <Text style={styles.barangayModalTitle}>Select Barangay</Text>
                  <Text style={styles.barangayModalSubtitle}>Keep pin position & correct barangay</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setShowBarangayModal(false)}
                  style={styles.barangayModalClose}
                >
                  <Ionicons name="close" size={20} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <View style={styles.barangaySearchWrapper}>
                <Ionicons name="search" size={16} color={colors.textSecondary} style={{ marginRight: 6 }} />
                <TextInput
                  style={styles.barangaySearchInput}
                  placeholder="Search Puerto Princesa barangay..."
                  placeholderTextColor={colors.textSecondary}
                  value={barangaySearch}
                  onChangeText={setBarangaySearch}
                />
              </View>

              <FlatList
                data={filteredBarangays}
                keyExtractor={(item) => item.name}
                renderItem={({ item }) => {
                  const isSelected = item.name === detectedBarangay;
                  return (
                    <TouchableOpacity
                      style={[styles.barangayListItem, isSelected && styles.barangayListItemActive]}
                      onPress={() => handleSelectBarangay(item)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.barangayListText, isSelected && styles.barangayListTextActive]}>
                        Brgy. {item.name}
                      </Text>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={18} color="#0033A0" />
                      )}
                    </TouchableOpacity>
                  );
                }}
                ItemSeparatorComponent={() => <View style={styles.barangaySeparator} />}
                style={styles.barangayFlatList}
              />
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </Modal>
  );
}

const createStyles = (colors, isDarkMode) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  closeButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: isDarkMode ? colors.surfaceElevated : '#f8fafc',
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
    marginTop: 1,
  },
  confirmHeaderButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  confirmHeaderButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  searchSectionWrapper: {
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    zIndex: 100,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 42,
    backgroundColor: isDarkMode ? colors.surfaceElevated : '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.textPrimary,
  },
  clearSearch: {
    padding: 4,
  },
  quickChipsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 8,
    paddingBottom: 2,
  },
  quickChipsLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    marginRight: 2,
  },
  quickChip: {
    backgroundColor: isDarkMode ? colors.surfaceElevated : '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  searchResultsDropdown: {
    position: 'absolute',
    top: 54,
    left: 16,
    right: 16,
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: isDarkMode ? 0.35 : 0.15,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 200,
    overflow: 'hidden',
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  resultIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: isDarkMode ? colors.surfaceElevated : '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  resultTextContainer: {
    flex: 1,
  },
  resultItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  resultItemSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  searchSeparator: {
    height: 1,
    backgroundColor: colors.border,
  },
  noResultsBox: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  noResultsText: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  webview: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255,255,255,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  centerPinWrapper: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -21,
    marginTop: -42,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
  },
  centerPinContainer: {
    alignItems: 'center',
  },
  customPin: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinDot: {
    position: 'absolute',
    top: 13,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ffffff',
  },
  pinShadow: {
    width: 16,
    height: 6,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 8,
    marginTop: -4,
  },
  pinShadowElevated: {
    transform: [{ scale: 0.6 }],
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  floatingControls: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    alignItems: 'flex-end',
    gap: 8,
    zIndex: 60,
  },
  accuracyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.95)' : 'rgba(255,255,255,0.95)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  accuracyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  accuracyText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  recenterButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: isDarkMode ? 0.3 : 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  bottomSheetContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: isDarkMode ? 0.3 : 0.08,
    shadowRadius: 8,
    elevation: 8,
  },
  bottomSheet: {
    maxHeight: 280,
  },
  bottomSheetContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  sheetTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  barangayPillTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: isDarkMode ? colors.surfaceElevated : '#eff6ff',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: isDarkMode ? colors.border : '#93c5fd',
  },
  barangayPillLearned: {
    backgroundColor: isDarkMode ? '#064e3b' : '#f0fdf4',
    borderColor: '#10b981',
  },
  barangayPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: isDarkMode ? colors.textPrimary : colors.primary,
  },
  barangayPillTextLearned: {
    color: '#10b981',
  },
  geocodingStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  geocodingText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ED2939',
  },
  precisionLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  learnedLabel: {
    fontSize: 11,
    color: '#10b981',
    fontWeight: '700',
  },
  inputGroup: {
    marginBottom: 10,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    backgroundColor: isDarkMode ? colors.surfaceElevated : '#f8fafc',
    height: 38,
  },
  inputIcon: {
    marginRight: 6,
  },
  textInput: {
    flex: 1,
    fontSize: 12,
    color: colors.textPrimary,
    paddingVertical: 0,
  },
  addressPreviewBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    padding: 10,
    backgroundColor: isDarkMode ? colors.surfaceElevated : '#f1f5f9',
    borderRadius: 8,
    marginBottom: 12,
  },
  addressPreviewText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
    lineHeight: 16,
  },
  confirmButtonBig: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: isDarkMode ? 0.35 : 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  confirmButtonDisabled: {
    opacity: 0.6,
  },
  confirmButtonBigText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },

  // Barangay Modal Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  barangayModalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '75%',
    paddingBottom: 24,
  },
  barangayModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  barangayModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  barangayModalSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
    marginTop: 2,
  },
  barangayModalClose: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: isDarkMode ? colors.surfaceElevated : '#f8fafc',
  },
  barangaySearchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 10,
    paddingHorizontal: 12,
    height: 38,
    backgroundColor: isDarkMode ? colors.surfaceElevated : '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  barangaySearchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.textPrimary,
  },
  barangayFlatList: {
    paddingHorizontal: 16,
  },
  barangayListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  barangayListItemActive: {
    backgroundColor: isDarkMode ? colors.surfaceElevated : '#eff6ff',
  },
  barangayListText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  barangayListTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  barangaySeparator: {
    height: 1,
    backgroundColor: colors.border,
  },
});