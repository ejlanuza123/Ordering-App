import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { locationTrackingService } from '../../services/locationTrackingService';
import { networkStateService } from '../../services/networkStateService';
import { chatService } from '../../services/chatService';
import { useAuth } from '../../context/AuthContext';
import OrderDeliveryTimeline from '../../components/OrderDeliveryTimeline';
import { PUERTO_PRINCESA_LANDMARKS, detectNearestLandmark } from '../../utils/location';
import { getStoreToCustomerFallback } from '../../utils/riderLocation';

const ROUTE_REFRESH_MIN_MS = 10000;

export default function CustomerDeliveryTrackingScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const webViewRef = useRef(null);
  const lastRouteCalcRef = useRef(0);
  const hasCenteredRef = useRef(false);

  const {
    orderId,
    orderNumber,
    riderId,
    riderName,
    riderPhone,
    deliveryAddress,
    deliveryLat,
    deliveryLng,
  } = route.params || {};

  const destination = useMemo(() => {
    const lat = Number(deliveryLat);
    const lng = Number(deliveryLng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return null;
    }
    return { lat, lng };
  }, [deliveryLat, deliveryLng]);

  const [currentStatus, setCurrentStatus] = useState(route.params?.status || 'In Transit');
  const [activeRiderId, setActiveRiderId] = useState(riderId || null);
  const [activeRiderName, setActiveRiderName] = useState(riderName || null);
  const [activeRiderPhone, setActiveRiderPhone] = useState(riderPhone || null);
  const [loading, setLoading] = useState(!!riderId);
  const [riderLocation, setRiderLocation] = useState(null);
  const [etaMinutes, setEtaMinutes] = useState(null);
  const [distanceKm, setDistanceKm] = useState(null);
  const [isLiveRoute, setIsLiveRoute] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState(null);
  const [mapLayer, setMapLayer] = useState('street'); // 'street' | 'satellite' | 'dark'
  const [showLandmarks, setShowLandmarks] = useState(true);

  // Compute static store-to-customer distance and ETA fallback
  const fallbackEta = useMemo(() => {
    return getStoreToCustomerFallback({
      destinationLat: destination?.lat,
      destinationLng: destination?.lng,
      addressText: deliveryAddress || '',
    });
  }, [destination, deliveryAddress]);

  // Compute nearest landmark waypoint to rider's current position
  const nearestLandmark = useMemo(() => {
    if (!riderLocation?.lat || !riderLocation?.lng) return null;
    return detectNearestLandmark(riderLocation.lat, riderLocation.lng);
  }, [riderLocation]);

  const buildMapHtml = useCallback(() => {
    const destinationLat = destination?.lat ?? 9.7534772;
    const destinationLng = destination?.lng ?? 118.7478688;
    const landmarksJson = JSON.stringify(PUERTO_PRINCESA_LANDMARKS || []);

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          #map { width: 100vw; height: 100vh; }
          
          /* Destination Marker */
          .dest-marker {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: #ED2939;
            border: 3px solid #fff;
            box-shadow: 0 3px 10px rgba(0,0,0,0.4);
            display: flex;
            align-items: center;
            justify-content: center;
            color: #fff;
            font-size: 16px;
          }
          
          /* Motorcycle Glider Marker */
          .motorcycle-glider-wrap {
            position: relative;
            width: 44px;
            height: 44px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.6s ease-out;
          }
          
          .sonar-ring {
            position: absolute;
            width: 44px;
            height: 44px;
            border-radius: 50%;
            background: rgba(0, 51, 160, 0.25);
            animation: pulse-sonar 2s infinite ease-out;
          }
          
          @keyframes pulse-sonar {
            0% { transform: scale(0.6); opacity: 0.9; }
            100% { transform: scale(1.6); opacity: 0; }
          }
          
          .motorcycle-glider-icon {
            width: 34px;
            height: 34px;
            border-radius: 50%;
            background: #0033A0;
            border: 3px solid #fff;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(0, 51, 160, 0.45);
            font-size: 17px;
            z-index: 2;
          }

          /* Landmark badges */
          .landmark-badge {
            background: rgba(255, 255, 255, 0.92);
            color: #1e293b;
            font-size: 9px;
            font-weight: 700;
            padding: 2px 7px;
            border-radius: 12px;
            border: 1px solid #cbd5e1;
            box-shadow: 0 2px 5px rgba(0,0,0,0.15);
            white-space: nowrap;
            display: inline-flex;
            align-items: center;
            gap: 3px;
          }
          .landmark-marker-wrap {
            background: transparent;
            border: none;
          }

          .attribution {
            position: absolute;
            bottom: 5px;
            right: 5px;
            background: rgba(255,255,255,0.85);
            padding: 3px 6px;
            border-radius: 10px;
            font-size: 9px;
            z-index: 1000;
          }

          /* Enhanced High-Visibility Navigation Night Map */
          .dark-tiles {
            filter: brightness(0.6) invert(1) contrast(3) hue-rotate(200deg) saturate(0.3) brightness(0.7) !important;
          }
          .dark-mode-active #map {
            background: #0f172a;
          }
          .dark-mode-active .dest-marker {
            box-shadow: 0 0 16px rgba(237, 41, 57, 0.8), 0 3px 10px rgba(0,0,0,0.6);
            border-color: #fecaca;
          }
          .dark-mode-active .motorcycle-glider-icon {
            box-shadow: 0 0 16px rgba(59, 130, 246, 0.9), 0 4px 14px rgba(0, 51, 160, 0.6);
            border-color: #93c5fd;
          }
          .dark-mode-active .sonar-ring {
            background: rgba(59, 130, 246, 0.4);
          }
          .dark-mode-active .landmark-badge {
            background: rgba(30, 41, 59, 0.95);
            color: #f8fafc;
            border: 1px solid #475569;
            box-shadow: 0 3px 8px rgba(0,0,0,0.5);
          }
          .dark-mode-active .attribution {
            background: rgba(15, 23, 42, 0.85);
            color: #94a3b8;
          }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <div class="attribution">© OpenStreetMap, © Esri</div>

        <script>
          window.map = L.map('map', { zoomControl: false }).setView([${destinationLat}, ${destinationLng}], 14);
          window.routeLine = null;
          window.riderMarker = null;
          window.landmarkMarkers = [];
          window.currentRiderPos = null;

          // Tile Layer Definitions
          window.tileLayers = {
            street: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
              attribution: '&copy; OpenStreetMap contributors',
              maxZoom: 19
            }),
            satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
              attribution: '&copy; Esri',
              maxZoom: 19
            }),
            dark: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
              attribution: '&copy; OpenStreetMap contributors',
              className: 'dark-tiles',
              maxZoom: 19
            })
          };

          window.activeLayer = window.tileLayers.street;
          window.activeLayer.addTo(window.map);

          // Destination Pin
          const destIcon = L.divIcon({
            className: '',
            html: '<div class="dest-marker">🏠</div>',
            iconSize: [32, 32],
            iconAnchor: [16, 16]
          });
          window.destinationMarker = L.marker([${destinationLat}, ${destinationLng}], { icon: destIcon }).addTo(window.map);

          // Landmarks Overlay
          const landmarksData = ${landmarksJson};
          function initLandmarks() {
            landmarksData.forEach(function(lm) {
              if (!lm.lat || !lm.lng) return;
              let catEmoji = '📍';
              if (lm.category === 'Mall') catEmoji = '🛍️';
              else if (lm.category === 'Park' || lm.category === 'Park / Waterfront') catEmoji = '🌴';
              else if (lm.category === 'Airport') catEmoji = '✈️';
              else if (lm.category === 'Government') catEmoji = '🏛️';
              else if (lm.category === 'Hospital') catEmoji = '🏥';
              else if (lm.category === 'Market' || lm.category === 'Market / Terminal') catEmoji = '🛒';
              else if (lm.category === 'Coliseum / Arena') catEmoji = '🏟️';

              const lmIcon = L.divIcon({
                className: 'landmark-marker-wrap',
                html: '<div class="landmark-badge">' + catEmoji + ' ' + lm.name + '</div>',
                iconAnchor: [40, 10]
              });

              const marker = L.marker([lm.lat, lm.lng], { icon: lmIcon });
              window.landmarkMarkers.push(marker);
              marker.addTo(window.map);
            });
          }
          initLandmarks();

          function updateRider(lat, lng, shouldCenter) {
            window.currentRiderPos = [lat, lng];

            if (!window.riderMarker) {
              const riderIcon = L.divIcon({
                className: '',
                html: '<div class="motorcycle-glider-wrap"><div class="sonar-ring"></div><div class="motorcycle-glider-icon">🛵</div></div>',
                iconSize: [44, 44],
                iconAnchor: [22, 22]
              });
              window.riderMarker = L.marker([lat, lng], { icon: riderIcon }).addTo(window.map);
            } else {
              window.riderMarker.setLatLng([lat, lng]);
            }

            if (shouldCenter) {
              fitBounds();
            }
          }

          function fitBounds() {
            if (window.currentRiderPos) {
              const bounds = L.latLngBounds([
                window.currentRiderPos,
                [${destinationLat}, ${destinationLng}]
              ]);
              window.map.flyToBounds(bounds, { padding: [55, 55], duration: 1.2, maxZoom: 16 });
            } else {
              window.map.flyTo([${destinationLat}, ${destinationLng}], 15, { duration: 1.2 });
            }
          }

          function updateRoute(routeCoords) {
            if (window.routeLine) {
              window.map.removeLayer(window.routeLine);
              window.routeLine = null;
            }

            if (!Array.isArray(routeCoords) || routeCoords.length === 0) {
              return;
            }

            const latLngRoute = routeCoords.map(function (pair) {
              return [pair[1], pair[0]];
            });

            window.routeLine = L.polyline(latLngRoute, {
              color: '#0033A0',
              weight: 5,
              opacity: 0.8,
              dashArray: '8, 8',
              lineJoin: 'round'
            }).addTo(window.map);
          }

          function setMapLayer(layerName) {
            if (!window.tileLayers || !window.tileLayers[layerName]) return;
            if (window.activeLayer && window.map.hasLayer(window.activeLayer)) {
              window.map.removeLayer(window.activeLayer);
            }
            window.activeLayer = window.tileLayers[layerName];
            window.activeLayer.addTo(window.map);
            if (layerName === 'dark') {
              document.body.classList.add('dark-mode-active');
            } else {
              document.body.classList.remove('dark-mode-active');
            }
            if (window.routeLine) {
              window.routeLine.bringToFront();
            }
          }

          function toggleLandmarks(show) {
            if (!window.landmarkMarkers) return;
            window.landmarkMarkers.forEach(function(m) {
              if (show) {
                if (!window.map.hasLayer(m)) window.map.addLayer(m);
              } else {
                if (window.map.hasLayer(m)) window.map.removeLayer(m);
              }
            });
          }

          function handleIncomingMapMessage(event) {
            try {
              var data = event.data;
              if (typeof data === 'string') {
                try {
                  data = JSON.parse(data);
                } catch (e) {
                  return;
                }
              }
              if (!data || typeof data !== 'object') return;

              if (data.type === 'UPDATE_RIDER') {
                updateRider(data.lat, data.lng, !!data.shouldCenter);
              } else if (data.type === 'UPDATE_ROUTE') {
                updateRoute(data.geometry || []);
              } else if (data.type === 'FIT_BOUNDS') {
                fitBounds();
              } else if (data.type === 'SET_MAP_LAYER') {
                setMapLayer(data.layer);
              } else if (data.type === 'TOGGLE_LANDMARKS') {
                toggleLandmarks(data.show);
              }
            } catch (error) {
              console.error('Map message parsing error', error);
            }
          }

          window.addEventListener('message', handleIncomingMapMessage);
          document.addEventListener('message', handleIncomingMapMessage);
        </script>
      </body>
      </html>
    `;
  }, [destination]);

  const sendRiderToMap = useCallback((lat, lng, shouldCenter = false) => {
    if (!webViewRef.current) return;
    webViewRef.current.postMessage(JSON.stringify({
      type: 'UPDATE_RIDER',
      lat,
      lng,
      shouldCenter,
    }));
  }, []);

  const sendRouteToMap = useCallback((geometry) => {
    if (!webViewRef.current) return;
    webViewRef.current.postMessage(JSON.stringify({
      type: 'UPDATE_ROUTE',
      geometry: geometry || [],
    }));
  }, []);

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

  const handleFitBounds = () => {
    if (webViewRef.current) {
      webViewRef.current.postMessage(JSON.stringify({
        type: 'FIT_BOUNDS'
      }));
    }
  };

  const updateEtaAndRoute = useCallback(async (lat, lng) => {
    if (!destination) return;

    const now = Date.now();
    if (now - lastRouteCalcRef.current < ROUTE_REFRESH_MIN_MS) {
      return;
    }
    lastRouteCalcRef.current = now;

    const routeResult = await locationTrackingService.getDeliveryRoute(
      { latitude: lat, longitude: lng },
      { latitude: destination.lat, longitude: destination.lng }
    );

    if (routeResult.success) {
      setEtaMinutes(Math.max(1, Math.round(routeResult.duration)));
      setDistanceKm(Number(routeResult.distance.toFixed(2)));
      setIsLiveRoute(true);
      sendRouteToMap(routeResult.geometry);
    }
  }, [destination, sendRouteToMap]);

  const fetchLiveOrderData = useCallback(async () => {
    if (!orderId) return;
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          status,
          deliveries (
            id,
            status,
            rider_id,
            rider:profiles!deliveries_rider_id_fkey (
              id,
              full_name,
              phone_number,
              avatar_url
            )
          )
        `)
        .eq('id', orderId)
        .single();

      if (!error && data) {
        const orderStatus = (data.status || '').toLowerCase();
        const deliveryStatus = (data.deliveries?.[0]?.status || '').toLowerCase();

        let effective = 'In Transit';
        if (orderStatus === 'cancelled' || deliveryStatus === 'cancelled' || deliveryStatus === 'failed') {
          effective = 'Cancelled';
        } else if (orderStatus === 'completed' || orderStatus === 'delivered' || deliveryStatus === 'delivered') {
          effective = 'Delivered';
        } else if (deliveryStatus === 'out_for_delivery' || orderStatus === 'out for delivery' || orderStatus === 'delivering') {
          effective = 'In Transit';
        } else if (deliveryStatus === 'picked_up' || orderStatus === 'processing' || orderStatus === 'preparing' || orderStatus === 'rider picked up the order') {
          effective = 'Preparing';
        } else if (deliveryStatus === 'assigned' || deliveryStatus === 'accepted' || orderStatus === 'confirmed') {
          effective = 'Confirmed';
        } else {
          effective = 'Placed';
        }

        setCurrentStatus(effective);
        const d = data.deliveries?.[0];
        if (d?.rider) {
          setActiveRiderId(d.rider.id);
          setActiveRiderName(d.rider.full_name);
          setActiveRiderPhone(d.rider.phone_number);
        }
      }
    } catch (err) {
      console.error('Error fetching live order data in tracking:', err);
    }
  }, [orderId]);

  useEffect(() => {
    if (!orderId) return;

    fetchLiveOrderData();

    const channelName = `customer-live-tracking-${orderId}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
        () => {
          fetchLiveOrderData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'deliveries', filter: `order_id=eq.${orderId}` },
        () => {
          fetchLiveOrderData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId, fetchLiveOrderData]);

  useEffect(() => {
    if (!activeRiderId) return;

    const unsubscribe = locationTrackingService.subscribeToRiderLocation(activeRiderId, async (loc) => {
      if (!loc?.latitude || !loc?.longitude) return;

      setRiderLocation({ lat: loc.latitude, lng: loc.longitude });
      setIsOnline(!!loc.isOnline);
      setLastSeen(loc.lastSeen || null);

      sendRiderToMap(loc.latitude, loc.longitude, !hasCenteredRef.current);
      hasCenteredRef.current = true;
      await updateEtaAndRoute(loc.latitude, loc.longitude);
    });

    return () => {
      unsubscribe?.();
    };
  }, [activeRiderId, sendRiderToMap, updateEtaAndRoute]);

  useEffect(() => {
    const unsubscribe = networkStateService.subscribe(({ isOnline, wasOffline }) => {
      if (isOnline && wasOffline) {
        fetchLiveOrderData();
        if (activeRiderId) {
          locationTrackingService.getRiderLocation(activeRiderId).then((loc) => {
            if (loc?.latitude && loc?.longitude) {
              setRiderLocation({ lat: loc.latitude, lng: loc.longitude });
              setIsOnline(!!loc.isOnline);
              setLastSeen(loc.lastSeen || null);
              sendRiderToMap(loc.latitude, loc.longitude, false);
            }
          }).catch((e) => console.warn('Failed to refresh rider location on reconnect:', e));
        }
      }
    });

    return () => unsubscribe();
  }, [fetchLiveOrderData, activeRiderId, sendRiderToMap]);

  const { user } = useAuth();
  const [openingChat, setOpeningChat] = useState(false);

  const handleCallRider = () => {
    if (!activeRiderPhone) return;
    const url = Platform.select({ ios: `telprompt:${activeRiderPhone}`, android: `tel:${activeRiderPhone}` });
    Linking.openURL(url);
  };

  const handleChatRider = async () => {
    if (!orderId || !activeRiderId || !user?.id) return;
    setOpeningChat(true);
    try {
      const result = await chatService.getOrCreateOrderConversation(orderId, user.id, activeRiderId);
      if (result.success && result.conversation?.id) {
        navigation.navigate('ChatThread', { conversationId: result.conversation.id });
      }
    } catch (err) {
      console.error('Error opening chat:', err);
    } finally {
      setOpeningChat(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#0033A0" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Live Delivery Tracking</Text>
        <TouchableOpacity onPress={handleFitBounds} style={styles.fitHeaderBtn}>
          <Ionicons name="expand" size={20} color="#0033A0" />
        </TouchableOpacity>
      </View>

      {/* Info & Status Timeline Card */}
      <View style={styles.infoCard}>
        <View style={styles.infoHeadRow}>
          <Text style={styles.orderText}>{orderNumber || `Order #${orderId || '-'}`}</Text>
          <View style={[styles.onlineBadge, { backgroundColor: activeRiderId ? (isOnline ? '#10B98120' : '#F59E0B20') : '#0033A015' }]}>
            <View style={[styles.onlineDot, { backgroundColor: activeRiderId ? (isOnline ? '#10B981' : '#F59E0B') : '#0033A0' }]} />
            <Text style={[styles.onlineBadgeText, { color: activeRiderId ? (isOnline ? '#065F46' : '#92400E') : '#0033A0' }]}>
              {activeRiderId ? (isOnline ? 'Rider Online' : 'Rider Offline') : 'Order Active'}
            </Text>
          </View>
        </View>

        <Text style={styles.riderText}>🏍️ {activeRiderName || 'Awaiting Rider Assignment'}</Text>
        <Text style={styles.metaText} numberOfLines={1}>📍 {deliveryAddress || 'Delivery destination'}</Text>

        {/* 5-Step Order Status Progress Timeline */}
        <OrderDeliveryTimeline
          status={currentStatus}
          isRiderOnline={isOnline}
          etaMinutes={etaMinutes ?? fallbackEta.etaMinutes}
          distanceKm={distanceKm ?? fallbackEta.distanceKm}
        />

        <View style={styles.metricsRow}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>ESTIMATED ARRIVAL</Text>
            <Text style={styles.metricValue}>
              {etaMinutes !== null
                ? `${etaMinutes} mins${isLiveRoute ? '' : ' (Est.)'}`
                : `${fallbackEta.etaMinutes} mins (Est.)`}
            </Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>DISTANCE</Text>
            <Text style={styles.metricValue}>
              {distanceKm !== null
                ? `${distanceKm} km`
                : `${fallbackEta.distanceKm} km`}
            </Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>WAYPOINT</Text>
            <Text style={styles.metricValue} numberOfLines={1}>
              {nearestLandmark ? nearestLandmark.name : (isLiveRoute ? 'En Route' : 'Store Dispatch')}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
          {!!activeRiderPhone && (
            <TouchableOpacity style={[styles.actionBtn, styles.callBtn]} onPress={handleCallRider}>
              <Ionicons name="call" size={18} color="#fff" />
              <Text style={styles.actionBtnText}>Call Rider</Text>
            </TouchableOpacity>
          )}

          {!!activeRiderId && (
            <TouchableOpacity 
              style={[styles.actionBtn, styles.chatBtn]} 
              onPress={handleChatRider}
              disabled={openingChat}
            >
              <Ionicons name={openingChat ? "hourglass" : "chatbubbles"} size={18} color="#fff" />
              <Text style={styles.actionBtnText}>{openingChat ? 'Opening...' : 'Chat Rider'}</Text>
            </TouchableOpacity>
          )}
        </View>

        {lastSeen && (
          <Text style={styles.lastSeenText}>GPS synchronized: {new Date(lastSeen).toLocaleTimeString()}</Text>
        )}
      </View>

      {/* Map View */}
      <View style={styles.mapContainer}>
        <WebView
          ref={webViewRef}
          source={{ html: buildMapHtml() }}
          onLoadEnd={() => setLoading(false)}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          style={styles.webview}
        />

        {/* Top Floating Live Route HUD */}
        {etaMinutes !== null && (
          <View style={styles.topHudBadge}>
            <Ionicons name="bicycle" size={18} color="#10B981" />
            <Text style={styles.topHudText}>
              {etaMinutes} min • {distanceKm} km away {nearestLandmark ? `(near ${nearestLandmark.name})` : ''}
            </Text>
          </View>
        )}

        {/* Top-Right HUD Layer Controls */}
        <View style={styles.hudOverlay}>
          <TouchableOpacity
            style={[styles.hudButton, mapLayer === 'street' && styles.hudButtonActive]}
            onPress={() => handleLayerChange('street')}
          >
            <Ionicons name="map" size={14} color={mapLayer === 'street' ? '#fff' : '#0033A0'} />
            <Text style={[styles.hudButtonText, mapLayer === 'street' && styles.hudButtonTextActive]}>
              Street
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.hudButton, mapLayer === 'satellite' && styles.hudButtonActive]}
            onPress={() => handleLayerChange('satellite')}
          >
            <Ionicons name="earth" size={14} color={mapLayer === 'satellite' ? '#fff' : '#0033A0'} />
            <Text style={[styles.hudButtonText, mapLayer === 'satellite' && styles.hudButtonTextActive]}>
              Satellite
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.hudButton, mapLayer === 'dark' && styles.hudButtonActive]}
            onPress={() => handleLayerChange('dark')}
          >
            <Ionicons name="moon" size={14} color={mapLayer === 'dark' ? '#fff' : '#0033A0'} />
            <Text style={[styles.hudButtonText, mapLayer === 'dark' && styles.hudButtonTextActive]}>
              Night
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.hudButton, showLandmarks && styles.hudButtonActive]}
            onPress={handleToggleLandmarks}
          >
            <Ionicons name="flag" size={14} color={showLandmarks ? '#fff' : '#0033A0'} />
            <Text style={[styles.hudButtonText, showLandmarks && styles.hudButtonTextActive]}>
              Landmarks
            </Text>
          </TouchableOpacity>
        </View>

        {/* Floating Bottom-Right Recenter FAB */}
        <TouchableOpacity style={styles.recenterFab} onPress={handleFitBounds}>
          <Ionicons name="locate" size={22} color="#0033A0" />
        </TouchableOpacity>

        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#0033A0" />
            <Text style={styles.loadingText}>Connecting to rider live GPS...</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: {
    height: 60,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f4ff',
  },
  fitHeaderBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f4ff',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0033A0' },
  infoCard: {
    margin: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e9ecef',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
  },
  infoHeadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderText: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 5,
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  onlineBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  riderText: { marginTop: 4, fontSize: 14, fontWeight: '700', color: '#0033A0' },
  metaText: { marginTop: 4, fontSize: 12, color: '#64748b' },
  metricsRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  metricItem: { flex: 1 },
  metricLabel: { fontSize: 10, fontWeight: '700', color: '#94a3b8', marginBottom: 2 },
  metricValue: { fontSize: 13, fontWeight: '700', color: '#1e293b' },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
    paddingVertical: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  callBtn: {
    backgroundColor: '#ED2939',
  },
  chatBtn: {
    backgroundColor: '#0033A0',
  },
  actionBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  lastSeenText: { marginTop: 8, fontSize: 10, color: '#94a3b8', textAlign: 'center' },
  mapContainer: {
    flex: 1,
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    position: 'relative',
  },
  webview: { flex: 1 },
  topHudBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 110,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 18,
    gap: 6,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    zIndex: 20,
  },
  topHudText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e293b',
    flexShrink: 1,
  },
  hudOverlay: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'column',
    gap: 5,
    zIndex: 20,
  },
  hudButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 14,
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
    fontSize: 10,
    fontWeight: '600',
    color: '#0033A0',
  },
  hudButtonTextActive: {
    color: '#fff',
  },
  recenterFab: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    zIndex: 20,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  loadingText: { marginTop: 8, color: '#333', fontSize: 13 },
});
