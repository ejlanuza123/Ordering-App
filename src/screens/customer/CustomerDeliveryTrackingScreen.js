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
import { locationTrackingService } from '../../services/locationTrackingService';

const ROUTE_REFRESH_MIN_MS = 12000;

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

  const [loading, setLoading] = useState(true);
  const [riderLocation, setRiderLocation] = useState(null);
  const [etaMinutes, setEtaMinutes] = useState(null);
  const [distanceKm, setDistanceKm] = useState(null);
  const [isOnline, setIsOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState(null);

  const buildMapHtml = useCallback(() => {
    const destinationLat = destination?.lat ?? 9.7534772;
    const destinationLng = destination?.lng ?? 118.7478688;

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
          .dest-marker {
            width: 28px;
            height: 28px;
            border-radius: 50%;
            background: #ED2939;
            border: 3px solid #fff;
            box-shadow: 0 2px 8px rgba(0,0,0,0.35);
            display: flex;
            align-items: center;
            justify-content: center;
            color: #fff;
            font-weight: 700;
            font-size: 14px;
          }
          .rider-marker {
            width: 22px;
            height: 22px;
            border-radius: 50%;
            background: #0033A0;
            border: 3px solid #fff;
            box-shadow: 0 2px 8px rgba(0,0,0,0.35);
          }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          window.map = L.map('map', { zoomControl: false }).setView([${destinationLat}, ${destinationLng}], 14);
          window.routeLine = null;
          window.riderMarker = null;

          L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '©OpenStreetMap, ©CartoDB',
            subdomains: 'abcd',
            maxZoom: 19
          }).addTo(window.map);

          const destIcon = L.divIcon({
            className: '',
            html: '<div class="dest-marker">🏠</div>',
            iconSize: [28, 28],
            iconAnchor: [14, 14]
          });

          window.destinationMarker = L.marker([${destinationLat}, ${destinationLng}], { icon: destIcon }).addTo(window.map);

          function updateRider(lat, lng, shouldCenter) {
            if (!window.riderMarker) {
              const riderIcon = L.divIcon({
                className: '',
                html: '<div class="rider-marker"></div>',
                iconSize: [22, 22],
                iconAnchor: [11, 11]
              });
              window.riderMarker = L.marker([lat, lng], { icon: riderIcon }).addTo(window.map);
            } else {
              window.riderMarker.setLatLng([lat, lng]);
            }

            if (shouldCenter) {
              const bounds = L.latLngBounds([
                [lat, lng],
                [${destinationLat}, ${destinationLng}]
              ]);
              window.map.flyToBounds(bounds, { padding: [50, 50], duration: 1.2, maxZoom: 16 });
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
              opacity: 0.7,
              dashArray: '8, 8',
              lineJoin: 'round'
            }).addTo(window.map);
          }

          window.addEventListener('message', function(event) {
            try {
              const data = JSON.parse(event.data);
              if (data.type === 'UPDATE_RIDER') {
                updateRider(data.lat, data.lng, !!data.shouldCenter);
              } else if (data.type === 'UPDATE_ROUTE') {
                updateRoute(data.geometry || []);
              }
            } catch (error) {
              console.error('Map message parsing error', error);
            }
          });
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
      sendRouteToMap(routeResult.geometry);
    }
  }, [destination, sendRouteToMap]);

  useEffect(() => {
    if (!riderId) return;

    const unsubscribe = locationTrackingService.subscribeToRiderLocation(riderId, async (loc) => {
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
  }, [riderId, sendRiderToMap, updateEtaAndRoute]);

  const handleCallRider = () => {
    if (!riderPhone) return;
    const url = Platform.select({ ios: `telprompt:${riderPhone}`, android: `tel:${riderPhone}` });
    Linking.openURL(url);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#0033A0" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Track Delivery</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.orderText}>{orderNumber || `Order #${orderId || '-'}`}</Text>
        <Text style={styles.riderText}>{riderName || 'Assigned Rider'}</Text>
        <Text style={styles.metaText} numberOfLines={1}>{deliveryAddress || 'Delivery destination'}</Text>

        <View style={styles.metricsRow}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>ETA</Text>
            <Text style={styles.metricValue}>{etaMinutes !== null ? `${etaMinutes} min` : 'Calculating...'}</Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Distance</Text>
            <Text style={styles.metricValue}>{distanceKm !== null ? `${distanceKm} km` : '--'}</Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Status</Text>
            <Text style={[styles.metricValue, { color: isOnline ? '#10B981' : '#F59E0B' }]}>
              {isOnline ? 'Online' : 'Offline'}
            </Text>
          </View>
        </View>

        {!!riderPhone && (
          <TouchableOpacity style={styles.callButton} onPress={handleCallRider}>
            <Ionicons name="call" size={18} color="#fff" />
            <Text style={styles.callButtonText}>Call Rider</Text>
          </TouchableOpacity>
        )}

        {lastSeen && (
          <Text style={styles.lastSeenText}>Last update: {new Date(lastSeen).toLocaleTimeString()}</Text>
        )}
      </View>

      <View style={styles.mapContainer}>
        <WebView
          ref={webViewRef}
          source={{ html: buildMapHtml() }}
          onLoadEnd={() => setLoading(false)}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          style={styles.webview}
        />
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#0033A0" />
            <Text style={styles.loadingText}>Loading tracking map...</Text>
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
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0033A0' },
  headerSpacer: { width: 40 },
  infoCard: {
    margin: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  orderText: { fontSize: 15, fontWeight: '700', color: '#333' },
  riderText: { marginTop: 3, fontSize: 14, fontWeight: '600', color: '#0033A0' },
  metaText: { marginTop: 4, fontSize: 12, color: '#666' },
  metricsRow: { marginTop: 10, flexDirection: 'row', justifyContent: 'space-between' },
  metricItem: { flex: 1 },
  metricLabel: { fontSize: 11, color: '#777', marginBottom: 2 },
  metricValue: { fontSize: 14, fontWeight: '700', color: '#333' },
  callButton: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#0033A0',
    borderRadius: 10,
    paddingVertical: 10,
  },
  callButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  lastSeenText: { marginTop: 8, fontSize: 11, color: '#888' },
  mapContainer: {
    flex: 1,
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  webview: { flex: 1 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  loadingText: { marginTop: 8, color: '#333', fontSize: 13 },
});
