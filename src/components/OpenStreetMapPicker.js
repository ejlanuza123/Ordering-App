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
  const [loading, setLoading] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [address, setAddress] = useState(initialAddress || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [mapHtml, setMapHtml] = useState('');

  // Petron San Pedro Station coordinates
  const SAN_PEDRO_COORDS = {
    lat: 9.7534772,
    lng: 118.7478688
  };

  // Smart formatter that fixes OSM's wrong boundary data
  const formatSmartAddress = (addressData, lat, lng) => {
    if (!addressData) return '';
    
    const parts = [];
    
    // 1. Get specific building/shop name if available (e.g., "Petron")
    const specificName = addressData.amenity || addressData.shop || addressData.building;
    if (specificName) parts.push(specificName);

    // 2. Get the road
    const road = addressData.road || addressData.street;
    if (road) parts.push(road);

    // 3. Fix the Barangay Boundary Issue using distance calculation
    // Calculate rough distance from the pin to Petron San Pedro
    const distanceToPetron = Math.sqrt(
      Math.pow(lat - SAN_PEDRO_COORDS.lat, 2) + 
      Math.pow(lng - SAN_PEDRO_COORDS.lng, 2)
    );

    // If the pin is within ~1km of Petron, force it to say "Barangay San Pedro"
    // Because OSM wrongly maps this area as San Miguel/Tiniguiban
    if (distanceToPetron < 0.01) {
      parts.push("Barangay San Pedro");
    } else {
      // If they are far away, trust OSM's barangay data
      const brgy = addressData.suburb || addressData.village || addressData.neighbourhood || addressData.hamlet;
      if (brgy) parts.push(brgy);
    }

    // 4. Add City and Province
    const city = addressData.city || addressData.town || addressData.municipality || 'Puerto Princesa City';
    if (city && !parts.includes(city)) parts.push(city);
    
    parts.push('Palawan');

    return parts.join(', ');
  };

  useEffect(() => {
    const html = `
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
          .search-box {
            position: absolute;
            top: 10px;
            left: 10px;
            right: 10px;
            z-index: 1000;
            background: white;
            border-radius: 8px;
            padding: 8px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            display: flex;
            flex-direction: row;
          }
          .search-input {
            flex: 1;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 14px;
          }
          .search-button {
            margin-left: 8px;
            padding: 10px 15px;
            background: #0033A0;
            color: white;
            border: none;
            border-radius: 4px;
            font-weight: bold;
            cursor: pointer;
          }
        </style>
      </head>
      <body>
        <div class="search-box">
          <input type="text" id="searchInput" class="search-input" placeholder="Search in Puerto Princesa..." />
          <button class="search-button" onclick="searchLocation()">Search</button>
        </div>
        <div id="map"></div>
        <div class="attribution">© OpenStreetMap contributors</div>
        
        <script>
          let map;
          let marker;
          let geocodeTimeout;
          
          const defaultLat = ${SAN_PEDRO_COORDS.lat};
          const defaultLng = ${SAN_PEDRO_COORDS.lng};
          
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
            
            function getAddressFromCoords(lat, lng) {
              fetch(\`https://nominatim.openstreetmap.org/reverse?format=json&lat=\${lat}&lon=\${lng}&addressdetails=1&zoom=18\`, {
                headers: { 'User-Agent': 'PetronSanPedroApp/1.0' }
              })
                .then(response => response.json())
                .then(data => {
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'LOCATION_SELECTED',
                    lat: lat,
                    lng: lng,
                    display_name: data ? data.display_name : '',
                    address: data ? data.address : null
                  }));
                })
                .catch(() => {
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'LOCATION_SELECTED',
                    lat: lat,
                    lng: lng,
                    display_name: lat.toFixed(6) + ', ' + lng.toFixed(6)
                  }));
                });
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

            // FIX: Listen for location updates from React Native and TRIGGER geocoding
            window.addEventListener('message', function(event) {
              const data = JSON.parse(event.data);
              if (data.type === 'SET_LOCATION') {
                map.setView([data.lat, data.lon], 18);
                marker.setLatLng([data.lat, data.lon]);
                
                // We MUST call this so the app gets the text address of the GPS location
                clearTimeout(geocodeTimeout);
                getAddressFromCoords(data.lat, data.lon); 
              }
            });
          }
          
          window.searchLocation = function() {
            const query = document.getElementById('searchInput').value;
            if (!query) return;
            
            // Appending Puerto Princesa to limit scope
            const fullQuery = query + ', Puerto Princesa City, Palawan';
            
            fetch(\`https://nominatim.openstreetmap.org/search?format=json&q=\${encodeURIComponent(fullQuery)}&limit=5&countrycodes=PH&addressdetails=1\`, {
              headers: { 'User-Agent': 'PetronSanPedroApp/1.0' }
            })
              .then(response => response.json())
              .then(results => {
                if (results && results.length > 0) {
                  const first = results[0];
                  map.setView([first.lat, first.lon], 18);
                  marker.setLatLng([first.lat, first.lon]);
                  
                  fetch(\`https://nominatim.openstreetmap.org/reverse?format=json&lat=\${first.lat}&lon=\${first.lon}&addressdetails=1\`, {
                    headers: { 'User-Agent': 'PetronSanPedroApp/1.0' }
                  })
                    .then(res => res.json())
                    .then(detail => {
                      window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'LOCATION_SELECTED',
                        lat: parseFloat(first.lat),
                        lng: parseFloat(first.lon),
                        display_name: detail.display_name || first.display_name,
                        address: detail.address
                      }));
                    });
                  
                  document.getElementById('searchInput').value = '';
                } else {
                  alert('No results found');
                }
              });
          };
          
          window.onload = function() {
            initMap(defaultLat, defaultLng);
            // Fetch initial address for the default pin
            setTimeout(() => {
                // getAddressFromCoords is scoped inside initMap, let's trigger it via event
                window.postMessage(JSON.stringify({type: 'SET_LOCATION', lat: defaultLat, lon: defaultLng}), '*');
            }, 500);
          };
        </script>
      </body>
      </html>
    `;
    setMapHtml(html);
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
        setLoading(false);
        return;
      }

      // Bumped accuracy to Highest so it actually relies on GPS hardware
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      });
      const { latitude, longitude } = location.coords;
      
      if (webViewRef.current) {
        webViewRef.current.postMessage(JSON.stringify({
          type: 'SET_LOCATION',
          lat: latitude,
          lon: longitude
        }));
      }

      setSelectedLocation({ latitude, longitude });
      
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Error', 'Could not get your current location. Using default location.');
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
      }
    } catch (error) {
      console.error('Error parsing WebView message:', error);
      setLoading(false);
    }
  };

  const handleSearch = () => {
    if (!searchQuery.trim() || !webViewRef.current) return;
    setLoading(true);
    webViewRef.current.postMessage(JSON.stringify({
      type: 'SEARCH',
      query: searchQuery
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

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#999" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search location..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            placeholderTextColor="#999"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleSearch} style={styles.searchButton}>
            <Text style={styles.searchButtonText}>Go</Text>
          </TouchableOpacity>
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
            onLoadEnd={() => setLoading(false)}
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    marginHorizontal: 16,
    marginTop: 12,
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