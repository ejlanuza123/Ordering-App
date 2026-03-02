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
  Platform
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { reverseGeocode, requestLocationPermission } from '../utils/location';

export default function OpenStreetMapPicker({
  visible,
  onClose,
  onSelectAddress,
  initialAddress,
}) {
  const webViewRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [address, setAddress] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [mapHtml, setMapHtml] = useState('');

  // San Pedro, Puerto Princesa City coordinates
  const SAN_PEDRO_COORDS = {
    lat: 9.7422,  // Latitude for San Pedro, Puerto Princesa
    lng: 118.7343 // Longitude for San Pedro, Puerto Princesa
  };

  // Generate the HTML for OpenStreetMap with Leaflet
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
          .marker-pin {
            background: #ED2939;
            border: 3px solid white;
            border-radius: 50%;
            width: 20px;
            height: 20px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
          }
          .marker-pin::after {
            content: '';
            position: absolute;
            bottom: -10px;
            left: 50%;
            transform: translateX(-50%);
            width: 0;
            height: 0;
            border-left: 8px solid transparent;
            border-right: 8px solid transparent;
            border-top: 10px solid #ED2939;
          }
          .search-control {
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
          }
          .search-control input {
            flex: 1;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 14px;
          }
          .search-control button {
            margin-left: 8px;
            padding: 10px 15px;
            background: #0033A0;
            color: white;
            border: none;
            border-radius: 4px;
            font-weight: bold;
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
        </style>
      </head>
      <body>
        <div class="search-control">
          <input type="text" id="searchInput" placeholder="Search in San Pedro, Puerto Princesa..." />
          <button onclick="searchLocation()">Search</button>
        </div>
        <div id="map"></div>
        <div class="attribution">© OpenStreetMap contributors</div>
        
        <script>
          let map;
          let marker;
          
          // San Pedro, Puerto Princesa City coordinates
          const defaultLat = ${SAN_PEDRO_COORDS.lat};
          const defaultLng = ${SAN_PEDRO_COORDS.lng};
          
          // Initialize map
          function initMap(lat, lon) {
            if (map) return;
            
            map = L.map('map').setView([lat, lon], 15);
            
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
              attribution: '© OpenStreetMap contributors'
            }).addTo(map);
            
            // Add marker at center
            marker = L.marker([lat, lon], {
              draggable: true,
              icon: L.divIcon({
                className: 'custom-marker',
                html: '<div class="marker-pin"></div>',
                iconSize: [20, 30],
                iconAnchor: [10, 30]
              })
            }).addTo(map);
            
            // Handle marker drag
            marker.on('dragend', function(e) {
              const pos = e.target.getLatLng();
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'LOCATION_SELECTED',
                lat: pos.lat,
                lng: pos.lng
              }));
            });
            
            // Handle map click
            map.on('click', function(e) {
              marker.setLatLng(e.latlng);
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'LOCATION_SELECTED',
                lat: e.latlng.lat,
                lng: e.latlng.lng
              }));
            });
          }
          
          // Search function
          window.searchLocation = function() {
            const query = document.getElementById('searchInput').value;
            if (!query) return;
            
            // Add "San Pedro, Puerto Princesa" to the search query for better results
            const fullQuery = query + ', San Pedro, Puerto Princesa City, Palawan, Philippines';
            
            fetch(\`https://nominatim.openstreetmap.org/search?format=json&q=\${encodeURIComponent(fullQuery)}&limit=5&countrycodes=PH\`)
              .then(response => response.json())
              .then(results => {
                if (results && results.length > 0) {
                  const first = results[0];
                  map.setView([first.lat, first.lon], 18);
                  marker.setLatLng([first.lat, first.lon]);
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'LOCATION_SELECTED',
                    lat: parseFloat(first.lat),
                    lng: parseFloat(first.lon),
                    address: first.display_name
                  }));
                  
                  // Clear search input
                  document.getElementById('searchInput').value = '';
                } else {
                  alert('No results found in San Pedro area');
                }
              })
              .catch(error => {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'ERROR',
                  message: 'Search failed'
                }));
              });
          };
          
          // Handle messages from React Native
          window.addEventListener('message', function(event) {
            const data = JSON.parse(event.data);
            
            if (data.type === 'SET_LOCATION') {
              if (!map) {
                initMap(data.lat, data.lon);
              } else {
                map.setView([data.lat, data.lon], 16);
                marker.setLatLng([data.lat, data.lon]);
              }
            }
          });
          
          // Initialize with San Pedro, Puerto Princesa
          window.onload = function() {
            initMap(defaultLat, defaultLng);
          };
        </script>
      </body>
      </html>
    `;
    setMapHtml(html);
  }, []);

  // Get current location when modal opens
  useEffect(() => {
    if (visible) {
      getCurrentLocation();
    }
  }, [visible]);

  const getCurrentLocation = async () => {
    try {
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) return;

      const location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;
      
      // Send location to WebView
      if (webViewRef.current) {
        webViewRef.current.postMessage(JSON.stringify({
          type: 'SET_LOCATION',
          lat: latitude,
          lon: longitude
        }));
      }

      // Get address
      const addressText = await reverseGeocode(latitude, longitude);
      setAddress(addressText || 'Selected location');
      setSelectedLocation({ latitude, longitude });
      
    } catch (error) {
      console.error('Error getting location:', error);
      // If GPS fails, show San Pedro as default
      setAddress('San Pedro, Puerto Princesa City, Palawan');
      setSelectedLocation(SAN_PEDRO_COORDS);
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
        
        // Get address for selected location
        const addressText = data.address || await reverseGeocode(data.lat, data.lng);
        setAddress(addressText || 'Selected location in San Pedro, Puerto Princesa');
      } else if (data.type === 'ERROR') {
        Alert.alert('Error', data.message);
      }
    } catch (error) {
      console.error('Error parsing WebView message:', error);
    }
  };

  const handleConfirm = () => {
    if (selectedLocation && address) {
      onSelectAddress({
        ...selectedLocation,
        address,
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
      <View style={styles.container}>
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

        {/* Location Info Banner */}
        <View style={styles.locationBanner}>
          <Ionicons name="location" size={16} color="#0033A0" />
          <Text style={styles.locationBannerText}>
            Serving Barangay San Pedro, Puerto Princesa City
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
            onLoadEnd={() => setLoading(false)}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={true}
            renderLoading={() => (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color="#0033A0" />
              </View>
            )}
            style={styles.webview}
          />
        </View>

        {/* Bottom Address Panel */}
        <View style={styles.bottomPanel}>
          <View style={styles.addressContainer}>
            <Ionicons name="location-outline" size={20} color="#0033A0" />
            <Text style={styles.addressText} numberOfLines={2}>
              {address || 'Tap on the map to select your exact location in San Pedro'}
            </Text>
          </View>
          
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={styles.currentLocationButton}
              onPress={getCurrentLocation}
            >
              <Ionicons name="locate" size={20} color="#0033A0" />
              <Text style={styles.currentLocationText}>Use My Location</Text>
            </TouchableOpacity>
            
            {selectedLocation && (
              <TouchableOpacity 
                style={styles.confirmButtonLarge}
                onPress={handleConfirm}
              >
                <Text style={styles.confirmButtonLargeText}>Confirm Address</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0033A0',
  },
  confirmButton: {
    padding: 8,
  },
  confirmButtonText: {
    color: '#0033A0',
    fontWeight: '600',
  },
  locationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f4ff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  locationBannerText: {
    flex: 1,
    fontSize: 12,
    color: '#0033A0',
    fontWeight: '500',
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
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontSize: 14,
  },
  bottomPanel: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  addressText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  actionButtons: {
    gap: 12,
  },
  currentLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f4ff',
    padding: 14,
    borderRadius: 12,
  },
  currentLocationText: {
    marginLeft: 8,
    color: '#0033A0',
    fontSize: 14,
    fontWeight: '600',
  },
  confirmButtonLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0033A0',
    padding: 16,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#0033A0',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  confirmButtonLargeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
  },
});