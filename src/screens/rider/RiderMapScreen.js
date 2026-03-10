// src/screens/rider/RiderMapScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  Modal,
  Platform
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import * as Location from 'expo-location';
import { requestLocationPermission } from '../../utils/location';
import CustomAlertModal from '../../components/CustomAlertModal';

export default function RiderMapScreen({ navigation }) {
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const webViewRef = useRef(null);
  
  const [loading, setLoading] = useState(true);
  const [mapHtml, setMapHtml] = useState('');
  const [currentLocation, setCurrentLocation] = useState(null);
  const [deliveries, setDeliveries] = useState([]);
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    type: 'warning',
    title: '',
    message: ''
  });
  const [locationSubscription, setLocationSubscription] = useState(null);

  // Petron San Pedro Station coordinates (default)
  const SAN_PEDRO_COORDS = {
    lat: 9.7534772,
    lng: 118.7478688
  };

  // Generate map HTML with all delivery markers
  useEffect(() => {
    if (!loading) {
      generateMapHtml();
    }
  }, [deliveries, currentLocation, loading]);

  const generateMapHtml = () => {
    // Create markers array from deliveries with better validation
    const markers = deliveries
      .filter(d => {
        const hasValidCoords = d.orders?.delivery_lat && d.orders?.delivery_lng;
        if (!hasValidCoords) {
          console.log('Delivery missing coordinates:', d.id, d.orders);
        }
        return hasValidCoords;
      })
      .map(d => ({
        id: d.id,
        lat: parseFloat(d.orders.delivery_lat),
        lng: parseFloat(d.orders.delivery_lng),
        title: `Order #${d.orders?.order_number || d.order_id || 'Unknown'}`,
        description: d.orders?.customer_name?.full_name || 'Customer',
        status: d.status,
        address: d.orders?.delivery_address
      }));

    const currentLoc = currentLocation || SAN_PEDRO_COORDS;

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
          
          /* Modern GPS-style markers */
          .gps-pulse {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: rgba(16, 185, 129, 0.3);
            position: absolute;
            top: -10px;
            left: -10px;
            animation: pulse 2s infinite;
          }
          
          @keyframes pulse {
            0% {
              transform: scale(1);
              opacity: 1;
            }
            100% {
              transform: scale(1.5);
              opacity: 0;
            }
          }
          
          /* Rider Marker - Modern GPS Style */
          .rider-marker {
            background: #10B981;
            border: 3px solid white;
            border-radius: 50%;
            width: 20px;
            height: 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            position: absolute;
            top: 0;
            left: 0;
          }
          
          .rider-marker::before {
            content: '';
            position: absolute;
            top: -10px;
            left: -10px;
            right: -10px;
            bottom: -10px;
            border-radius: 50%;
            background: rgba(16, 185, 129, 0.3);
            animation: ripple 2s infinite;
          }
          
          @keyframes ripple {
            0% {
              transform: scale(0.5);
              opacity: 1;
            }
            100% {
              transform: scale(2);
              opacity: 0;
            }
          }
          
          /* Direction Arrow for Rider */
          .rider-direction {
            position: absolute;
            top: -20px;
            left: 2px;
            width: 0;
            height: 0;
            border-left: 8px solid transparent;
            border-right: 8px solid transparent;
            border-bottom: 12px solid #10B981;
            transform: rotate(45deg);
            filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
          }
          
          /* Delivery Marker - Modern Numbered Pin */
          .delivery-pin-numbered {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: #ED2939;
            border: 3px solid white;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 14px;
            position: relative;
          }
          
          .delivery-pin-numbered::before {
            content: '';
            position: absolute;
            top: -2px;
            left: -2px;
            right: -2px;
            bottom: -2px;
            border-radius: 50%;
            background: rgba(255,255,255,0.3);
            animation: ping 1.5s infinite;
          }
          
          @keyframes ping {
            0% {
              transform: scale(1);
              opacity: 1;
            }
            100% {
              transform: scale(1.3);
              opacity: 0;
            }
          }
          
          .delivery-pin-numbered span {
            position: relative;
            z-index: 2;
          }
          
          /* Delivery label */
          .delivery-label {
            position: absolute;
            top: -25px;
            left: 50%;
            transform: translateX(-50%);
            background: white;
            padding: 4px 8px;
            border-radius: 16px;
            font-size: 10px;
            font-weight: 600;
            box-shadow: 0 2px 6px rgba(0,0,0,0.15);
            white-space: nowrap;
            border: 1px solid #eee;
            color: #333;
          }
          
          /* Rider label */
          .rider-label {
            position: absolute;
            top: -30px;
            left: 5px;
            background: #10B981;
            color: white;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 10px;
            font-weight: bold;
            white-space: nowrap;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          }
          
          /* Controls */
          .controls {
            position: absolute;
            top: 10px;
            right: 10px;
            z-index: 1000;
            display: flex;
            flex-direction: column;
            gap: 8px;
          }
          
          .control-button {
            background: white;
            border: none;
            border-radius: 12px;
            padding: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
            color: #0033A0;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            transition: all 0.2s;
            backdrop-filter: blur(10px);
            background: rgba(255, 255, 255, 0.95);
          }
          
          .control-button:hover {
            transform: scale(1.05);
            background: white;
          }
          
          .control-button:active {
            transform: scale(0.95);
          }
          
          .attribution {
            position: absolute;
            bottom: 5px;
            right: 5px;
            background: rgba(255,255,255,0.9);
            padding: 4px 8px;
            border-radius: 20px;
            font-size: 10px;
            z-index: 1000;
            backdrop-filter: blur(5px);
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          
          /* Popup styles */
          .delivery-popup {
            min-width: 220px;
            padding: 12px;
          }
          
          .popup-title {
            font-weight: 700;
            color: #1a1a1a;
            margin-bottom: 4px;
            font-size: 14px;
          }
          
          .popup-address {
            font-size: 12px;
            color: #666;
            margin-bottom: 8px;
            line-height: 1.4;
          }
          
          .popup-status {
            margin-bottom: 12px;
            font-size: 11px;
            color: #999;
          }
          
          .popup-status span {
            font-weight: 600;
          }
          
          .popup-button {
            background: #0033A0;
            color: white;
            border: none;
            border-radius: 8px;
            padding: 8px 16px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            width: 100%;
            transition: all 0.2s;
          }
          
          .popup-button:hover {
            background: #002277;
            transform: translateY(-1px);
          }
          
          .popup-button:active {
            transform: translateY(0);
          }
          
          /* Route line style */
          .route-line {
            stroke: #0033A0;
            stroke-width: 4;
            stroke-dasharray: 8, 8;
            animation: dash 30s linear infinite;
          }
          
          @keyframes dash {
            to {
              stroke-dashoffset: -100;
            }
          }
          
          /* Custom popup styling */
          .leaflet-popup-content-wrapper {
            border-radius: 12px;
            padding: 0;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
          }
          
          .leaflet-popup-content {
            margin: 0;
            min-width: 200px;
          }
          
          .leaflet-popup-tip {
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
          }
        </style>
      </head>
      <body>
        <div class="controls">
          <button class="control-button" onclick="window.fitAllMarkers()">
            <span style="font-size: 18px;">📍</span> Fit All
          </button>
          <button class="control-button" onclick="window.centerOnMe()">
            <span style="font-size: 18px;">🎯</span> My Location
          </button>
        </div>
        
        <div id="map"></div>
        <div class="attribution">© OpenStreetMap contributors</div>
        
        <script>
          // Make everything globally available
          window.map = null;
          window.riderMarker = null;
          window.deliveryMarkers = [];
          window.routeLine = null;
          window.currentLocation = { lat: ${currentLoc.lat}, lng: ${currentLoc.lng} };
          
          // Delivery markers data
          window.deliveries = ${JSON.stringify(markers)};
          
          function initMap() {
            try {
              window.map = L.map('map', {
                zoomControl: false,
                fadeAnimation: true,
                markerZoomAnimation: true
              }).setView([window.currentLocation.lat, window.currentLocation.lng], 14);
              
              // Use a more modern map style
              L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                attribution: '©OpenStreetMap, ©CartoDB',
                subdomains: 'abcd',
                maxZoom: 19
              }).addTo(window.map);
              
              // Add rider marker
              addRiderMarker();
              
              // Add delivery markers
              addDeliveryMarkers();
              
              // Draw optimized route line if there are deliveries
              if (window.deliveries.length > 0) {
                drawOptimizedRoute();
              }
              
              // Fit all markers after a short delay
              setTimeout(() => {
                window.fitAllMarkers();
              }, 500);
              
              console.log('Map initialized successfully');
            } catch (error) {
              console.error('Map initialization error:', error);
            }
          }
          
          function addRiderMarker() {
            try {
              const riderIcon = L.divIcon({
                html: \`
                  <div style="position: relative;">
                    <div class="gps-pulse"></div>
                    <div class="rider-marker"></div>
                    <div class="rider-direction"></div>
                    <div class="rider-label">You</div>
                  </div>
                \`,
                className: '',
                iconSize: [40, 60],
                iconAnchor: [20, 30],
                popupAnchor: [0, -30]
              });
              
              window.riderMarker = L.marker([window.currentLocation.lat, window.currentLocation.lng], {
                icon: riderIcon,
                zIndexOffset: 1000
              }).addTo(window.map);
              
              window.riderMarker.bindPopup('<b>Your Location</b>');
              console.log('Rider marker added');
            } catch (error) {
              console.error('Error adding rider marker:', error);
            }
          }
          
          function addDeliveryMarkers() {
            try {
              window.deliveryMarkers = [];
              
              window.deliveries.forEach((delivery, index) => {
                if (!delivery.lat || !delivery.lng) {
                  console.log('Skipping delivery with missing coordinates:', delivery);
                  return;
                }
                
                const color = delivery.status === 'assigned' ? '#F59E0B' : 
                             delivery.status === 'picked_up' ? '#0033A0' : '#10B981';
                
                const deliveryIcon = L.divIcon({
                  html: \`
                    <div style="position: relative;">
                      <div class="delivery-pin-numbered" style="background: \${color};">
                        <span>\${index + 1}</span>
                      </div>
                      <div class="delivery-label">
                        Order #\${delivery.title.split('#')[1] || index + 1}
                      </div>
                    </div>
                  \`,
                  className: '',
                  iconSize: [36, 60],
                  iconAnchor: [18, 30],
                  popupAnchor: [0, -30]
                });
                
                const marker = L.marker([delivery.lat, delivery.lng], {
                  icon: deliveryIcon
                }).addTo(window.map);
                
                // Create popup content with improved button handling
                const popupContent = document.createElement('div');
                popupContent.className = 'delivery-popup';
                popupContent.innerHTML = \`
                  <div class="popup-title">\${delivery.title}</div>
                  <div class="popup-address">\${delivery.description}</div>
                  <div class="popup-status">
                    Status: <span style="color: \${color};">\${delivery.status.replace('_', ' ')}</span>
                  </div>
                  <button class="popup-button" data-delivery-id="\${delivery.id}">
                    View Details
                  </button>
                \`;
                
                // Add click event listener to the button
                const button = popupContent.querySelector('button');
                button.addEventListener('click', (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  
                  console.log('Popup button clicked for delivery:', delivery.id);
                  
                  // Close the popup
                  marker.closePopup();
                  
                  // Send message to React Native
                  if (window.ReactNativeWebView) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                      type: 'DELIVERY_SELECTED',
                      deliveryId: delivery.id,
                      lat: delivery.lat,
                      lng: delivery.lng
                    }));
                  }
                  
                  // Highlight the selected delivery
                  if (window.map) {
                    window.map.flyTo([delivery.lat, delivery.lng], 17, {
                      duration: 1
                    });
                  }
                  
                  return false;
                });
                
                marker.bindPopup(popupContent, {
                  className: 'custom-popup',
                  closeButton: true,
                  autoClose: true,
                  closeOnClick: true
                });
                
                // Handle marker click separately
                marker.on('click', function(e) {
                  console.log('Marker clicked:', delivery.id);
                });
                
                window.deliveryMarkers.push({
                  marker: marker,
                  data: delivery
                });
              });
              
              console.log('Delivery markers added:', window.deliveryMarkers.length);
            } catch (error) {
              console.error('Error adding delivery markers:', error);
            }
          }
          
          function drawOptimizedRoute() {
            try {
              // Create waypoints: current location + all delivery locations
              const waypoints = [
                [window.currentLocation.lat, window.currentLocation.lng],
                ...window.deliveries.map(d => [d.lat, d.lng])
              ];
              
              // Remove existing route line
              if (window.routeLine) {
                window.map.removeLayer(window.routeLine);
              }
              
              // Draw a dashed line connecting all points in order
              window.routeLine = L.polyline(waypoints, {
                color: '#0033A0',
                weight: 4,
                opacity: 0.6,
                dashArray: '8, 8',
                lineJoin: 'round'
              }).addTo(window.map);
              
              console.log('Route line drawn');
            } catch (error) {
              console.error('Error drawing route:', error);
            }
          }
          
          window.fitAllMarkers = function() {
            console.log('fitAllMarkers called');
            if (!window.map) {
              console.log('Map not initialized');
              return;
            }
            
            const points = [];
            
            // Add current location
            if (window.currentLocation) {
              points.push([window.currentLocation.lat, window.currentLocation.lng]);
            }
            
            // Add all delivery locations
            window.deliveryMarkers.forEach(m => {
              const latLng = m.marker.getLatLng();
              points.push([latLng.lat, latLng.lng]);
            });
            
            console.log('Points to fit:', points.length);
            
            if (points.length > 0) {
              const bounds = L.latLngBounds(points);
              window.map.flyToBounds(bounds, {
                padding: [50, 50],
                duration: 1.5,
                maxZoom: 15
              });
              console.log('Fitting bounds:', points.length, 'points');
            } else {
              // If no points, just center on current location
              window.map.setView([window.currentLocation.lat, window.currentLocation.lng], 14);
            }
          };
          
          window.centerOnMe = function() {
            console.log('centerOnMe called');
            if (window.map && window.currentLocation) {
              window.map.flyTo([window.currentLocation.lat, window.currentLocation.lng], 16, {
                duration: 1.5
              });
            }
          };
          
          // Listen for location updates from React Native
          window.addEventListener('message', function(event) {
            try {
              const data = JSON.parse(event.data);
              console.log('Message received in WebView:', data);
              
              if (data.type === 'UPDATE_LOCATION') {
                window.currentLocation = { lat: data.lat, lng: data.lon };
                
                if (window.riderMarker) {
                  window.riderMarker.setLatLng([data.lat, data.lon]);
                  
                  // Update route line
                  if (window.deliveryMarkers.length > 0) {
                    drawOptimizedRoute();
                  }
                  
                  // Update map view if needed
                  if (data.shouldCenter && window.map) {
                    window.map.flyTo([data.lat, data.lon], 16, {
                      duration: 1
                    });
                  }
                }
              } else if (data.type === 'FIT_ALL') {
                window.fitAllMarkers();
              } else if (data.type === 'CENTER_ON_DELIVERY') {
                if (window.map) {
                  window.map.flyTo([data.lat, data.lng], 17, {
                    duration: 1
                  });
                }
              }
            } catch (error) {
              console.error('Error processing message:', error);
            }
          });
          
          // Initialize map when DOM is ready
          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initMap);
          } else {
            // DOM is already loaded
            setTimeout(initMap, 100);
          }
        </script>
      </body>
      </html>
    `;

    setMapHtml(html);
  };

  // Fetch active deliveries
  const fetchActiveDeliveries = async () => {
    try {
      const { data, error } = await supabase
        .from('deliveries')
        .select(`
          *,
          orders (
            id,
            order_number,
            total_amount,
            delivery_address,
            delivery_lat,
            delivery_lng,
            customer_name:profiles!orders_user_id_fkey (
              full_name,
              phone_number
            ),
            payment_method,
            special_instructions,
            order_items (
              quantity,
              price_at_order,
              products (
                name,
                unit
              )
            )
          )
        `)
        .eq('rider_id', profile.id)
        .in('status', ['assigned', 'picked_up']);

      if (error) throw error;
      
      console.log('Fetched deliveries:', data?.length || 0);
      setDeliveries(data || []);
    } catch (error) {
      console.error('Error fetching deliveries:', error.message);
      setAlertConfig({
        type: 'error',
        title: 'Error',
        message: 'Failed to load deliveries'
      });
      setShowAlert(true);
    }
  };

  // Get current location
  const getCurrentLocation = async (shouldCenter = false) => {
    try {
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) return;

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      });

      const { latitude, longitude } = location.coords;
      
      console.log('Current location:', latitude, longitude);
      
      setCurrentLocation({
        lat: latitude,
        lng: longitude
      });

      if (webViewRef.current) {
        webViewRef.current.postMessage(JSON.stringify({
          type: 'UPDATE_LOCATION',
          lat: latitude,
          lon: longitude,
          shouldCenter
        }));
      }

    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  // Start watching location
  const startWatchingLocation = async () => {
    try {
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) return;

      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Highest,
          timeInterval: 5000,
          distanceInterval: 10
        },
        (location) => {
          const { latitude, longitude } = location.coords;
          
          setCurrentLocation({
            lat: latitude,
            lng: longitude
          });

          if (webViewRef.current) {
            webViewRef.current.postMessage(JSON.stringify({
              type: 'UPDATE_LOCATION',
              lat: latitude,
              lon: longitude,
              shouldCenter: false
            }));
          }
        }
      );

      setLocationSubscription(subscription);
    } catch (error) {
      console.error('Error watching location:', error);
    }
  };

  // Initial load
  useEffect(() => {
    const initialize = async () => {
      setLoading(true);
      await getCurrentLocation(true);
      await fetchActiveDeliveries();
      await startWatchingLocation();
      setLoading(false);
    };

    initialize();

    // Set up real-time subscription for deliveries
    if (profile) {
      const channel = supabase
        .channel('rider-map-updates')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'deliveries',
            filter: `rider_id=eq.${profile.id}`
          },
          () => {
            fetchActiveDeliveries();
          }
        )
        .subscribe();

      return () => {
        channel.unsubscribe();
        if (locationSubscription) {
          locationSubscription.remove();
        }
      };
    }
  }, [profile]);

  const handleWebViewMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('WebView message received:', data);
      
      if (data.type === 'DELIVERY_SELECTED') {
        const delivery = deliveries.find(d => d.id === data.deliveryId);
        console.log('Found delivery:', delivery);
        
        if (delivery) {
          setSelectedDelivery(delivery);
          setShowDeliveryModal(true);
        } else {
          console.log('Delivery not found with ID:', data.deliveryId);
        }
      }
    } catch (error) {
      console.error('Error parsing WebView message:', error);
    }
  };

  const handleDeliveryPress = (delivery) => {
    setSelectedDelivery(delivery);
    setShowDeliveryModal(true);
    
    // Center map on this delivery
    if (webViewRef.current && delivery.orders?.delivery_lat && delivery.orders?.delivery_lng) {
      webViewRef.current.postMessage(JSON.stringify({
        type: 'CENTER_ON_DELIVERY',
        lat: parseFloat(delivery.orders.delivery_lat),
        lng: parseFloat(delivery.orders.delivery_lng)
      }));
    }
  };

  const openNavigation = () => {
    if (!selectedDelivery?.orders?.delivery_lat || !selectedDelivery?.orders?.delivery_lng) {
      Alert.alert('Error', 'Delivery coordinates not available');
      return;
    }

    const { delivery_lat, delivery_lng } = selectedDelivery.orders;
    const url = Platform.select({
      ios: `maps:${delivery_lat},${delivery_lng}`,
      android: `geo:${delivery_lat},${delivery_lng}?q=${delivery_lat},${delivery_lng}(${encodeURIComponent(selectedDelivery.orders?.delivery_address || 'Delivery')})`
    });
    
    Linking.openURL(url);
  };

  const viewDeliveryDetails = () => {
    setShowDeliveryModal(false);
    navigation.navigate('RiderDeliveryDetails', { delivery: selectedDelivery });
  };

  const fitAllMarkers = () => {
    console.log('fitAllMarkers called from React Native');
    if (webViewRef.current) {
      webViewRef.current.postMessage(JSON.stringify({
        type: 'FIT_ALL'
      }));
    } else {
      console.log('WebView ref not available');
    }
  };

  const refreshLocation = () => {
    getCurrentLocation(true);
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#0033A0" />
        <Text style={styles.loadingText}>Loading map...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#0033A0" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Delivery Map</Text>
        <TouchableOpacity onPress={fitAllMarkers} style={styles.fitButton}>
          <Ionicons name="expand" size={24} color="#0033A0" />
        </TouchableOpacity>
      </View>

      {/* Map View */}
      <View style={styles.mapContainer}>
        <WebView
          ref={webViewRef}
          source={{ html: mapHtml }}
          onMessage={handleWebViewMessage}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          style={styles.webview}
          onLoadEnd={() => setLoading(false)}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.warn('WebView error: ', nativeEvent);
          }}
          onLoadStart={() => console.log('WebView loading started')}
          onLoad={() => console.log('WebView loaded')}
        />
      </View>

      {/* Bottom Panel - Active Deliveries List */}
      <View style={[styles.bottomPanel, { paddingBottom: insets.bottom + 20, paddingTop: 12 }]}>
        <View style={styles.panelHeader}>
          <Text style={styles.panelTitle}>
            Active Deliveries ({deliveries.length})
          </Text>
          <TouchableOpacity onPress={refreshLocation} style={styles.locateButton}>
            <Ionicons name="locate" size={22} color="#0033A0" />
          </TouchableOpacity>
        </View>

        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.deliveriesScroll}
          contentContainerStyle={styles.deliveriesScrollContent}
        >
          {deliveries.length === 0 ? (
            <View style={styles.emptyDeliveries}>
              <Ionicons name="bicycle-outline" size={24} color="#ccc" />
              <Text style={styles.emptyText}>No active deliveries</Text>
            </View>
          ) : (
            deliveries.map((delivery, index) => (
              <TouchableOpacity
                key={delivery.id}
                style={[
                  styles.deliveryChip,
                  selectedDelivery?.id === delivery.id && styles.deliveryChipSelected
                ]}
                onPress={() => handleDeliveryPress(delivery)}
              >
                <View style={[
                  styles.chipNumber,
                  { backgroundColor: delivery.status === 'assigned' ? '#F59E0B' : '#0033A0' }
                ]}>
                  <Text style={styles.chipNumberText}>{index + 1}</Text>
                </View>
                <View style={[
                  styles.chipStatus,
                  { backgroundColor: delivery.status === 'assigned' ? '#F59E0B' : '#0033A0' }
                ]} />
                <View style={styles.chipInfo}>
                  <Text style={styles.chipOrder}>
                    #{delivery.orders?.order_number || delivery.order_id}
                  </Text>
                  <Text style={styles.chipAddress} numberOfLines={1}>
                    {delivery.orders?.customer_name?.full_name}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#999" />
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </View>

      {/* Delivery Details Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showDeliveryModal}
        onRequestClose={() => setShowDeliveryModal(false)}
      >
        <View style={[styles.modalOverlay, { paddingTop: insets.top }]}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Delivery Details</Text>
              <TouchableOpacity onPress={() => setShowDeliveryModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {selectedDelivery && (
              <View style={styles.modalBody}>
                <View style={styles.modalStatus}>
                  <View style={[
                    styles.modalStatusBadge,
                    { backgroundColor: selectedDelivery.status === 'assigned' ? '#F59E0B' : '#0033A0' }
                  ]}>
                    <Text style={styles.modalStatusText}>
                      {selectedDelivery.status === 'assigned' ? 'Ready to Pick Up' : 'Out for Delivery'}
                    </Text>
                  </View>
                </View>

                <View style={styles.modalInfo}>
                  <Text style={styles.modalOrderNumber}>
                    Order #{selectedDelivery.orders?.order_number || selectedDelivery.order_id}
                  </Text>
                  
                  <View style={styles.modalInfoRow}>
                    <Ionicons name="person" size={18} color="#666" />
                    <Text style={styles.modalInfoText}>
                      {selectedDelivery.orders?.customer_name?.full_name}
                    </Text>
                  </View>

                  <View style={styles.modalInfoRow}>
                    <Ionicons name="call" size={18} color="#666" />
                    <Text style={styles.modalInfoText}>
                      {selectedDelivery.orders?.customer_name?.phone_number || 'No phone'}
                    </Text>
                  </View>

                  <View style={styles.modalInfoRow}>
                    <Ionicons name="location" size={18} color="#666" />
                    <Text style={styles.modalInfoText} numberOfLines={2}>
                      {selectedDelivery.orders?.delivery_address}
                    </Text>
                  </View>

                  {selectedDelivery.orders?.special_instructions && (
                    <View style={styles.modalInfoRow}>
                      <Ionicons name="document-text" size={18} color="#666" />
                      <Text style={styles.modalInfoText} numberOfLines={2}>
                        {selectedDelivery.orders.special_instructions}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalActionButton, styles.navigateButton]}
                    onPress={openNavigation}
                  >
                    <Ionicons name="navigate" size={20} color="#fff" />
                    <Text style={styles.modalActionText}>Navigate</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modalActionButton, styles.detailsButton]}
                    onPress={viewDeliveryDetails}
                  >
                    <Ionicons name="document-text" size={20} color="#fff" />
                    <Text style={styles.modalActionText}>Full Details</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Alert Modal */}
      <CustomAlertModal
        visible={showAlert}
        onClose={() => setShowAlert(false)}
        type={alertConfig.type}
        title={alertConfig.title}
        message={alertConfig.message}
        confirmText="OK"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    zIndex: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f4ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fitButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f4ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  locateButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f4ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0033A0',
  },
  mapContainer: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
  bottomPanel: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    paddingHorizontal: 16,
    paddingTop: 12,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  panelTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  deliveriesScroll: {
    maxHeight: 90,
  },
  deliveriesScrollContent: {
    paddingVertical: 5,
  },
  deliveryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 10,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#e9ecef',
    minWidth: 200,
  },
  deliveryChipSelected: {
    borderColor: '#0033A0',
    backgroundColor: '#f0f4ff',
  },
  chipNumber: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  chipNumberText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  chipStatus: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  chipInfo: {
    flex: 1,
    marginRight: 4,
  },
  chipOrder: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  chipAddress: {
    fontSize: 10,
    color: '#666',
  },
  emptyDeliveries: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    color: '#999',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalBody: {
    padding: 20,
  },
  modalStatus: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modalStatusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  modalStatusText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  modalInfo: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  modalOrderNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0033A0',
    marginBottom: 12,
  },
  modalInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 12,
  },
  modalInfoText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    gap: 8,
  },
  navigateButton: {
    backgroundColor: '#0033A0',
  },
  detailsButton: {
    backgroundColor: '#ED2939',
  },
  modalActionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});