// src/components/OpenStreetMapPicker.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useSafeAreaInsets,SafeAreaView } from 'react-native-safe-area-context';
import { requestLocationPermission } from '../utils/location';

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
  const [loading, setLoading] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [address, setAddress] = useState(initialAddress || '');
  const [searchQuery, setSearchQuery] = useState('');

  // MKC Foods coordinates
  const SAN_PEDRO_COORDS = {
    lat: 9.7394855,
    lng: 118.7413605
  };

  // Smart formatter that improves barangay accuracy
  const formatSmartAddress = (addressData, lat, lng) => {
    if (!addressData) return '';

    const parts = [];
    const pushUnique = (value) => {
      if (value && !parts.includes(value)) parts.push(String(value));
    };

    // 1) Most specific info first
    pushUnique(addressData.house_number);

    const buildingLabel =
      addressData.amenity ||
      addressData.shop ||
      addressData.building ||
      addressData.office ||
      addressData.tourism;
    pushUnique(buildingLabel);

    // 2) Road/street
    const roadLabel =
      addressData.road ||
      addressData.street ||
      addressData.pedestrian ||
      addressData.residential ||
      addressData.tertiary;
    pushUnique(roadLabel);

    // 3) Barangay (PH)
    // Nominatim commonly uses different keys for barangay.
    const barangayCandidate =
      addressData.suburb ||
      addressData.village ||
      addressData.neighbourhood ||
      addressData.hamlet ||
      addressData.city_district;

    // Heuristic cleanup: drop generic/empty-like strings
    const normalizedBarangay = barangayCandidate
      ? String(barangayCandidate).trim()
      : '';

    if (
      normalizedBarangay &&
      !/^(philippines|palawan|puerto\s+princesa\s+city)$/i.test(normalizedBarangay)
    ) {
      pushUnique(normalizedBarangay);
    }

    // 4) City + Province
    pushUnique(
      addressData.city ||
        addressData.town ||
        addressData.municipality ||
        addressData.county ||
        'Puerto Princesa City'
    );

    pushUnique(addressData.state || 'Palawan');
    pushUnique(addressData.postcode);

    return parts.join(', ');
  };

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
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
          #map { height: 100vh; width: 100vw; }
          .custom-marker {
            background: #ED2939;
            border: 3px solid white;
            border-radius: 50%;
            width: 20px;
            height: 20px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
          }
          .attribution {
            position: absolute;
            bottom: 5px;
            right: 5px;
            background: rgba(255,255,255,0.8);
            padding: 2px 5px;
            border-radius: 3px;
            font-size: 10px;
            z-index: 1000;
          }
          /* In-page search removed: RN native search bar will be used */
        </style>
      </head>
      <body>
        <!-- In-page search removed; use the native search bar in the app -->
        <div id="map"></div>
        <div class="attribution">© OpenStreetMap contributors</div>
        
        <script>
          let map;
          let marker;
          let geocodeTimeout;
          let mapInitialized = false;
          // Forward console and errors to React Native for easier debugging
          (function() {
            const origLog = console.log;
            const origWarn = console.warn;
            const origError = console.error;
            console.log = function() {
              try { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'CONSOLE', level: 'log', message: Array.from(arguments).join(' ') })); } catch(e) {}
              origLog.apply(console, arguments);
            };
            console.warn = function() {
              try { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'CONSOLE', level: 'warn', message: Array.from(arguments).join(' ') })); } catch(e) {}
              origWarn.apply(console, arguments);
            };
            console.error = function() {
              try { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'CONSOLE', level: 'error', message: Array.from(arguments).join(' ') })); } catch(e) {}
              origError.apply(console, arguments);
            };
            window.addEventListener('error', function(ev) {
              try { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ERROR', message: ev.message + ' at ' + ev.filename + ':' + ev.lineno + ':' + ev.colno })); } catch(e) {}
            });
          })();
          
          function initMap(lat, lon) {
            map = L.map('map').setView([lat, lon], 17);
            
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
              attribution: '© OpenStreetMap contributors'
            }).addTo(map);
            
            const markerIcon = L.divIcon({
              className: 'custom-marker',
              iconSize: [20, 20],
              popupAnchor: [0, -10]
            });
            
            marker = L.marker([lat, lon], {
              draggable: true,
              icon: markerIcon
            }).addTo(map);
            
            function isBarangayLike(value) {
              if (!value) return false;
              const s = String(value).trim();
              if (!s) return false;
              if (/^(philippines|palawan|puerto\s+princesa\s+city)$/i.test(s)) return false;
              return true;
            }

            let geocodeRequestId = 0;

            async function reverseGeocode(lat, lng, zoom) {
              const url = \`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=\${lat}&lon=\${lng}&addressdetails=1&zoom=\${zoom}&namedetails=1&accept-language=en\`;
              const res = await fetch(url, { headers: { 'User-Agent': 'MKCFoodsApp/2.0' } });
              return res.json();
            }

            async function getAddressFromCoords(lat, lng) {
              try {
                let data = await reverseGeocode(lat, lng, 18);

                const addr = data ? data.address : null;
                const barangayCandidate = addr && (
                  addr.suburb || addr.village || addr.neighbourhood || addr.hamlet || addr.city_district
                );

                // If barangay is missing/generic, retry with different zoom
                if (!isBarangayLike(barangayCandidate)) {
                  const data16 = await reverseGeocode(lat, lng, 16);
                  const addr16 = data16 ? data16.address : null;
                  const barangay16 = addr16 && (
                    addr16.suburb || addr16.village || addr16.neighbourhood || addr16.hamlet || addr16.city_district
                  );

                  if (isBarangayLike(barangay16)) {
                    data = data16;
                  }
                }

                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'LOCATION_SELECTED',
                  lat: lat,
                  lng: lng,
                  display_name: data ? data.display_name : '',
                  address: data ? data.address : null
                }));
              } catch (e) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'LOCATION_SELECTED',
                  lat: lat,
                  lng: lng,
                  display_name: lat.toFixed(6) + ', ' + lng.toFixed(6)
                }));
              }
            }
            
            marker.on('dragend', function(e) {
              const pos = e.target.getLatLng();
              clearTimeout(geocodeTimeout);
              geocodeTimeout = setTimeout(() => {
                getAddressFromCoords(pos.lat, pos.lng);
              }, 600);
            });
            
            map.on('click', function(e) {
              marker.setLatLng(e.latlng);
              clearTimeout(geocodeTimeout);
              geocodeTimeout = setTimeout(() => {
                getAddressFromCoords(e.latlng.lat, e.latlng.lng);
              }, 600);
            });

            // Notify RN that the map is ready
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'MAP_READY'
            }));
          }

          // Cross-platform listener for messages from React Native
          function handleIncomingMessage(raw) {
            try {
              const data = JSON.parse(raw);

              if (data.type === 'SET_LOCATION') {
                if (!mapInitialized) {
                  initMap(data.lat, data.lon);
                  mapInitialized = true;
                  return;
                }
                map.setView([data.lat, data.lon], 18);
                marker.setLatLng([data.lat, data.lon]);
                clearTimeout(geocodeTimeout);
                getAddressFromCoords(data.lat, data.lon);
              } else if (data.type === 'SEARCH') {
                // Perform bounded search if viewbox provided for better accuracy
                searchLocation(data.query, data.viewbox);
              }
            } catch (e) {
              // ignore malformed messages
            }
          }

          // webview bridge: Android sometimes uses document, others use window
          window.addEventListener('message', (e) => handleIncomingMessage(e.data));
          document.addEventListener('message', (e) => handleIncomingMessage(e.data));

          // WAIT: Map will NOT initialize until GPS location arrives
          
          // searchLocation accepts optional viewbox string (minLon,maxLat,maxLon,minLat)
          window.searchLocation = function(query, viewbox) {
            if (!query) return;

            const fullQuery = query + ', Puerto Princesa City, Palawan';
            let url = \`https://nominatim.openstreetmap.org/search?format=jsonv2&q=\${encodeURIComponent(fullQuery)}&limit=5&countrycodes=PH&addressdetails=1&namedetails=1&accept-language=en\`;
            if (viewbox) {
              url += \`&viewbox=\${encodeURIComponent(viewbox)}&bounded=1\`;
            }

            fetch(url, { headers: { 'User-Agent': 'MKCFoodsApp/2.0' } })
              .then(response => response.json())
              .then(results => {
                if ((!results || results.length === 0) && viewbox) {
                  return fetch(\`https://nominatim.openstreetmap.org/search?format=jsonv2&q=\${encodeURIComponent(fullQuery)}&limit=5&countrycodes=PH&addressdetails=1&namedetails=1&accept-language=en\`, {
                    headers: { 'User-Agent': 'MKCFoodsApp/2.0' }
                  }).then(response => response.json());
                }

                if (results && results.length > 0) {
                  const first = results[0];
                  map.setView([first.lat, first.lon], 18);
                  marker.setLatLng([first.lat, first.lon]);

                  const requestId = ++geocodeRequestId;

                  fetch(\`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=\${first.lat}&lon=\${first.lon}&addressdetails=1&zoom=18&namedetails=1&accept-language=en\`, {
                    headers: { 'User-Agent': 'MKCFoodsApp/2.0' }
                  })
                    .then(res => res.json())
                    .then(detail => {
                      if (requestId !== geocodeRequestId) return;

                      window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'LOCATION_SELECTED',
                        lat: parseFloat(first.lat),
                        lng: parseFloat(first.lon),
                        display_name: detail.display_name || first.display_name,
                        address: detail.address
                      }));
                    });
                } else {
                  alert('No results found');
                }
              });
          };
          
          // Map initialization waits for SET_LOCATION from React Native
          // No onload init - map starts at provided GPS location
        </script>
      </body>
      </html>
    `;
  }, []);

  useEffect(() => {
    if (visible) {
      getCurrentLocation();
    }
  }, [visible]);

  const getCurrentLocation = async () => {
    try {
      setLoading(true);
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) {
        // If the user denies permission, send a sensible default so the map can initialize
        sendLocationToWebView(SAN_PEDRO_COORDS.lat, SAN_PEDRO_COORDS.lng);
        setSelectedLocation(SAN_PEDRO_COORDS);
        setLoading(false);
        return;
      }

      // Bumped accuracy to Highest so it actually relies on GPS hardware
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      });
      const { latitude, longitude } = location.coords;
      
      sendLocationToWebView(latitude, longitude);

      setSelectedLocation({ latitude, longitude });
      
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Error', 'Could not get your current location. Using default location.');
      // Send the default coordinates to the WebView so the map initializes
      sendLocationToWebView(SAN_PEDRO_COORDS.lat, SAN_PEDRO_COORDS.lng);
      setSelectedLocation(SAN_PEDRO_COORDS);
    } finally {
      setLoading(false);
    }
  };

  const handleWebViewMessage = async (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      if (data.type === 'LOCATION_SELECTED') {
        setLoading(false);
        setSelectedLocation({
          latitude: data.lat,
          longitude: data.lng
        });
        
        if (data.address) {
          const cleanAddress = formatSmartAddress(data.address, data.lat, data.lng);
          setAddress(cleanAddress);
        } else {
          setAddress(data.display_name || `${data.lat.toFixed(6)}, ${data.lng.toFixed(6)}`);
        }
        
      } else if (data.type === 'ERROR') {
        Alert.alert('Error', data.message);
        setLoading(false);
      } else if (data.type === 'MAP_READY') {
        // Map inside WebView initialized and ready
        setLoading(false);
        webViewReadyRef.current = true;
        if (pendingLocationRef.current && webViewRef.current) {
          webViewRef.current.postMessage(pendingLocationRef.current);
          pendingLocationRef.current = null;
        }
      }
    } catch (error) {
      console.error('Error parsing WebView message:', error);
      setLoading(false);
    }
  };

  const handleSearch = () => {
    if (!searchQuery.trim() || !webViewRef.current) return;
    setLoading(true);
    const delta = 0.01; // ~1km bounding box for local accuracy
    const lat = selectedLocation?.latitude ?? SAN_PEDRO_COORDS.lat;
    const lon = selectedLocation?.longitude ?? SAN_PEDRO_COORDS.lng;
    const minLat = lat - delta;
    const maxLat = lat + delta;
    const minLon = lon - delta;
    const maxLon = lon + delta;
    const viewbox = `${minLon},${maxLat},${maxLon},${minLat}`; // left,top,right,bottom

    webViewRef.current.postMessage(JSON.stringify({
      type: 'SEARCH',
      query: searchQuery,
      viewbox,
    }));
  };

  const handleConfirm = () => {
    if (selectedLocation && address) {
      onSelectAddress({
        ...selectedLocation,
        address, // Sends the fully edited/formatted address
      });
    }
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
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Select Delivery Address</Text>
          <TouchableOpacity onPress={handleConfirm} style={styles.confirmButton}>
            <Text style={styles.confirmButtonText}>Confirm</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.noticeBanner}>
          <Ionicons name="information-circle-outline" size={18} color="#8a5b00" />
          <Text style={styles.noticeText}>
            The delivery address name shown here may not be accurate. Please edit it so the rider can read a correct delivery address.
          </Text>
        </View>



        {/* Map View */}
        <View style={styles.mapContainer}>
          {loading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#0033A0" />
              <Text style={styles.loadingText}>Loading map...</Text>
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

              // Keep loading until the page signals MAP_READY
            }}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            style={styles.webview}
          />
        </View>

        {/* Bottom Address Panel - NOW EDITABLE */}
        <View style={[styles.bottomPanel, { paddingBottom: insets.bottom + 8 }]}>
          <Text style={styles.inputLabel}>Complete Address (Edit if needed):</Text>
          <View style={styles.addressContainer}>
            <Ionicons name="location-outline" size={20} color="#0033A0" style={{ marginTop: 2 }}/>
            <TextInput
              style={styles.addressInput}
              multiline
              value={address}
              onChangeText={setAddress}
              placeholder="Tap map or type complete address here..."
              placeholderTextColor="#999"
            />
          </View>
          
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={styles.currentLocationButton}
              onPress={getCurrentLocation}
              disabled={loading}
            >
              <Ionicons name="locate" size={20} color="#0033A0" />
              <Text style={styles.currentLocationText}>Use My GPS</Text>
            </TouchableOpacity>
            
            {selectedLocation && (
              <TouchableOpacity 
                style={styles.confirmButtonLarge}
                onPress={handleConfirm}
              >
                <Text style={styles.confirmButtonLargeText}>Confirm Location</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f4ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0033A0',
  },
  confirmButton: {
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f4ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#0033A0',
    fontWeight: '600',
    fontSize: 14,
  },
  noticeBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#fff4d6',
    borderWidth: 1,
    borderColor: '#f0d28a',
  },
  noticeText: {
    flex: 1,
    color: '#6b4a00',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: '#333',
  },
  searchButton: {
    backgroundColor: '#0033A0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  webview: {
    flex: 1,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingText: {
    marginTop: 10,
    color: '#0033A0',
    fontSize: 14,
    fontWeight: '500',
  },
  bottomPanel: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    padding: 16,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
  },
  inputLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 6,
    fontWeight: '500',
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  addressInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    color: '#333',
    minHeight: 40,
    paddingTop: 0,
    paddingBottom: 0,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  currentLocationButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f4ff',
    padding: 12,
    borderRadius: 10,
    gap: 6,
  },
  currentLocationText: {
    color: '#0033A0',
    fontSize: 13,
    fontWeight: '600',
  },
  confirmButtonLarge: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0033A0',
    padding: 12,
    borderRadius: 10,
    gap: 6,
  },
  confirmButtonLargeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});