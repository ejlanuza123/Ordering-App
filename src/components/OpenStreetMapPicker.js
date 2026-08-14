// src/components/OpenStreetMapPicker.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
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
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { 
  requestLocationPermission, 
  detectNearestBarangay, 
  reverseGeocode, 
  formatAddress 
} from '../utils/location';

export default function OpenStreetMapPicker({
  visible,
  onClose,
  onSelectAddress,
  initialAddress,
}) {
  const insets = useSafeAreaInsets();
  const webViewRef = useRef(null);
  const webViewReadyRef = useRef(false);
  const pendingLocationRef = useRef(null);

  // States
  const [loading, setLoading] = useState(true);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [detectedBarangay, setDetectedBarangay] = useState('San Pedro');
  const [streetAddress, setStreetAddress] = useState('');
  const [purokLandmark, setPurokLandmark] = useState('');
  const [fullAddress, setFullAddress] = useState(initialAddress || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [gpsAccuracy, setGpsAccuracy] = useState(null);
  const [isMoving, setIsMoving] = useState(false);

  // Pin animation
  const pinElevateAnim = useRef(new Animated.Value(0)).current;

  // Default Puerto Princesa City Hub coordinates (Petron San Pedro)
  const PUERTO_PRINCESA_DEFAULT = {
    lat: 9.7534772,
    lng: 118.7478688
  };

  // Animate pin when map starts/stops moving
  const handleMapMovementState = (moving) => {
    setIsMoving(moving);
    Animated.spring(pinElevateAnim, {
      toValue: moving ? -16 : 0,
      friction: 6,
      tension: 60,
      useNativeDriver: true,
    }).start();
  };

  // Re-assemble full address when components change
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
          html, body, #map { height: 100vh; width: 100vw; background: #f8fafc; overflow: hidden; }
          .center-crosshair {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -100%);
            z-index: 1000;
            pointer-events: none;
          }
          .pin-icon {
            width: 38px;
            height: 38px;
            filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3));
          }
          .pin-shadow {
            position: absolute;
            bottom: -4px;
            left: 50%;
            transform: translateX(-50%);
            width: 14px;
            height: 6px;
            background: rgba(0,0,0,0.25);
            border-radius: 50%;
            filter: blur(1px);
          }
          .accuracy-circle {
            background: rgba(0, 51, 160, 0.15);
            border: 2px solid #0033A0;
            border-radius: 50%;
          }
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

            L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
              maxZoom: 19,
              subdomains: 'abcd'
            }).addTo(map);

            // Add Puerto Princesa Store Hub Marker
            const hubIcon = L.divIcon({
              html: '<div style="background:#0033A0;color:white;padding:4px 8px;border-radius:12px;font-size:10px;font-weight:bold;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);white-space:nowrap">⛽ Petron Hub</div>',
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
                type: 'MAP_MOVE_END'
              }));

              clearTimeout(moveTimeout);
              moveTimeout = setTimeout(() => {
                resolveAddress(center.lat, center.lng);
              }, 300);
            });

            // Trigger initial location resolution
            resolveAddress(lat, lon);

            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'MAP_READY'
            }));
          }

          async function resolveAddress(lat, lng) {
            try {
              const url = 'https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=' + lat + '&lon=' + lng + '&addressdetails=1&zoom=18&accept-language=en';
              const res = await fetch(url, { headers: { 'User-Agent': 'PetronSanPedroApp/2.0' } });
              const data = await res.json();

              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'LOCATION_RESOLVED',
                lat: lat,
                lng: lng,
                addressDetails: data ? data.address : null,
                displayName: data ? data.display_name : ''
              }));
            } catch (err) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'LOCATION_RESOLVED',
                lat: lat,
                lng: lng,
                addressDetails: null,
                displayName: lat.toFixed(6) + ', ' + lng.toFixed(6)
              }));
            }
          }

          window.searchLocation = function(query) {
            if (!query) return;
            const fullQuery = query + ', Puerto Princesa City, Palawan';
            const url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&q=' + encodeURIComponent(fullQuery) + 
              '&viewbox=118.60,10.25,118.95,9.50&bounded=0&limit=5&addressdetails=1&countrycodes=PH&accept-language=en';

            fetch(url, { headers: { 'User-Agent': 'PetronSanPedroApp/2.0' } })
              .then(r => r.json())
              .then(results => {
                if (results && results.length > 0) {
                  const first = results[0];
                  map.flyTo([first.lat, first.lon], 18, { duration: 1.2 });
                } else {
                  alert('No places found in Puerto Princesa City. Try adjusting your search.');
                }
              })
              .catch(e => {
                console.error('Search error:', e);
              });
          };

          function handleIncoming(raw) {
            try {
              const data = JSON.parse(raw);
              if (data.type === 'SET_LOCATION') {
                if (!mapInitialized) {
                  initMap(data.lat, data.lon);
                  return;
                }
                map.flyTo([data.lat, data.lon], 18, { duration: 1.0 });
              } else if (data.type === 'SEARCH') {
                searchLocation(data.query);
              }
            } catch (_) {}
          }

          window.addEventListener('message', (e) => handleIncoming(e.data));
          document.addEventListener('message', (e) => handleIncoming(e.data));
        </script>
      </body>
      </html>
    `;
  }, []);

  useEffect(() => {
    if (visible) {
      getCurrentGPSLocation();
    }
  }, [visible]);

  // High-accuracy GPS Acquisition
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

      // Fast-path: last known position
      const lastKnown = await Location.getLastKnownPositionAsync({});
      if (lastKnown?.coords) {
        sendLocationToWebView(lastKnown.coords.latitude, lastKnown.coords.longitude);
        setSelectedLocation({ latitude: lastKnown.coords.latitude, longitude: lastKnown.coords.longitude });
        setGpsAccuracy(lastKnown.coords.accuracy ? Math.round(lastKnown.coords.accuracy) : null);
      }

      // Fresh high-accuracy hardware fix
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

        // 1. Detect official Puerto Princesa Barangay
        const a = data.addressDetails;
        const streetHint = a ? (a.road || a.street || a.pedestrian || a.residential || a.building || a.amenity || '') : '';
        const rawBrgyHint = a ? (a.suburb || a.village || a.neighbourhood || a.city_district || streetHint) : '';
        const brgy = detectNearestBarangay(data.lat, data.lng, rawBrgyHint);
        setDetectedBarangay(brgy);

        // 2. Extract clean street / building
        const detectedStreet = streetHint || (a?.house_number ? `#${a.house_number}` : 'Rizal Avenue / National Highway');
        setStreetAddress(detectedStreet);

        // 3. Assemble full formatted address
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

  const handleSearch = () => {
    if (!searchQuery.trim() || !webViewRef.current) return;
    setLoading(true);
    webViewRef.current.postMessage(JSON.stringify({
      type: 'SEARCH',
      query: searchQuery.trim()
    }));
    setLoading(false);
  };

  const handleConfirm = () => {
    if (!selectedLocation) {
      Alert.alert('Please drop a pin', 'Please wait for the map to finish locating your delivery address.');
      return;
    }

    const finalAddress = assembleAddress(streetAddress, detectedBarangay, purokLandmark);

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
            <Ionicons name="close" size={24} color="#1e293b" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Pin Delivery Location</Text>
            <Text style={styles.headerSubtitle}>Puerto Princesa City, Palawan</Text>
          </View>
          <TouchableOpacity onPress={handleConfirm} style={styles.confirmHeaderButton}>
            <Text style={styles.confirmHeaderButtonText}>Done</Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color="#64748b" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search landmark (e.g. City Coliseum, NCCC, Mitra)..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearch}>
              <Ionicons name="close-circle" size={18} color="#94a3b8" />
            </TouchableOpacity>
          ) : null}
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

          {/* Grab/Foodpanda Style Center Crosshair Pin */}
          <View style={styles.centerPinWrapper} pointerEvents="none">
            <Animated.View style={[styles.centerPinContainer, { transform: [{ translateY: pinElevateAnim }] }]}>
              {/* Pin Icon */}
              <View style={styles.customPin}>
                <Ionicons name="location" size={42} color="#ED2939" />
                <View style={styles.pinDot} />
              </View>
            </Animated.View>
            {/* Shadow beneath pin */}
            <View style={[styles.pinShadow, isMoving && styles.pinShadowElevated]} />
          </View>

          {/* Floating Map Controls */}
          <View style={styles.floatingControls}>
            {/* GPS Accuracy Badge */}
            {gpsAccuracy !== null && (
              <View style={styles.accuracyBadge}>
                <View style={[styles.accuracyDot, { backgroundColor: gpsAccuracy <= 15 ? '#10B981' : '#F59E0B' }]} />
                <Text style={styles.accuracyText}>GPS ±{gpsAccuracy}m</Text>
              </View>
            )}

            {/* Recenter GPS Button */}
            <TouchableOpacity
              style={styles.recenterButton}
              onPress={getCurrentGPSLocation}
              activeOpacity={0.8}
            >
              <Ionicons name="locate" size={22} color="#0033A0" />
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
            {/* Live Location Status Pill */}
            <View style={styles.sheetTopRow}>
              <View style={styles.barangayPill}>
                <Ionicons name="shield-checkmark" size={14} color="#0033A0" />
                <Text style={styles.barangayPillText}>Brgy. {detectedBarangay}</Text>
              </View>
              {isGeocoding ? (
                <View style={styles.geocodingStatus}>
                  <ActivityIndicator size="small" color="#ED2939" />
                  <Text style={styles.geocodingText}>Pinning address...</Text>
                </View>
              ) : (
                <Text style={styles.precisionLabel}>Verified Puerto Princesa</Text>
              )}
            </View>

            {/* Street / Location Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Street / Road / Building</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="navigate-outline" size={18} color="#64748b" style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  value={streetAddress}
                  onChangeText={(val) => {
                    setStreetAddress(val);
                    assembleAddress(val, detectedBarangay, purokLandmark);
                  }}
                  placeholder="Street name or nearby building"
                  placeholderTextColor="#94a3b8"
                />
              </View>
            </View>

            {/* Purok / Sitio / Landmark / House # */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Purok / Sitio / House # / Landmark (Optional)</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="home-outline" size={18} color="#64748b" style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  value={purokLandmark}
                  onChangeText={(val) => {
                    setPurokLandmark(val);
                    assembleAddress(streetAddress, detectedBarangay, val);
                  }}
                  placeholder="e.g. Purok Masipag, Red gate beside Chapel"
                  placeholderTextColor="#94a3b8"
                />
              </View>
            </View>

            {/* Address Summary Preview */}
            <View style={styles.addressPreviewBox}>
              <Ionicons name="pin" size={16} color="#0033A0" style={{ marginTop: 2 }} />
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
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#ffffff',
  },
  closeButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
    marginTop: 1,
  },
  confirmHeaderButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#0033A0',
  },
  confirmHeaderButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 8,
    paddingHorizontal: 12,
    height: 42,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
  },
  clearSearch: {
    padding: 4,
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
    backgroundColor: 'rgba(255,255,255,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 13,
    color: '#475569',
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
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
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
    color: '#334155',
  },
  recenterButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  bottomSheetContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
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
  barangayPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#eff6ff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  barangayPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0033A0',
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
    color: '#64748b',
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 10,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 10,
    backgroundColor: '#f8fafc',
    height: 38,
  },
  inputIcon: {
    marginRight: 6,
  },
  textInput: {
    flex: 1,
    fontSize: 12,
    color: '#0f172a',
    paddingVertical: 0,
  },
  addressPreviewBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    padding: 10,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    marginBottom: 12,
  },
  addressPreviewText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#1e293b',
    lineHeight: 16,
  },
  confirmButtonBig: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0033A0',
    paddingVertical: 12,
    borderRadius: 10,
    shadowColor: '#0033A0',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
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
});