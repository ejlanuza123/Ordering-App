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
  Modal
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

  // Petron San Pedro Station coordinates (default)
  const SAN_PEDRO_COORDS = {
    lat: 9.7534772,
    lng: 118.7478688
  };

  // Generate map HTML with all delivery markers
  useEffect(() => {
    generateMapHtml();
  }, [deliveries, currentLocation]);

  const generateMapHtml = () => {
    // Create markers array from deliveries
    const markers = deliveries
      .filter(d => d.orders?.delivery_lat && d.orders?.delivery_lng)
      .map(d => ({
        id: d.id,
        lat: d.orders.delivery_lat,
        lng: d.orders.delivery_lng,
        title: `Order #${d.orders.order_number || d.order_id}`,
        description: d.orders.customer_name?.full_name || 'Customer',
        status: d.status,
        address: d.orders.delivery_address
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
          
          /* Custom marker styles */
          .rider-marker {
            background: #0033A0;
            border: 3px solid white;
            border-radius: 50%;
            width: 20px;
            height: 20px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
          }
          
          .delivery-marker-assigned {
            background: #F59E0B;
            border: 3px solid white;
            border-radius: 50%;
            width: 20px;
            height: 20px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
          }
          
          .delivery-marker-picked {
            background: #0033A0;
            border: 3px solid white;
            border-radius: 50%;
            width: 20px;
            height: 20px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
          }
          
          .delivery-marker-completed {
            background: #10B981;
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
            border-radius: 8px;
            padding: 10px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            color: #0033A0;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
          }
          
          .control-button:hover {
            background: #f0f4ff;
          }
          
          .delivery-popup {
            min-width: 200px;
          }
          
          .popup-title {
            font-weight: bold;
            color: #333;
            margin-bottom: 4px;
          }
          
          .popup-address {
            font-size: 12px;
            color: #666;
            margin-bottom: 8px;
          }
          
          .popup-button {
            background: #0033A0;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 6px 12px;
            font-size: 12px;
            cursor: pointer;
            width: 100%;
          }
          
          .popup-button:hover {
            opacity: 0.9;
          }
        </style>
      </head>
      <body>
        <div class="controls">
          <button class="control-button" onclick="fitAllMarkers()">
            <span>📍</span> Fit All
          </button>
          <button class="control-button" onclick="centerOnMe()">
            <span>🎯</span> My Location
          </button>
        </div>
        
        <div id="map"></div>
        <div class="attribution">© OpenStreetMap contributors</div>
        
        <script>
          let map;
          let riderMarker;
          let deliveryMarkers = [];
          let currentLocation = { lat: ${currentLoc.lat}, lng: ${currentLoc.lng} };
          
          // Delivery markers data
          const deliveries = ${JSON.stringify(markers)};
          
          function initMap() {
            map = L.map('map').setView([currentLocation.lat, currentLocation.lng], 14);
            
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
              attribution: '© OpenStreetMap contributors'
            }).addTo(map);
            
            // Add rider marker
            const riderIcon = L.divIcon({
              className: 'rider-marker',
              iconSize: [20, 20],
              popupAnchor: [0, -10]
            });
            
            riderMarker = L.marker([currentLocation.lat, currentLocation.lng], {
              icon: riderIcon,
              zIndexOffset: 1000
            }).addTo(map);
            riderMarker.bindPopup('<b>Your Location</b>');
            
            // Add delivery markers
            deliveries.forEach(delivery => {
              const markerClass = delivery.status === 'assigned' ? 'delivery-marker-assigned' : 
                                 delivery.status === 'picked_up' ? 'delivery-marker-picked' : 
                                 'delivery-marker-completed';
              
              const icon = L.divIcon({
                className: markerClass,
                iconSize: [20, 20],
                popupAnchor: [0, -10]
              });
              
              const marker = L.marker([delivery.lat, delivery.lng], {
                icon: icon
              }).addTo(map);
              
              // Create popup content
              const popupContent = \`
                <div class="delivery-popup">
                  <div class="popup-title">\${delivery.title}</div>
                  <div class="popup-address">\${delivery.description}</div>
                  <button class="popup-button" onclick="selectDelivery('\${delivery.id}')">View Details</button>
                </div>
              \`;
              
              marker.bindPopup(popupContent);
              
              marker.on('click', function() {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'DELIVERY_SELECTED',
                  deliveryId: delivery.id,
                  lat: delivery.lat,
                  lng: delivery.lng
                }));
              });
              
              deliveryMarkers.push({
                marker: marker,
                data: delivery
              });
            });
            
            // Fit all markers
            fitAllMarkers();
          }
          
          function fitAllMarkers() {
            const points = [
              [currentLocation.lat, currentLocation.lng],
              ...deliveries.map(d => [d.lat, d.lng])
            ];
            
            if (points.length > 0) {
              const bounds = L.latLngBounds(points);
              map.fitBounds(bounds, { padding: [50, 50] });
            }
          }
          
          function centerOnMe() {
            map.setView([currentLocation.lat, currentLocation.lng], 16);
          }
          
          function selectDelivery(deliveryId) {
            const delivery = deliveries.find(d => d.id === deliveryId);
            if (delivery) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'DELIVERY_SELECTED',
                deliveryId: delivery.id,
                lat: delivery.lat,
                lng: delivery.lng
              }));
            }
          }
          
          // Listen for location updates from React Native
          window.addEventListener('message', function(event) {
            const data = JSON.parse(event.data);
            
            if (data.type === 'UPDATE_LOCATION') {
              currentLocation = { lat: data.lat, lng: data.lon };
              
              if (riderMarker) {
                riderMarker.setLatLng([data.lat, data.lon]);
                
                // Update map view if needed
                if (data.shouldCenter) {
                  map.setView([data.lat, data.lon], 16);
                }
              }
            } else if (data.type === 'FIT_ALL') {
              fitAllMarkers();
            } else if (data.type === 'CENTER_ON_DELIVERY') {
              map.setView([data.lat, data.lng], 17);
            }
          });
          
          window.onload = function() {
            initMap();
          };
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
    const initialize = async () => {
      setLoading(true);
      await getCurrentLocation(true);
      await fetchActiveDeliveries();
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
      };
    }
  }, [profile]);

  // Update map when deliveries change
  useEffect(() => {
    if (!loading && deliveries.length > 0) {
      generateMapHtml();
    }
  }, [deliveries, currentLocation]);

  const handleWebViewMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      if (data.type === 'DELIVERY_SELECTED') {
        const delivery = deliveries.find(d => d.id === data.deliveryId);
        if (delivery) {
          setSelectedDelivery(delivery);
          setShowDeliveryModal(true);
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
        lat: delivery.orders.delivery_lat,
        lng: delivery.orders.delivery_lng
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
      android: `geo:${delivery_lat},${delivery_lng}`
    });
    
    Linking.openURL(url);
  };

  const viewDeliveryDetails = () => {
    setShowDeliveryModal(false);
    navigation.navigate('RiderDeliveryDetails', { delivery: selectedDelivery });
  };

  const fitAllMarkers = () => {
    if (webViewRef.current) {
      webViewRef.current.postMessage(JSON.stringify({
        type: 'FIT_ALL'
      }));
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
        />
      </View>

      {/* Bottom Panel - Active Deliveries List */}
      <View style={[styles.bottomPanel, { paddingBottom: insets.bottom }]}>
        <View style={styles.panelHeader}>
          <Text style={styles.panelTitle}>
            Active Deliveries ({deliveries.length})
          </Text>
          <TouchableOpacity onPress={getCurrentLocation}>
            <Ionicons name="locate" size={22} color="#0033A0" />
          </TouchableOpacity>
        </View>

        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.deliveriesScroll}
        >
          {deliveries.length === 0 ? (
            <View style={styles.emptyDeliveries}>
              <Text style={styles.emptyText}>No active deliveries</Text>
            </View>
          ) : (
            deliveries.map((delivery) => (
              <TouchableOpacity
                key={delivery.id}
                style={[
                  styles.deliveryChip,
                  selectedDelivery?.id === delivery.id && styles.deliveryChipSelected
                ]}
                onPress={() => handleDeliveryPress(delivery)}
              >
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
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
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
    maxHeight: 80,
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