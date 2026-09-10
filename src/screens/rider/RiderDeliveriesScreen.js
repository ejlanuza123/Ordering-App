// src/screens/rider/RiderDeliveriesScreen.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  StatusBar,
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatOrderNumber } from '../../utils/formatters';
import { useFocusEffect } from '@react-navigation/native';
import { riderPresenceService } from '../../services/riderPresenceService';
import SkeletonLoader from '../../components/SkeletonLoader';
import GPSNavigationModal from '../../components/GPSNavigationModal';
import { useTheme } from '../../context/ThemeContext';

export default function RiderDeliveriesScreen({ navigation, route }) {
  const { colors, isDarkMode } = useTheme();
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all'); // all, assigned, accepted, on_delivery, delivered, failed
  const [navDestination, setNavDestination] = useState(null);
  const handledNotificationNonceRef = useRef(null);

  const fetchDeliveries = useCallback(async () => {
    try {
      let query = supabase
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
            created_at
          )
        `)
        .eq('rider_id', profile.id)
        .order('assigned_at', { ascending: false });

      if (filter === 'on_delivery') {
        query = query.in('status', ['picked_up', 'out_for_delivery']);
      } else if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setDeliveries(data || []);
    } catch (error) {
      console.error('Error fetching deliveries:', error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile, filter]);

  useFocusEffect(
    useCallback(() => {
      const ensureRiderOnline = async () => {
        if (!profile?.id) return;
        
        try {
          // Check current online status and set online if needed
          const isCurrentlyOnline = await riderPresenceService.checkIfOnline(profile.id);
          if (!isCurrentlyOnline && riderPresenceService.isIntendedOnline()) {
            await riderPresenceService.setOnlineStatus(profile.id, true);
          }
        } catch (error) {
          console.error('Error ensuring rider online status:', error);
        }
      };

      ensureRiderOnline();
    }, [profile?.id])
  );

  useEffect(() => {
    fetchDeliveries();

    // Real-time subscription
    const channel = supabase
      .channel('rider-deliveries-list')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'deliveries',
          filter: `rider_id=eq.${profile.id}`
        },
        () => {
          fetchDeliveries();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [profile, filter, fetchDeliveries]);

  useEffect(() => {
    const nonce = route?.params?.nonce;
    const fromNotification = route?.params?.fromNotification;
    const focusDeliveryId = Number(route?.params?.focusDeliveryId);
    const focusOrderId = Number(route?.params?.focusOrderId);

    if (!fromNotification || !nonce) return;
    if (handledNotificationNonceRef.current === nonce) return;

    const targetDelivery = deliveries.find((d) => {
      const matchDelivery = Number.isFinite(focusDeliveryId) && d.id === focusDeliveryId;
      const matchOrder = Number.isFinite(focusOrderId) && d.order_id === focusOrderId;
      return matchDelivery || matchOrder;
    });

    if (!targetDelivery) return;

    handledNotificationNonceRef.current = nonce;
    navigation.navigate('RiderDeliveryDetails', { delivery: targetDelivery });
    navigation.setParams({
      focusDeliveryId: null,
      focusOrderId: null,
      fromNotification: false,
      nonce: null,
    });
  }, [deliveries, navigation, route?.params?.nonce, route?.params?.focusDeliveryId, route?.params?.focusOrderId, route?.params?.fromNotification]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDeliveries();
  };

  const getStatusColor = (status) => {
    const s = typeof status === 'string' ? status.toLowerCase().replace(/\s+/g, '') : '';
    switch(s) {
      case 'pending':
      case 'placed':
        return isDarkMode ? '#FDE047' : '#F59E0B';
      case 'processing':
      case 'preparing':
        return isDarkMode ? '#60A5FA' : '#0033A0';
      case 'confirmed':
      case 'accepted':
      case 'assigned':
        return isDarkMode ? '#3B82F6' : '#2563EB';
      case 'riderpickedup':
      case 'riderpickeduptheorder':
      case 'pickedup':
      case 'picked_up':
        return isDarkMode ? '#38BDF8' : '#0EA5E9';
      case 'outfordelivery':
      case 'out_for_delivery':
      case 'intransit':
      case 'transit':
      case 'delivering':
        return isDarkMode ? '#E879F9' : '#7e0083'; // Purple -> Neon Pink/Purple
      case 'completed':
      case 'delivered':
        return isDarkMode ? '#34D399' : '#10B981';
      case 'cancelled':
      case 'failed':
        return isDarkMode ? '#F87171' : '#EF4444';
      case 'archived':
        return isDarkMode ? '#FCD34D' : '#F59E0B';
      case 'pendingsync':
      case 'offline':
        return isDarkMode ? '#FBBF24' : '#D97706';
      default:
        return isDarkMode ? '#94A3B8' : '#666666'; // fallback
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'assigned': return 'alert-circle';
      case 'accepted': return 'checkmark-circle';
      case 'picked_up': return 'bicycle';
      case 'out_for_delivery': return 'navigate';
      case 'delivered': return 'checkmark-done';
      case 'failed': return 'close-circle';
      default: return 'help-circle';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'assigned': return 'Ready to Accept';
      case 'accepted': return 'Accepted - Ready to Pick Up';
      case 'picked_up': return 'Picked Up';
      case 'out_for_delivery': return 'Out for Delivery';
      case 'delivered': return 'Delivered';
      case 'failed': return 'Failed';
      default: return status;
    }
  };

  const renderDeliveryItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.deliveryCard, { backgroundColor: colors.surface, shadowColor: colors.shadow }]}
      onPress={() => navigation.navigate('RiderDeliveryDetails', { delivery: item })}
    >
      <View style={[styles.cardHeader, { borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.orderNumber, { color: colors.textPrimary }]}>
            Order {formatOrderNumber(item.orders?.order_number, item.order_id)}
          </Text>
          <Text style={[styles.orderTime, { color: colors.textSecondary }]}>
            {new Date(item.assigned_at).toLocaleString()}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
          <Ionicons name={getStatusIcon(item.status)} size={14} color={getStatusColor(item.status)} />
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {getStatusLabel(item.status)}
          </Text>
        </View>
      </View>

      <View style={styles.customerInfo}>
        <View style={styles.infoRow}>
          <Ionicons name="person" size={16} color={colors.textSecondary} />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>{item.orders?.customer_name?.full_name}</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="call" size={16} color={colors.textSecondary} />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>{item.orders?.customer_name?.phone_number || 'No phone'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="location" size={16} color={colors.textSecondary} />
          <Text style={[styles.infoText, { color: colors.textSecondary }]} numberOfLines={2}>{item.orders?.delivery_address}</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="cash" size={16} color={colors.textSecondary} />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>{formatCurrency(item.orders?.total_amount)}</Text>
        </View>
      </View>

      <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.gpsNavButton, { backgroundColor: isDarkMode ? colors.surfaceElevated : (colors.primary + '15') }]}
          onPress={() => setNavDestination({
            lat: item.orders?.delivery_lat,
            lng: item.orders?.delivery_lng,
            address: item.orders?.delivery_address,
            customerName: item.orders?.customer_name?.full_name,
            orderNumber: formatOrderNumber(item.orders?.order_number, item.orders?.id)
          })}
          activeOpacity={0.8}
        >
          <Ionicons name="navigate" size={16} color={colors.primary} />
          <Text style={[styles.gpsNavButtonText, { color: colors.primary }]}>GPS</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.viewButton, { backgroundColor: colors.primary }]}
          onPress={() => navigation.navigate('RiderDeliveryDetails', { delivery: item })}
        >
          <Text style={styles.viewButtonText}>View Details</Text>
          <Ionicons name="arrow-forward" size={16} color="#fff" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const FilterButton = ({ title, value }) => {
    const isActive = filter === value;
    return (
      <TouchableOpacity
        style={[
          styles.filterButton,
          {
            backgroundColor: isDarkMode ? colors.surfaceElevated : '#f8f9fa',
            borderColor: colors.border,
          },
          isActive && {
            backgroundColor: colors.primary,
            borderColor: colors.primary,
          },
        ]}
        onPress={() => setFilter(value)}
      >
        <Text
          style={[
            styles.filterText,
            { color: colors.textSecondary },
            isActive && { color: '#fff' },
          ]}
        >
          {title}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={colors.surface} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border, shadowColor: colors.shadow }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backButton, { backgroundColor: isDarkMode ? colors.surfaceElevated : (colors.primary + '15') }]}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: isDarkMode ? colors.textPrimary : colors.primary }]}>My Deliveries</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Filter Tabs */}
      <View style={[styles.filterContainer, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <FilterButton title="All" value="all" />
          <FilterButton title="Ready" value="assigned" />
          <FilterButton title="Accepted" value="accepted" />
          <FilterButton title="On Delivery" value="on_delivery" />
          <FilterButton title="Delivered" value="delivered" />
          <FilterButton title="Failed" value="failed" />
        </ScrollView>
      </View>

      {loading ? (
        <SkeletonLoader variant="delivery-card" count={4} />
      ) : (
        <FlatList
          data={deliveries}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderDeliveryItem}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 20 }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="bicycle-outline" size={80} color={colors.border} />
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No deliveries found</Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                {filter === 'all' 
                  ? "You don't have any deliveries yet"
                  : `No ${filter} deliveries at the moment`}
              </Text>
            </View>
          }
        />
      )}
      {/* GPS Navigation Modal */}
      <GPSNavigationModal
        visible={!!navDestination}
        onClose={() => setNavDestination(null)}
        destination={navDestination}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
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
  },
  backButton: {
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
  filterContainer: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  filterButtonActive: {
    backgroundColor: '#0033A0',
    borderColor: '#0033A0',
  },
  filterText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
    fontSize: 14,
  },
  listContent: {
    padding: 16,
  },
  deliveryCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f4ff',
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  orderTime: {
    fontSize: 11,
    color: '#999',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  customerInfo: {
    gap: 8,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 12,
  },
  gpsNavButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0033A015',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  gpsNavButtonText: {
    color: '#0033A0',
    fontSize: 13,
    fontWeight: '700',
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0033A0',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  viewButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});