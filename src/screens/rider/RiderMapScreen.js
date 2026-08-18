// src/screens/rider/RiderMapScreen.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { requestLocationPermission, PUERTO_PRINCESA_LANDMARKS } from '../../utils/location';
import CustomAlertModal from '../../components/CustomAlertModal';
import { startLocationTracking, stopLocationTracking } from '../../utils/riderLocation';
import { riderPresenceService } from '../../services/riderPresenceService';
import { useFocusEffect } from '@react-navigation/native';

const devLog = (...args) => {
  if (__DEV__) {
    console.log(...args);
  }
};

export default function RiderMapScreen({ navigation, route }) {
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const webViewRef = useRef(null);
  const trackingSubscriptionRef = useRef(null);
  
  const [loading, setLoading] = useState(true);
  const [mapHtml, setMapHtml] = useState('');
  const [currentLocation, setCurrentLocation] = useState(null);
  const [deliveries, setDeliveries] = useState([]);
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [focusedDeliveryId, setFocusedDeliveryId] = useState(null);
  const [mapViewMode, setMapViewMode] = useState('all');
  const [mapLayer, setMapLayer] = useState('street'); // 'street' | 'satellite' | 'dark'
  const [showLandmarks, setShowLandmarks] = useState(true);
  const [routeEtaMinutes, setRouteEtaMinutes] = useState(null);
  const [routeDistanceKm, setRouteDistanceKm] = useState(null);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    type: 'warning',
    title: '',
    message: ''
  });
  const [tracking, setTracking] = useState(true);
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState(null);
  const [onlineStatus, setOnlineStatus] = useState(true);

  // Petron San Pedro Station coordinates (default)
  const SAN_PEDRO_COORDS = {
    lat: 9.7534772,
    lng: 118.7478688
  };

  // Auto-focus delivery if routed with parameters
  useEffect(() => {
    const targetId = route?.params?.focusedDeliveryId;
    const targetDelivery = route?.params?.delivery;
    if (targetId || targetDelivery) {
      const deliveryToFocus = targetDelivery || deliveries.find(d => d.id === targetId);
      if (deliveryToFocus) {
        setSelectedDelivery(deliveryToFocus);
        setFocusedDeliveryId(deliveryToFocus.id);
        setMapViewMode('focused');
        setShowDeliveryModal(true);

        if (webViewRef.current) {
          webViewRef.current.postMessage(JSON.stringify({
            type: 'FOCUS_DELIVERY',
            deliveryId: deliveryToFocus.id,
          }));

          const destLat = deliveryToFocus.orders?.delivery_lat ?? deliveryToFocus.delivery_lat;
          const destLng = deliveryToFocus.orders?.delivery_lng ?? deliveryToFocus.delivery_lng;
          if (destLat && destLng) {
            webViewRef.current.postMessage(JSON.stringify({
              type: 'CENTER_ON_DELIVERY',
              lat: parseFloat(destLat),
              lng: parseFloat(destLng)
            }));
          }
        }
      }
    }
  }, [route?.params?.focusedDeliveryId, route?.params?.delivery, deliveries]);

  // Generate map HTML with all delivery markers
  useEffect(() => {
    if (!loading) {
      generateMapHtml();
    }
  }, [deliveries, loading, mapViewMode, focusedDeliveryId, mapLayer, showLandmarks]);

  // UseFocusEffect to ensure rider stays online when viewing map
  useFocusEffect(
    useCallback(() => {
      const fetchLatestProfileState = async () => {
        if (!profile) return;
        
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('avatar_url, is_online')
            .eq('id', profile.id)
            .single();
            
          if (!error && data?.avatar_url) {
            setCurrentAvatarUrl(data.avatar_url);
          }

          // CRITICAL FIX: Ensure rider is marked online when viewing the map
          if (!error) {
            const isOnline = data?.is_online === true;
            setOnlineStatus(isOnline);
            
            // If the rider is supposed to be online but the DB says offline, fix it
            if (!isOnline && riderPresenceService.isIntendedOnline()) {
              devLog('Map screen: Setting rider online');
              await riderPresenceService.setOnlineStatus(profile.id, true);
              setOnlineStatus(true);
            }
          } else if (riderPresenceService.isIntendedOnline()) {
            // On error, assume we should be online (only if the rider intends to be)
            devLog('Map screen: Error fetching status, setting online');
            await riderPresenceService.setOnlineStatus(profile.id, true);
            setOnlineStatus(true);
          }
        } catch (error) {
          console.error('Error fetching latest profile state:', error);
        }
      };

      fetchLatestProfileState();
    }, [profile])
  );

  // start/stop tracking when rider toggles or logs out
  useEffect(() => {
    let isActive = true;

    const startTrackingSession = async () => {
      if (!tracking || !profile?.id) {
        if (trackingSubscriptionRef.current) {
          stopLocationTracking(trackingSubscriptionRef.current);
          trackingSubscriptionRef.current = null;
        }
        return;
      }

      if (riderPresenceService.isIntendedOnline()) {
        await riderPresenceService.setOnlineStatus(profile.id, true);
        setOnlineStatus(true);
      }

      if (trackingSubscriptionRef.current) {
        stopLocationTracking(trackingSubscriptionRef.current);
        trackingSubscriptionRef.current = null;
      }

      const result = await startLocationTracking(profile.id, (loc) => {
        if (!isActive) return;

        setCurrentLocation({
          lat: loc.latitude,
          lng: loc.longitude
        });

        if (webViewRef.current) {
          webViewRef.current.postMessage(JSON.stringify({
            type: 'UPDATE_LOCATION',
            lat: loc.latitude,
            lon: loc.longitude,
            shouldCenter: false
          }));
        }
      });

      if (result.success && isActive) {
        trackingSubscriptionRef.current = result.subscription;
      } else if (!result.success) {
        devLog('tracking failed', result.error);
      }
    };

    startTrackingSession();

    return () => {
      isActive = false;
      if (trackingSubscriptionRef.current) {
        stopLocationTracking(trackingSubscriptionRef.current);
        trackingSubscriptionRef.current = null;
      }
    };
  }, [tracking, profile?.id]);

  const generateMapHtml = () => {
    const deliveriesForMap = mapViewMode === 'focused' && focusedDeliveryId
      ? deliveries.filter(d => d.id === focusedDeliveryId)
      : deliveries;

    // Create markers array from deliveries with better validation
    const markers = deliveriesForMap
      .filter(d => {
        if (!d.orders) {
          devLog('Delivery row has no linked order (likely RLS):', d.id);
          return false;
        }
        const hasValidCoords = (d.orders.delivery_lat || d.delivery_lat) && (d.orders.delivery_lng || d.delivery_lng);
        if (!hasValidCoords) {
          devLog('Delivery missing coordinates:', d.id, d.orders, {
            delivery_lat: d.delivery_lat,
            delivery_lng: d.delivery_lng
          });
        }
        return hasValidCoords;
      })
      .map((d, index) => {
        const originalIndex = deliveries.findIndex((item) => item.id === d.id);

        return ({
        id: d.id,
        lat: parseFloat(d.orders?.delivery_lat ?? d.delivery_lat),
        lng: parseFloat(d.orders?.delivery_lng ?? d.delivery_lng),
        title: `Order #${d.orders?.order_number || d.order_id || 'Unknown'}`,
        description: d.orders?.customer_name?.full_name || 'Customer',
        status: d.status,
        address: d.orders?.delivery_address,
        displayIndex: originalIndex >= 0 ? originalIndex + 1 : index + 1,
      });
      });
        

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
          /* Landmark badges */
          .landmark-badge {
            background: rgba(255, 255, 255, 0.94);
            color: #1e293b;
            font-size: 10px;
            font-weight: 700;
            padding: 3px 8px;
            border-radius: 14px;
            border: 1px solid #cbd5e1;
            box-shadow: 0 2px 6px rgba(0,0,0,0.15);
            white-space: nowrap;
            display: inline-flex;
            align-items: center;
            gap: 4px;
          }
          .landmark-marker-wrap {
            background: transparent;
            border: none;
          }

          /* Enhanced High-Visibility Navigation Night Map */
          .dark-mode-active .leaflet-tile-pane {
            filter: brightness(1.35) contrast(1.3) saturate(1.15);
          }
          .dark-mode-active #map {
            background: #0f172a;
          }
          .dark-mode-active .delivery-label {
            background: #1e293b;
            color: #f8fafc;
            border-color: #334155;
            box-shadow: 0 2px 8px rgba(0,0,0,0.5);
          }
          .dark-mode-active .delivery-pin-numbered {
            box-shadow: 0 0 16px rgba(0, 51, 160, 0.7), 0 4px 12px rgba(0,0,0,0.6);
            border-color: #93c5fd;
          }
          .dark-mode-active .delivery-pin-active {
            box-shadow: 0 0 18px rgba(237, 41, 57, 0.8), 0 4px 12px rgba(0,0,0,0.6);
            border-color: #fecaca;
          }
          .dark-mode-active .landmark-badge {
            background: rgba(30, 41, 59, 0.95);
            color: #f8fafc;
            border: 1px solid #475569;
            box-shadow: 0 3px 8px rgba(0,0,0,0.5);
          }
          .dark-mode-active .leaflet-popup-content-wrapper {
            background: #1e293b;
            color: #f8fafc;
            border: 1px solid #334155;
          }
          .dark-mode-active .leaflet-popup-tip {
            background: #1e293b;
          }
          .dark-mode-active .popup-title {
            color: #f8fafc;
          }
          .dark-mode-active .popup-address {
            color: #94a3b8;
          }
          .dark-mode-active .attribution {
            background: rgba(15, 23, 42, 0.85);
            color: #94a3b8;
          }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <div class="attribution">© OpenStreetMap contributors</div>
        
        <script>
          // Make everything globally available
          window.map = null;
          window.riderMarker = null;
          window.deliveryMarkers = [];
          window.landmarkMarkers = [];
          window.routeLine = null;
          window.routeArrows = [];
          window.routeMode = '${mapViewMode === 'focused' ? 'focused' : 'none'}';
          window.lastRouteOrigin = null;
          window.lastRerouteAt = 0;
          window.currentLocation = { lat: ${currentLoc.lat}, lng: ${currentLoc.lng} };
          window.currentLayerName = '${mapLayer}';
          window.showLandmarks = ${showLandmarks ? 'true' : 'false'};
          window.landmarksData = ${JSON.stringify(PUERTO_PRINCESA_LANDMARKS || [])};
          
          // Delivery markers data
          window.deliveries = ${JSON.stringify(markers)};
          window.allDeliveries = ${JSON.stringify(markers)};
          const DEV_MODE = ${__DEV__ ? 'true' : 'false'};
          const log = (...args) => {
            if (DEV_MODE) {
              console.log(...args);
            }
          };

          const OSRM_BASE_URL = 'https://router.project-osrm.org';
          const REROUTE_MIN_INTERVAL_MS = 10000;
          const REROUTE_MIN_DISTANCE_METERS = 25;
          const START_STRAIGHT_MAX_METERS = 120;
          const FINAL_STRAIGHT_MAX_METERS = 120;
          
          function initMap() {
            try {
              window.map = L.map('map', {
                zoomControl: false,
                fadeAnimation: true,
                markerZoomAnimation: true
              }).setView([window.currentLocation.lat, window.currentLocation.lng], 14);
              
              // Define Tile Layers
              window.tileLayers = {
                street: L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
                  attribution: '©OpenStreetMap, ©CartoDB',
                  subdomains: 'abcd',
                  maxZoom: 19
                }),
                satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                  attribution: '©ESRI World Imagery',
                  maxZoom: 19
                }),
                dark: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                  attribution: '©CartoDB Dark Matter',
                  subdomains: 'abcd',
                  maxZoom: 19
                })
              };

              window.activeTileLayer = window.tileLayers[window.currentLayerName] || window.tileLayers.street;
              window.activeTileLayer.addTo(window.map);
              if (window.currentLayerName === 'dark') {
                document.body.classList.add('dark-mode-active');
              }
              
              // Add rider marker
              addRiderMarker();
              
              // Add delivery markers
              addDeliveryMarkers();

              // Add landmark markers
              addLandmarkMarkers();
              
              // Draw optimized route line if there are deliveries
              if (window.routeMode === 'focused' && window.deliveries.length > 0) {
                drawOptimizedRoute();
              } else {
                clearRouteLine();
              }
              
              // Fit all markers after a short delay
              setTimeout(() => {
                window.fitAllMarkers();
              }, 500);
              
              log('Map initialized successfully');
            } catch (error) {
              console.error('Map initialization error:', error);
            }
          }

          function switchTileLayer(layerName) {
            if (!window.map || !window.tileLayers || !window.tileLayers[layerName]) return;
            if (window.activeTileLayer) {
              window.map.removeLayer(window.activeTileLayer);
            }
            window.activeTileLayer = window.tileLayers[layerName];
            window.activeTileLayer.addTo(window.map);
            window.currentLayerName = layerName;
            if (layerName === 'dark') {
              document.body.classList.add('dark-mode-active');
            } else {
              document.body.classList.remove('dark-mode-active');
            }
            if (window.routeLine) {
              window.routeLine.bringToFront();
            }
          }

          function addLandmarkMarkers() {
            try {
              window.landmarkMarkers = [];
              if (!window.landmarksData) return;

              window.landmarksData.forEach(lm => {
                if (!lm.lat || !lm.lng) return;

                const icon = L.divIcon({
                  html: \`
                    <div class="landmark-badge">
                      <span>\${lm.category === 'mall' ? '🛍️' : lm.category === 'park' ? '🌴' : lm.category === 'airport' ? '✈️' : lm.category === 'government' ? '🏛️' : lm.category === 'landmark' ? '🏟️' : '📍'}</span>
                      <span>\${lm.name}</span>
                    </div>
                  \`,
                  className: 'landmark-marker-wrap',
                  iconSize: [110, 24],
                  iconAnchor: [55, 12]
                });

                const marker = L.marker([lm.lat, lm.lng], {
                  icon: icon,
                  zIndexOffset: 200
                });

                marker.bindPopup(\`<b>\${lm.name}</b><br/>\${lm.address || ''}<br/><i>Brgy. \${lm.barangay || ''}</i>\`);
                window.landmarkMarkers.push(marker);

                if (window.showLandmarks) {
                  marker.addTo(window.map);
                }
              });
            } catch (err) {
              console.error('Error adding landmark markers:', err);
            }
          }

          function toggleLandmarksLayer(show) {
            window.showLandmarks = show;
            if (!window.landmarkMarkers || !window.map) return;
            window.landmarkMarkers.forEach(marker => {
              if (show) {
                if (!window.map.hasLayer(marker)) marker.addTo(window.map);
              } else {
                if (window.map.hasLayer(marker)) window.map.removeLayer(marker);
              }
            });
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
              log('Rider marker added');
            } catch (error) {
              console.error('Error adding rider marker:', error);
            }
          }
          
          function addDeliveryMarkers() {
            try {
              window.deliveryMarkers = [];
              
              window.deliveries.forEach((delivery, index) => {
                if (!delivery.lat || !delivery.lng) {
                  log('Skipping delivery with missing coordinates:', delivery);
                  return;
                }
                
                const color = delivery.status === 'assigned' ? '#F59E0B' : 
                             (delivery.status === 'picked_up' || delivery.status === 'out_for_delivery') ? '#0033A0' : '#10B981';
                
                const deliveryIcon = L.divIcon({
                  html: \`
                    <div style="position: relative;">
                      <div class="delivery-pin-numbered" style="background: \${color};">
                        <span>\${delivery.displayIndex}</span>
                      </div>
                      <div class="delivery-label">
                        Order #\${delivery.title.split('#')[1] || delivery.displayIndex}
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
                  
                  log('Popup button clicked for delivery:', delivery.id);
                  
                  // Close the popup
                  marker.closePopup();

                  // Focus this delivery and draw only its route
                  focusSingleDelivery(delivery.id);
                  
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
                
                // Marker tap should only focus route.
                // Details are opened from active list or explicit "View Details" action.
                marker.on('click', function(e) {
                  log('Marker clicked:', delivery.id);

                  focusSingleDelivery(delivery.id);
                });
                
                window.deliveryMarkers.push({
                  marker: marker,
                  data: delivery
                });
              });
              
              log('Delivery markers added:', window.deliveryMarkers.length);
            } catch (error) {
              console.error('Error adding delivery markers:', error);
            }
          }

          function clearRouteLine() {
            if (window.routeLine && window.map) {
              window.map.removeLayer(window.routeLine);
              window.routeLine = null;
            }

            if (window.routeArrows?.length && window.map) {
              window.routeArrows.forEach((marker) => window.map.removeLayer(marker));
              window.routeArrows = [];
            }

            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'ROUTE_CLEARED'
              }));
            }
          }

          function focusSingleDelivery(deliveryId) {
            const focused = window.allDeliveries.filter((d) => d.id === deliveryId);
            if (focused.length === 0) {
              return;
            }

            window.deliveries = focused;
            window.routeMode = 'focused';
            addDeliveryMarkers();
            drawOptimizedRoute(true);
            window.fitAllMarkers();
          }
          
          function getDistanceMeters(a, b) {
            const toRad = (deg) => deg * Math.PI / 180;
            const earthRadius = 6371000;
            const dLat = toRad(b.lat - a.lat);
            const dLng = toRad(b.lng - a.lng);

            const h =
              Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);

            return 2 * earthRadius * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
          }

          function publishRouteMetrics(distanceMeters, durationSeconds, mode = 'focused') {
            if (!window.ReactNativeWebView) {
              return;
            }

            const distanceKm = distanceMeters / 1000;
            const etaMinutes = Math.max(1, Math.round(durationSeconds / 60));

            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'ROUTE_METRICS',
              mode,
              etaMinutes,
              distanceKm: Number(distanceKm.toFixed(2))
            }));
          }

          function estimateFallbackDurationSeconds(distanceMeters) {
            // Approximate urban rider speed ~24 kph
            const metersPerSecond = 24 / 3.6;
            return distanceMeters / metersPerSecond;
          }

          function getManeuverCount(route) {
            if (!route?.legs) {
              return 0;
            }

            return route.legs.reduce((count, leg) => count + (leg.steps?.length || 0), 0);
          }

          function pickBestRoute(routes) {
            if (!Array.isArray(routes) || routes.length === 0) {
              return null;
            }

            const minDistance = Math.min(...routes.map((r) => r.distance || Number.POSITIVE_INFINITY));

            let bestRoute = routes[0];
            let bestScore = Number.POSITIVE_INFINITY;

            routes.forEach((route) => {
              const duration = route.duration || Number.POSITIVE_INFINITY;
              const distance = route.distance || Number.POSITIVE_INFINITY;
              const maneuvers = getManeuverCount(route);

              // Prioritize fast routes, prefer closer routes, and lightly penalize too many turns.
              const distancePenalty = distance > minDistance * 1.15 ? (distance - minDistance) * 0.03 : 0;
              const score = duration + maneuvers * 8 + distancePenalty;

              if (score < bestScore) {
                bestScore = score;
                bestRoute = route;
              }
            });

            return bestRoute;
          }

          function drawFallbackRoute(waypoints) {
            if (window.routeMode !== 'focused') {
              clearRouteLine();
              return;
            }

            if (window.routeLine) {
              window.map.removeLayer(window.routeLine);
            }

            window.routeLine = L.polyline(waypoints, {
              color: '#0033A0',
              weight: 4,
              opacity: 0.6,
              dashArray: '8, 8',
              lineJoin: 'round'
            }).addTo(window.map);

            drawRouteArrows(waypoints);

            const fallbackDistance = waypoints.slice(1).reduce((sum, point, idx) => {
              const prev = waypoints[idx];
              return sum + getDistanceMeters(
                { lat: prev[0], lng: prev[1] },
                { lat: point[0], lng: point[1] }
              );
            }, 0);

            publishRouteMetrics(
              fallbackDistance,
              estimateFallbackDurationSeconds(fallbackDistance),
              'fallback'
            );
          }

          function getBearingDeg(fromPoint, toPoint) {
            if (!window.map) {
              return 0;
            }

            // Use projected map points so arrow rotation matches on-screen route direction.
            const from = window.map.latLngToLayerPoint([fromPoint[0], fromPoint[1]]);
            const to = window.map.latLngToLayerPoint([toPoint[0], toPoint[1]]);
            return Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI;
          }

          function drawRouteArrows(routePoints) {
            if (!window.map) {
              return;
            }

            if (window.routeArrows?.length) {
              window.routeArrows.forEach((marker) => window.map.removeLayer(marker));
            }
            window.routeArrows = [];

            if (!Array.isArray(routePoints) || routePoints.length < 3) {
              return;
            }

            const arrowStep = Math.max(10, Math.floor(routePoints.length / 10));

            for (let i = arrowStep; i < routePoints.length - 1; i += arrowStep) {
              const prev = routePoints[i - 1];
              const curr = routePoints[i];
              const next = routePoints[i + 1];
              const bearing = getBearingDeg(prev, next);

              const arrowIcon = L.divIcon({
                className: '',
                html:
                  '<div style="' +
                  'transform: rotate(' + bearing + 'deg);' +
                  'color:#0033A0;' +
                  'font-size:14px;' +
                  'font-weight:700;' +
                  'text-shadow:0 0 2px rgba(255,255,255,0.9);' +
                  '">➤</div>',
                iconSize: [14, 14],
                iconAnchor: [7, 7]
              });

              const arrowMarker = L.marker([curr[0], curr[1]], {
                icon: arrowIcon,
                interactive: false,
                keyboard: false,
                zIndexOffset: 500
              }).addTo(window.map);

              window.routeArrows.push(arrowMarker);
            }
          }

          async function drawOptimizedRoute(force = false) {
            try {
              if (window.routeMode !== 'focused') {
                clearRouteLine();
                return;
              }

              // Create waypoints: current location + all delivery locations
              const waypoints = [
                [window.currentLocation.lat, window.currentLocation.lng],
                ...window.deliveries.map(d => [d.lat, d.lng])
              ];

              if (waypoints.length < 2) {
                return;
              }

              const now = Date.now();
              const currentOrigin = {
                lat: window.currentLocation.lat,
                lng: window.currentLocation.lng
              };

              const movedDistance = window.lastRouteOrigin
                ? getDistanceMeters(window.lastRouteOrigin, currentOrigin)
                : Number.POSITIVE_INFINITY;

              const isTooSoon = (now - window.lastRerouteAt) < REROUTE_MIN_INTERVAL_MS;
              if (!force && isTooSoon && movedDistance < REROUTE_MIN_DISTANCE_METERS) {
                return;
              }

              const coordinateString = [
                window.currentLocation.lng + ',' + window.currentLocation.lat,
                ...window.deliveries.map((d) => d.lng + ',' + d.lat)
              ].join(';');

              const routeUrl = OSRM_BASE_URL + '/route/v1/driving/' + coordinateString + '?overview=full&geometries=geojson&continue_straight=true&alternatives=true&steps=true';
              const response = await fetch(routeUrl);
              if (!response.ok) {
                throw new Error('OSRM request failed with ' + response.status);
              }

              const routeResult = await response.json();
              const selectedRoute = pickBestRoute(routeResult?.routes || []);
              const routeCoordinates = selectedRoute?.geometry?.coordinates;

              if (!Array.isArray(routeCoordinates) || routeCoordinates.length === 0) {
                throw new Error('OSRM returned empty route geometry');
              }
              
              // Remove existing route line
              if (window.routeLine) {
                window.map.removeLayer(window.routeLine);
              }

              const snappedRoute = routeCoordinates.map(([lng, lat]) => [lat, lng]);
              let renderedRoute = snappedRoute;
              let initialStraightMeters = 0;
              let additionalStraightMeters = 0;

              // If snapped route starts near the rider, prepend a short straight
              // segment so the route visually starts exactly from rider position.
              if (snappedRoute.length > 1) {
                const routeStart = snappedRoute[0];
                const startDistance = getDistanceMeters(
                  { lat: window.currentLocation.lat, lng: window.currentLocation.lng },
                  { lat: routeStart[0], lng: routeStart[1] }
                );

                if (startDistance > 3 && startDistance <= START_STRAIGHT_MAX_METERS) {
                  renderedRoute = [
                    [window.currentLocation.lat, window.currentLocation.lng],
                    ...renderedRoute
                  ];
                  initialStraightMeters = startDistance;
                }
              }

              // If the snapped road endpoint is close to the order, extend with a short
              // straight segment so the line reaches the exact drop-off pin.
              const lastDelivery = window.deliveries[window.deliveries.length - 1];
              if (lastDelivery && renderedRoute.length > 1) {
                const routeEnd = renderedRoute[renderedRoute.length - 1];
                const endDistance = getDistanceMeters(
                  { lat: routeEnd[0], lng: routeEnd[1] },
                  { lat: lastDelivery.lat, lng: lastDelivery.lng }
                );

                if (endDistance > 3 && endDistance <= FINAL_STRAIGHT_MAX_METERS) {
                  renderedRoute = [
                    ...renderedRoute,
                    [lastDelivery.lat, lastDelivery.lng]
                  ];
                  additionalStraightMeters = endDistance;
                }
              }

              window.routeLine = L.polyline(renderedRoute, {
                color: '#0033A0',
                weight: 4,
                opacity: 0.6,
                dashArray: '8, 8',
                lineJoin: 'round'
              }).addTo(window.map);

              drawRouteArrows(renderedRoute);

              window.lastRouteOrigin = currentOrigin;
              window.lastRerouteAt = now;

              const baseDistance = selectedRoute?.distance || 0;
              const baseDuration = selectedRoute?.duration || 0;
              const connectorDistance = initialStraightMeters + additionalStraightMeters;
              const extraDuration = estimateFallbackDurationSeconds(connectorDistance);
              publishRouteMetrics(baseDistance + connectorDistance, baseDuration + extraDuration, 'focused');
              
              log('Road-snapped route line drawn');
            } catch (error) {
              console.warn('Road route unavailable, using fallback line:', error.message || error);

              // Create waypoints again for safe fallback
              const fallbackWaypoints = [
                [window.currentLocation.lat, window.currentLocation.lng],
                ...window.deliveries.map(d => [d.lat, d.lng])
              ];
              drawFallbackRoute(fallbackWaypoints);
            }
          }
          
          window.fitAllMarkers = function() {
            log('fitAllMarkers called');
            if (!window.map) {
              log('Map not initialized');
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
            
            log('Points to fit:', points.length);
            
            if (points.length > 0) {
              const bounds = L.latLngBounds(points);
              window.map.flyToBounds(bounds, {
                padding: [50, 50],
                duration: 1.5,
                maxZoom: 15
              });
              log('Fitting bounds:', points.length, 'points');
            } else {
              // If no points, just center on current location
              window.map.setView([window.currentLocation.lat, window.currentLocation.lng], 14);
            }
          };
          
          window.centerOnMe = function() {
            log('centerOnMe called');
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
              log('Message received in WebView:', data);
              
              if (data.type === 'UPDATE_LOCATION') {
                window.currentLocation = { lat: data.lat, lng: data.lon };
                
                if (window.riderMarker) {
                  window.riderMarker.setLatLng([data.lat, data.lon]);
                  
                  // Update route line
                  if (window.routeMode === 'focused' && window.deliveryMarkers.length > 0) {
                    drawOptimizedRoute(false);
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
              } else if (data.type === 'FOCUS_DELIVERY') {
                focusSingleDelivery(data.deliveryId);
              } else if (data.type === 'SHOW_ALL_DELIVERIES') {
                window.deliveries = window.allDeliveries.slice();
                window.routeMode = 'none';
                addDeliveryMarkers();
                clearRouteLine();
                window.fitAllMarkers();
              } else if (data.type === 'SET_MAP_LAYER') {
                switchTileLayer(data.layer);
              } else if (data.type === 'TOGGLE_LANDMARKS') {
                toggleLandmarksLayer(data.show);
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
    if (!profile?.id) {
      return;
    }

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
        // show active delivery states in rider map
        .in('status', ['assigned', 'accepted', 'picked_up', 'out_for_delivery']);

      if (error) throw error;
      
      devLog('Fetched deliveries:', data?.length || 0);
      // dump full rows so we can see if orders are being stripped by RLS
      devLog('raw deliveries data', JSON.stringify(data, null, 2));
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
      
      devLog('Current location:', latitude, longitude);
      
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

  // Initial load
  useEffect(() => {
    if (!profile?.id) {
      return;
    }

    const initialize = async () => {
      setLoading(true);
      await getCurrentLocation(true);
      await fetchActiveDeliveries();
      setTracking(true);
      setLoading(false);
    };

    initialize();

    // Set up real-time subscription for deliveries
    if (profile?.id) {
      const channel = supabase
        .channel(`rider-map-updates-${profile.id}`)
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
      // note: filter unchanged, but query above covers additional statuses

      return () => {
        channel.unsubscribe();

        if (trackingSubscriptionRef.current) {
          stopLocationTracking(trackingSubscriptionRef.current);
          trackingSubscriptionRef.current = null;
        }
      };
    }
  }, [profile?.id]);

  const handleWebViewMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      devLog('WebView message received:', data);
      
      if (data.type === 'DELIVERY_SELECTED') {
        const delivery = deliveries.find(d => d.id === data.deliveryId);
        devLog('Found delivery:', delivery);
        
        if (delivery) {
          setSelectedDelivery(delivery);
          setFocusedDeliveryId(delivery.id);
          setMapViewMode('focused');
          setShowDeliveryModal(true);
        } else {
          devLog('Delivery not found with ID:', data.deliveryId);
        }
      } else if (data.type === 'ROUTE_METRICS') {
        setRouteEtaMinutes(data.etaMinutes ?? null);
        setRouteDistanceKm(data.distanceKm ?? null);
      } else if (data.type === 'ROUTE_CLEARED') {
        setRouteEtaMinutes(null);
        setRouteDistanceKm(null);
      }
    } catch (error) {
      console.error('Error parsing WebView message:', error);
    }
  };

  const handleDeliveryPress = (delivery) => {
    setSelectedDelivery(delivery);
    setFocusedDeliveryId(delivery.id);
    setMapViewMode('focused');
    setShowDeliveryModal(true);

    if (webViewRef.current) {
      webViewRef.current.postMessage(JSON.stringify({
        type: 'FOCUS_DELIVERY',
        deliveryId: delivery.id,
      }));
    }
    
    // Center map on this delivery
    if (webViewRef.current && delivery.orders?.delivery_lat && delivery.orders?.delivery_lng) {
      webViewRef.current.postMessage(JSON.stringify({
        type: 'CENTER_ON_DELIVERY',
        lat: parseFloat(delivery.orders.delivery_lat),
        lng: parseFloat(delivery.orders.delivery_lng)
      }));
    }
  };

  const handleLayerChange = (layer) => {
    setMapLayer(layer);
    if (webViewRef.current) {
      webViewRef.current.postMessage(JSON.stringify({
        type: 'SET_MAP_LAYER',
        layer: layer
      }));
    }
  };

  const handleToggleLandmarks = () => {
    const next = !showLandmarks;
    setShowLandmarks(next);
    if (webViewRef.current) {
      webViewRef.current.postMessage(JSON.stringify({
        type: 'TOGGLE_LANDMARKS',
        show: next
      }));
    }
  };

  const openGoogleMaps = () => {
    const lat = selectedDelivery?.orders?.delivery_lat ?? selectedDelivery?.delivery_lat;
    const lng = selectedDelivery?.orders?.delivery_lng ?? selectedDelivery?.delivery_lng;
    if (!lat || !lng) {
      Alert.alert('Error', 'Delivery coordinates not available');
      return;
    }
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    Linking.openURL(url);
  };

  const openWaze = () => {
    const lat = selectedDelivery?.orders?.delivery_lat ?? selectedDelivery?.delivery_lat;
    const lng = selectedDelivery?.orders?.delivery_lng ?? selectedDelivery?.delivery_lng;
    if (!lat || !lng) {
      Alert.alert('Error', 'Delivery coordinates not available');
      return;
    }
    const url = `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
    Linking.openURL(url);
  };

  const callCustomer = () => {
    const phone = selectedDelivery?.orders?.customer_name?.phone_number;
    if (!phone) {
      Alert.alert('No Phone Number', 'Customer phone number is not available.');
      return;
    }
    Linking.openURL(`tel:${phone}`);
  };

  const openNavigation = () => {
    const lat = selectedDelivery?.orders?.delivery_lat ?? selectedDelivery?.delivery_lat;
    const lng = selectedDelivery?.orders?.delivery_lng ?? selectedDelivery?.delivery_lng;
    if (!lat || !lng) {
      Alert.alert('Error', 'Delivery coordinates not available');
      return;
    }

    const url = Platform.select({
      ios: `maps:${lat},${lng}`,
      android: `geo:${lat},${lng}?q=${lat},${lng}(${encodeURIComponent(selectedDelivery.orders?.delivery_address || 'Delivery')})`
    });
    
    Linking.openURL(url);
  };

  const viewDeliveryDetails = () => {
    setShowDeliveryModal(false);
    navigation.navigate('RiderDeliveryDetails', { delivery: selectedDelivery });
  };

  const fitAllMarkers = () => {
    devLog('fitAllMarkers called from React Native');
    if (webViewRef.current) {
      webViewRef.current.postMessage(JSON.stringify({
        type: 'FIT_ALL'
      }));
    } else {
      devLog('WebView ref not available');
    }
  };

  const refreshLocation = () => {
    getCurrentLocation(true);
  };

  const showAllDeliveriesOnMap = () => {
    setMapViewMode('all');
    setFocusedDeliveryId(null);
    setRouteEtaMinutes(null);
    setRouteDistanceKm(null);

    if (webViewRef.current) {
      webViewRef.current.postMessage(JSON.stringify({
        type: 'SHOW_ALL_DELIVERIES'
      }));
    }
  };

  const showFocusedDeliveryOnMap = () => {
    if (selectedDelivery?.id) {
      setFocusedDeliveryId(selectedDelivery.id);
      setMapViewMode('focused');

      if (webViewRef.current) {
        webViewRef.current.postMessage(JSON.stringify({
          type: 'FOCUS_DELIVERY',
          deliveryId: selectedDelivery.id,
        }));
      }
    }
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
        <Text style={styles.headerTitle}>Rider GPS Cockpit</Text>
        {/* tracking toggle button */}
        <TouchableOpacity
          onPress={() => setTracking(prev => !prev)}
          style={[styles.trackButton, { backgroundColor: tracking ? '#EF4444' : '#10B981' }]}
        >
          <Ionicons name={tracking ? 'pause' : 'play'} size={20} color="#fff" />
        </TouchableOpacity>
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
          onLoadStart={() => devLog('WebView loading started')}
          onLoad={() => devLog('WebView loaded')}
        />

        {/* Top Floating ETA Capsule */}
        {routeEtaMinutes !== null && (
          <View style={styles.topEtaBadge}>
            <Ionicons name="navigate-circle" size={18} color="#10B981" />
            <Text style={styles.topEtaText}>
              {routeEtaMinutes} min • {routeDistanceKm} km Live Route
            </Text>
          </View>
        )}

        {/* Top-Right HUD Layer Controls */}
        <View style={styles.hudOverlay}>
          <TouchableOpacity
            style={[styles.hudButton, mapLayer === 'satellite' && styles.hudButtonActive]}
            onPress={() => handleLayerChange(mapLayer === 'satellite' ? 'street' : 'satellite')}
          >
            <Ionicons name={mapLayer === 'satellite' ? 'earth' : 'map-outline'} size={16} color={mapLayer === 'satellite' ? '#fff' : '#0033A0'} />
            <Text style={[styles.hudButtonText, mapLayer === 'satellite' && styles.hudButtonTextActive]}>
              {mapLayer === 'satellite' ? 'Satellite' : 'Street'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.hudButton, mapLayer === 'dark' && styles.hudButtonActive]}
            onPress={() => handleLayerChange(mapLayer === 'dark' ? 'street' : 'dark')}
          >
            <Ionicons name={mapLayer === 'dark' ? 'moon' : 'sunny-outline'} size={16} color={mapLayer === 'dark' ? '#fff' : '#0033A0'} />
            <Text style={[styles.hudButtonText, mapLayer === 'dark' && styles.hudButtonTextActive]}>
              {mapLayer === 'dark' ? 'Night' : 'Day'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.hudButton, showLandmarks && styles.hudButtonActive]}
            onPress={handleToggleLandmarks}
          >
            <Ionicons name="flag" size={16} color={showLandmarks ? '#fff' : '#0033A0'} />
            <Text style={[styles.hudButtonText, showLandmarks && styles.hudButtonTextActive]}>
              Landmarks
            </Text>
          </TouchableOpacity>
        </View>

        {/* Floating Bottom-Right My Location FAB */}
        <TouchableOpacity
          style={styles.recenterFloatingBtn}
          onPress={refreshLocation}
        >
          <Ionicons name="locate" size={22} color="#0033A0" />
        </TouchableOpacity>
      </View>

      {/* Bottom Panel - Active Deliveries List */}
      <View style={[styles.bottomPanel, { paddingBottom: insets.bottom + 20, paddingTop: 12 }]}>
        <View style={styles.panelHeader}>
          <View>
            <Text style={styles.panelTitle}>
              Active Deliveries ({deliveries.length})
            </Text>
            {mapViewMode === 'focused' && routeEtaMinutes !== null && routeDistanceKm !== null && (
              <Text style={styles.routeMetaText}>
                ETA {routeEtaMinutes} min • {routeDistanceKm} km
              </Text>
            )}
          </View>
          <View style={styles.panelActions}>
            <View style={styles.modeSwitch}>
              <TouchableOpacity
                onPress={showAllDeliveriesOnMap}
                style={[
                  styles.modeButton,
                  mapViewMode === 'all' && styles.modeButtonActive
                ]}
              >
                <Text
                  style={[
                    styles.modeButtonText,
                    mapViewMode === 'all' && styles.modeButtonTextActive
                  ]}
                >
                  All
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={showFocusedDeliveryOnMap}
                disabled={!selectedDelivery?.id}
                style={[
                  styles.modeButton,
                  mapViewMode === 'focused' && styles.modeButtonActive,
                  !selectedDelivery?.id && styles.modeButtonDisabled
                ]}
              >
                <Text
                  style={[
                    styles.modeButtonText,
                    mapViewMode === 'focused' && styles.modeButtonTextActive,
                    !selectedDelivery?.id && styles.modeButtonTextDisabled
                  ]}
                >
                  Focus
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={refreshLocation} style={styles.locateButton}>
              <Ionicons name="locate" size={22} color="#0033A0" />
            </TouchableOpacity>
          </View>
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
                  { backgroundColor: delivery.status === 'assigned' ? '#F59E0B' : '#ED2939' }
                ]}>
                  <Text style={styles.chipNumberText}>{index + 1}</Text>
                </View>
                <View style={[
                  styles.chipStatus,
                  { backgroundColor: delivery.status === 'assigned' ? '#F59E0B' : '#ED2939' }
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
              <Text style={styles.modalTitle}>Delivery Navigation</Text>
              <TouchableOpacity onPress={() => setShowDeliveryModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {selectedDelivery && (
              <View style={styles.modalBody}>
                <View style={styles.modalStatus}>
                  <View style={[
                    styles.modalStatusBadge,
                    { backgroundColor: selectedDelivery.status === 'assigned' ? '#F59E0B' : '#ED2939' }
                  ]}>
                    <Text style={styles.modalStatusText}>
                      {selectedDelivery.status === 'assigned' ? 'Waiting for Acceptance' : 'Out for Delivery'}
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

                  {selectedDelivery.orders?.customer_name?.phone_number ? (
                    <TouchableOpacity style={styles.phoneTouchRow} onPress={callCustomer}>
                      <Ionicons name="call" size={18} color="#10B981" />
                      <Text style={styles.phoneText}>
                        {selectedDelivery.orders?.customer_name?.phone_number} (Tap to Call)
                      </Text>
                    </TouchableOpacity>
                  ) : null}

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

                {/* 1-Tap External GPS Launchers */}
                <View style={styles.launcherSection}>
                  <Text style={styles.launcherLabel}>Launch External GPS Navigation:</Text>
                  <View style={styles.launcherRow}>
                    <TouchableOpacity
                      style={[styles.launcherBtn, { backgroundColor: '#1A73E8' }]}
                      onPress={openGoogleMaps}
                    >
                      <Ionicons name="navigate" size={18} color="#fff" />
                      <Text style={styles.launcherBtnText}>Google Maps</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.launcherBtn, { backgroundColor: '#33CCFF' }]}
                      onPress={openWaze}
                    >
                      <Ionicons name="car" size={18} color="#fff" />
                      <Text style={styles.launcherBtnText}>Waze</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalActionButton, styles.detailsButton]}
                    onPress={viewDeliveryDetails}
                  >
                    <Ionicons name="document-text" size={20} color="#fff" />
                    <Text style={styles.modalActionText}>Full Details & POD</Text>
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
  trackButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0033A0',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  webview: {
    flex: 1,
  },
  topEtaBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    zIndex: 20,
  },
  topEtaText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
  },
  hudOverlay: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'column',
    gap: 6,
    zIndex: 20,
  },
  hudButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  hudButtonActive: {
    backgroundColor: '#0033A0',
  },
  hudButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0033A0',
  },
  hudButtonTextActive: {
    color: '#fff',
  },
  recenterFloatingBtn: {
    position: 'absolute',
    bottom: 16,
    right: 14,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    zIndex: 20,
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
  panelActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modeSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d8e1f2',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#f8fbff',
  },
  modeButton: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: 'transparent',
  },
  modeButtonActive: {
    backgroundColor: '#0033A0',
  },
  modeButtonDisabled: {
    opacity: 0.45,
  },
  modeButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#46608f',
  },
  modeButtonTextActive: {
    color: '#fff',
  },
  modeButtonTextDisabled: {
    color: '#8aa0c7',
  },
  panelTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  routeMetaText: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '600',
    color: '#0f4aa8',
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
    borderColor: '#ED2939',
    backgroundColor: '#fff5f5',
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
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalBody: {
    padding: 18,
  },
  modalStatus: {
    alignItems: 'center',
    marginBottom: 16,
  },
  modalStatusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  modalStatusText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  modalInfo: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  modalOrderNumber: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0033A0',
    marginBottom: 10,
  },
  phoneTouchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
    backgroundColor: '#ecfdf5',
    padding: 8,
    borderRadius: 8,
  },
  phoneText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#065f46',
  },
  modalInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 10,
  },
  modalInfoText: {
    flex: 1,
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
  },
  launcherSection: {
    marginBottom: 16,
  },
  launcherLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 8,
  },
  launcherRow: {
    flexDirection: 'row',
    gap: 10,
  },
  launcherBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  launcherBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  modalActions: {
    flexDirection: 'row',
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
  detailsButton: {
    backgroundColor: '#ED2939',
  },
  modalActionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});