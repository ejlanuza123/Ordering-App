// src/screens/rider/RiderDashboardScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  StatusBar,
  Dimensions,
  Alert,
  Modal,
  TextInput,
  Linking,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { useRiderRatings } from '../../context/RiderRatingContext';
import { formatCurrency, formatOrderNumber } from '../../utils/formatters';
import CustomAlertModal from '../../components/CustomAlertModal';
import { useFocusEffect } from '@react-navigation/native';
import Avatar from '../../components/Avatar';

const { width } = Dimensions.get('window');
const devLog = (...args) => {
  if (__DEV__) {
    console.log(...args);
  }
};

export default function RiderDashboardScreen({ navigation }) {
  const { profile } = useAuth();
  const { unreadCount } = useNotifications();
  const { getRiderStats } = useRiderRatings();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState(null);
  const [stats, setStats] = useState({
    todayDeliveries: 0,
    completedToday: 0,
    pendingDeliveries: 0,
    totalEarnings: 0,
    todayEarnings: 0,
    rating: 4.8,
    acceptanceRate: 100,
    onTimeRate: 98
  });
  const [activeDeliveries, setActiveDeliveries] = useState([]);
  const [recentDeliveries, setRecentDeliveries] = useState([]);
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [showAlert, setShowAlert] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ type: 'success', title: '', message: '' });
  const [onlineStatus, setOnlineStatus] = useState(true);
  const [showEarningsModal, setShowEarningsModal] = useState(false);
  const [earningsBreakdown, setEarningsBreakdown] = useState({
    weekly: 0,
    monthly: 0,
    pending: 0
  });
  const [defaultDeliveryFee, setDefaultDeliveryFee] = useState(50);

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

          if (!error && typeof data?.is_online === 'boolean') {
            setOnlineStatus(data.is_online);
          }
        } catch (error) {
          console.error('Error fetching latest profile state:', error);
        }
      };

      fetchLatestProfileState();
    }, [profile])
  );

  const fetchDashboardData = useCallback(async () => {
    try {
      if (!profile) return;

      const { data: deliveryFeeSetting } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'default_delivery_fee')
        .single();

      const parsedDefaultFee = parseFloat(deliveryFeeSetting?.value);
      if (!Number.isNaN(parsedDefaultFee) && parsedDefaultFee >= 0) {
        setDefaultDeliveryFee(parsedDefaultFee);
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();
      
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      startOfMonth.setHours(0, 0, 0, 0);

      // Get all deliveries for this rider with more details
      const { data: deliveries, error } = await supabase
        .from('deliveries')
        .select(`
            id,
            status,
            assigned_at,
            accepted_at,
            picked_up_at,
            delivered_at,
            failed_at,
            notes,
            order_id,
            orders:order_id (
              id,
              order_number,
              total_amount,
              delivery_fee,
              delivery_address,
              delivery_lat,
              delivery_lng,
              payment_method,
              special_instructions,
              status,
              user_id,
              profiles:user_id (
                full_name,
                phone_number
              )
            )
        `)
        .eq('rider_id', profile.id)
        .order('assigned_at', { ascending: false });

      if (error) throw error;

      // Calculate stats
      const todayDeliveries = deliveries?.filter(d => 
        new Date(d.assigned_at) >= today
      ) || [];

      const completedToday = deliveries?.filter(d => 
        d.status === 'delivered' && new Date(d.delivered_at) >= today
      ) || [];

      const pending = deliveries?.filter(d => 
        d.status === 'assigned' || d.status === 'accepted' || d.status === 'picked_up' || d.status === 'out_for_delivery'
      ) || [];

      const accepted = deliveries?.filter(d => d.status === 'accepted') || [];
      const assigned = deliveries?.filter(d => d.status === 'assigned') || [];
      
      // Calculate acceptance rate
      const totalAssignments = assigned.length + accepted.length;
      const acceptanceRate = totalAssignments > 0 
        ? Math.round((accepted.length / totalAssignments) * 100) 
        : 100;

      // Calculate on-time delivery rate
      const deliveredOnTime = deliveries?.filter(d => {
        if (d.status !== 'delivered' || !d.delivered_at || !d.assigned_at) return false;
        const deliveryTime = new Date(d.delivered_at) - new Date(d.assigned_at);
        // Consider on-time if delivered within 2 hours
        return deliveryTime <= 2 * 60 * 60 * 1000;
      }) || [];
      
      const completedDeliveries = deliveries?.filter(d => d.status === 'delivered') || [];
      const onTimeRate = completedDeliveries.length > 0
        ? Math.round((deliveredOnTime.length / completedDeliveries.length) * 100)
        : 100;

      // Calculate earnings based on delivery fees
      const completedDeliveriesList = deliveries?.filter(d => d.status === 'delivered') || [];
      const totalEarnings = completedDeliveriesList.reduce((sum, d) => 
        sum + (parseFloat(d.orders?.delivery_fee) || 0), 0
      );
      const todayEarnings = completedToday.reduce((sum, d) => 
        sum + (parseFloat(d.orders?.delivery_fee) || 0), 0
      );
      
      // Weekly earnings
      const weeklyDeliveries = deliveries?.filter(d => 
        d.status === 'delivered' && new Date(d.delivered_at) >= startOfWeek
      ) || [];
      const weeklyEarnings = weeklyDeliveries.reduce((sum, d) => 
        sum + (parseFloat(d.orders?.delivery_fee) || 0), 0
      );
      
      // Monthly earnings
      const monthlyDeliveries = deliveries?.filter(d => 
        d.status === 'delivered' && new Date(d.delivered_at) >= startOfMonth
      ) || [];
      const monthlyEarnings = monthlyDeliveries.reduce((sum, d) => 
        sum + (parseFloat(d.orders?.delivery_fee) || 0), 0
      );
      
      // Pending earnings (deliveries in progress)
      const pendingEarnings = pending.reduce((sum, d) => 
        sum + (parseFloat(d.orders?.delivery_fee) || 0), 0
      );

      // Get active deliveries (assigned, accepted, or picked up)
      const activeList = pending.map(delivery => ({
        ...delivery,
        timeSinceAssignment: getTimeSince(delivery.assigned_at)
      }));
      setActiveDeliveries(activeList.slice(0, 3));

      // Get recent deliveries (last 5 completed)
      setRecentDeliveries(
        deliveries?.filter(d => d.status === 'delivered')
          .slice(0, 5) || []
      );

      // Fetch rider rating from database
      const riderStatsData = await getRiderStats(profile.id);
      const riderRating = riderStatsData?.averageRating || 0;

      setStats({
        todayDeliveries: todayDeliveries.length,
        completedToday: completedToday.length,
        pendingDeliveries: pending.length,
        totalEarnings,
        todayEarnings,
        rating: riderRating,
        acceptanceRate,
        onTimeRate
      });

      setEarningsBreakdown({
        weekly: weeklyEarnings,
        monthly: monthlyEarnings,
        pending: pendingEarnings
      });

    } catch (error) {
      console.error('Error fetching dashboard:', error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile]);

  const getTimeSince = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMins = Math.floor((now - date) / 60000);
    
    if (diffMins < 60) {
      return `${diffMins} min`;
    } else {
      return `${Math.floor(diffMins / 60)} hr`;
    }
  };

  useEffect(() => {
    fetchDashboardData();

    // Subscribe to real-time updates
    if (profile) {
      const channel = supabase
        .channel('rider-deliveries')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'deliveries',
            filter: `rider_id=eq.${profile.id}`
          },
          (payload) => {
            // Show notification for new assignments
            if (payload.eventType === 'INSERT' && payload.new.status === 'assigned') {
              showNewDeliveryNotification(payload.new);
            }
            fetchDashboardData();
          }
        )
        .subscribe();

      return () => {
        channel.unsubscribe();
      };
    }
  }, [profile, fetchDashboardData]);

  const showNewDeliveryNotification = (delivery) => {
    Alert.alert(
      '🔔 New Delivery Assignment!',
      `You have a new delivery to pick up.\n\nOrder #${delivery.order_id}\nPlease check your deliveries.`,
      [
        { 
          text: 'View', 
          onPress: () => navigation.navigate('RiderDeliveries')
        },
        { 
          text: 'Dismiss', 
          style: 'cancel'
        }
      ]
    );
  };

  const acceptDelivery = async () => {
    if (!selectedDelivery) return;
    
    try {
      const { error } = await supabase
        .from('deliveries')
        .update({ 
          status: 'accepted',
          accepted_at: new Date().toISOString()
        })
        .eq('id', selectedDelivery.id);

      if (error) throw error;

      // Update order status
      await supabase
        .from('orders')
        .update({ status: 'Processing' })
        .eq('id', selectedDelivery.order_id);

      setAlertConfig({
        type: 'success',
        title: 'Success!',
        message: 'Delivery accepted successfully. Please proceed to pick up the order.'
      });
      setShowAlert(true);
      
      fetchDashboardData();
    } catch (error) {
      setAlertConfig({
        type: 'error',
        title: 'Error',
        message: error.message
      });
      setShowAlert(true);
    } finally {
      setShowAcceptModal(false);
      setSelectedDelivery(null);
    }
  };

  const declineDelivery = async () => {
    if (!selectedDelivery) return;
    
    try {
      const { error } = await supabase
        .from('deliveries')
        .update({ 
          status: 'declined',
          notes: 'Declined by rider'
        })
        .eq('id', selectedDelivery.id);

      if (error) throw error;

      // Admin notifications are generated server-side under hardened RLS.
      // Rider clients should not insert directly into notifications.
      devLog('Delivery declined; admin notification should be handled server-side.');

      setAlertConfig({
        type: 'info',
        title: 'Declined',
        message: 'You have declined this delivery.'
      });
      setShowAlert(true);
      
      fetchDashboardData();
    } catch (error) {
      setAlertConfig({
        type: 'error',
        title: 'Error',
        message: error.message
      });
      setShowAlert(true);
    } finally {
      setShowAcceptModal(false);
      setSelectedDelivery(null);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMins = Math.floor((now - date) / 60000);
    
    if (diffMins < 60) {
      return `${diffMins} min ago`;
    } else if (diffMins < 1440) {
      return `${Math.floor(diffMins / 60)} hr ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const getStatusIcon = (status) => {
    switch(status) {
      case 'assigned': return 'alert-circle';
      case 'accepted': return 'checkmark-circle';
      case 'picked_up': return 'bicycle';
      case 'out_for_delivery': return 'navigate';
      case 'delivered': return 'checkmark-done';
      case 'failed': return 'close-circle';
      default: return 'help-circle';
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'assigned': return '#F59E0B';
      case 'accepted': return '#10B981';
      case 'picked_up': return '#0033A0';
      case 'out_for_delivery': return '#0033A0';
      case 'delivered': return '#10B981';
      case 'failed': return '#EF4444';
      default: return '#666';
    }
  };

  const getStatusText = (status) => {
    switch(status) {
      case 'assigned': return 'Ready to Accept';
      case 'accepted': return 'Accepted - Ready to Pick Up';
      case 'picked_up': return 'Picked Up';
      case 'out_for_delivery': return 'On Delivery';
      case 'delivered': return 'Delivered';
      case 'failed': return 'Failed';
      default: return status;
    }
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#0033A0" />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.riderIdentity}>
            <View style={styles.riderLogoWrap}>
              <Image
                source={require('../../../assets/petron-logo.jpg')}
                style={styles.riderLogo}
                resizeMode="contain"
              />
            </View>
            <View>
              <Text style={styles.greeting}>Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 18 ? 'Afternoon' : 'Evening'},</Text>
              <Text style={styles.userName}>{profile?.full_name?.split(' ')[0] || 'Rider'}</Text>
            </View>
          </View>
          
          <View style={styles.headerActions}>
            <View
              style={[
                styles.statusIndicator,
                onlineStatus ? styles.statusOnline : styles.statusOffline
              ]}
            >
              <View style={[styles.statusDot, onlineStatus ? styles.dotOnline : styles.dotOffline]} />
            </View>

            <TouchableOpacity 
              style={styles.iconButton}
              onPress={() => navigation.navigate('Notifications')}
            >
              <Ionicons name="notifications-outline" size={22} color="#0033A0" />
              {/* Unread badge - displays only when there are unread notifications */}
              {unreadCount > 0 && <View style={styles.badge} />}
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.profileButton}
              onPress={() => navigation.navigate('RiderProfile')}
            >
              <Avatar 
                size={44} 
                avatarUrl={currentAvatarUrl} 
                editable={false}
                showEditButton={false}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick Stats Row */}
        <View style={styles.quickStatsRow}>
          <View style={styles.quickStat}>
            <Ionicons name="bicycle" size={20} color="#0033A0" />
            <Text style={styles.quickStatValue}>{stats.todayDeliveries}</Text>
            <Text style={styles.quickStatLabel}>Today</Text>
          </View>
          
          <View style={styles.quickStatDivider} />
          
          <View style={styles.quickStat}>
            <Ionicons name="checkmark-circle" size={20} color="#10B981" />
            <Text style={styles.quickStatValue}>{stats.completedToday}</Text>
            <Text style={styles.quickStatLabel}>Completed</Text>
          </View>
          
          <View style={styles.quickStatDivider} />
          
          <View style={styles.quickStat}>
            <Ionicons name="time" size={20} color="#F59E0B" />
            <Text style={styles.quickStatValue}>{stats.pendingDeliveries}</Text>
            <Text style={styles.quickStatLabel}>Pending</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity 
            style={styles.quickActionItem}
            onPress={() => navigation.navigate('RiderDeliveries')}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: '#0033A015' }]}>
              <Ionicons name="list" size={22} color="#0033A0" />
            </View>
            <Text style={styles.quickActionText}>All</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.quickActionItem}
            onPress={() => navigation.navigate('RiderMap')}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: '#10B98115' }]}>
              <Ionicons name="map" size={22} color="#10B981" />
            </View>
            <Text style={styles.quickActionText}>Map</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.quickActionItem}
            onPress={() => navigation.navigate('RiderProfile')}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: '#F59E0B15' }]}>
              <Ionicons name="person" size={22} color="#F59E0B" />
            </View>
            <Text style={styles.quickActionText}>Profile</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.quickActionItem}
            onPress={() => Linking.openURL('tel:123456789')}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: '#ED293915' }]}>
              <Ionicons name="headset" size={22} color="#ED2939" />
            </View>
            <Text style={styles.quickActionText}>Support</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0033A0']} />
        }
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
      >
        {/* Earnings Card */}
        <TouchableOpacity 
          style={styles.earningsCard}
          onPress={() => setShowEarningsModal(true)}
          activeOpacity={0.7}
        >
          <View style={styles.earningsHeader}>
            <View>
              <Text style={styles.earningsTitle}>Total Earnings</Text>
              <Text style={styles.earningsAmount}>{formatCurrency(stats.totalEarnings)}</Text>
            </View>
            <View style={styles.earningsBadge}>
              <Text style={styles.earningsBadgeText}>Default fee: {formatCurrency(defaultDeliveryFee)}</Text>
            </View>
          </View>
          
          <View style={styles.earningsProgress}>
            <View style={styles.earningsProgressItem}>
              <Text style={styles.earningsProgressLabel}>Today</Text>
              <Text style={styles.earningsProgressValue}>{formatCurrency(stats.todayEarnings)}</Text>
            </View>
            <View style={styles.earningsProgressItem}>
              <Text style={styles.earningsProgressLabel}>This Week</Text>
              <Text style={styles.earningsProgressValue}>{formatCurrency(earningsBreakdown.weekly)}</Text>
            </View>
            <View style={styles.earningsProgressItem}>
              <Text style={styles.earningsProgressLabel}>This Month</Text>
              <Text style={styles.earningsProgressValue}>{formatCurrency(earningsBreakdown.monthly)}</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Performance Metrics */}
        <View style={styles.performanceCard}>
          <Text style={styles.sectionTitle}>Performance</Text>
          <View style={styles.performanceGrid}>
            <View style={styles.performanceItem}>
              <Ionicons name="stats-chart" size={20} color="#0033A0" />
              <Text style={styles.performanceValue}>{stats.acceptanceRate}%</Text>
              <Text style={styles.performanceLabel}>Acceptance</Text>
            </View>
            
            <View style={styles.performanceItem}>
              <Ionicons name="time" size={20} color="#10B981" />
              <Text style={styles.performanceValue}>{stats.onTimeRate}%</Text>
              <Text style={styles.performanceLabel}>On-Time</Text>
            </View>
            
            <View style={styles.performanceItem}>
              <Ionicons name="star" size={20} color="#F59E0B" />
              <Text style={styles.performanceValue}>{stats.rating}</Text>
              <Text style={styles.performanceLabel}>Rating</Text>
            </View>
          </View>
        </View>

        {/* Active Deliveries */}
        {activeDeliveries.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Active Deliveries</Text>
              <TouchableOpacity onPress={() => navigation.navigate('RiderDeliveries')}>
                <Text style={styles.viewAllText}>View All ({activeDeliveries.length})</Text>
              </TouchableOpacity>
            </View>
            
            {activeDeliveries.map((delivery) => (
              <TouchableOpacity
                key={delivery.id}
                style={styles.deliveryCard}
                onPress={() => navigation.navigate('RiderDeliveryDetails', { delivery })}
                activeOpacity={0.7}
              >
                <View style={styles.deliveryHeader}>
                  <View>
                    <Text style={styles.deliveryOrderNumber}>
                      Order {formatOrderNumber(delivery.orders?.order_number, delivery.order_id)}
                    </Text>
                    <View style={styles.deliveryStatus}>
                      <View style={[styles.statusDot, { backgroundColor: getStatusColor(delivery.status) }]} />
                      <Text style={[styles.statusText, { color: getStatusColor(delivery.status) }]}>
                        {getStatusText(delivery.status)}
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#999" />
                </View>
                
                <View style={styles.deliveryInfo}>
                  <View style={styles.deliveryInfoRow}>
                    <Ionicons name="location-outline" size={16} color="#666" />
                    <Text style={styles.deliveryInfoText} numberOfLines={1}>
                      {delivery.orders?.delivery_address}
                    </Text>
                  </View>
                  <View style={styles.deliveryInfoRow}>
                    <Ionicons name="person-outline" size={16} color="#666" />
                    <Text style={styles.deliveryInfoText}>
                      {delivery.orders?.profiles?.full_name || 'Customer'}
                    </Text>
                  </View>
                  <View style={styles.deliveryInfoRow}>
                    <Ionicons name="time-outline" size={16} color="#666" />
                    <Text style={styles.deliveryInfoText}>
                      {delivery.timeSinceAssignment} ago
                    </Text>
                  </View>
                </View>

                {delivery.status === 'assigned' && (
                  <TouchableOpacity
                    style={styles.acceptButton}
                    onPress={() => {
                      setSelectedDelivery(delivery);
                      setShowAcceptModal(true);
                    }}
                  >
                    <Text style={styles.acceptButtonText}>Accept Delivery</Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Recent Deliveries */}
        {recentDeliveries.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Deliveries</Text>
            {recentDeliveries.map((delivery) => (
              <View key={delivery.id} style={styles.recentItem}>
                <View style={styles.recentIcon}>
                  <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                </View>
                <View style={styles.recentInfo}>
                  <Text style={styles.recentOrder}>
                    Order {formatOrderNumber(delivery.orders?.order_number, delivery.order_id)}
                  </Text>
                  <Text style={styles.recentTime}>
                    {formatTimeAgo(delivery.delivered_at)}
                  </Text>
                </View>
                <Text style={styles.recentAmount}>+{formatCurrency(parseFloat(delivery.orders?.delivery_fee) || 0)}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Accept Delivery Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showAcceptModal}
        onRequestClose={() => setShowAcceptModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Accept Delivery?</Text>
              <TouchableOpacity onPress={() => setShowAcceptModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {selectedDelivery && (
              <View style={styles.modalBody}>
                <View style={styles.modalDeliveryInfo}>
                  <Text style={styles.modalOrderNumber}>
                    Order {formatOrderNumber(selectedDelivery.orders?.order_number, selectedDelivery.order_id)}
                  </Text>
                  
                  <View style={styles.modalInfoRow}>
                    <Ionicons name="location-outline" size={18} color="#666" />
                    <Text style={styles.modalInfoText}>
                      {selectedDelivery.orders?.delivery_address}
                    </Text>
                  </View>

                  <View style={styles.modalInfoRow}>
                    <Ionicons name="person-outline" size={18} color="#666" />
                    <Text style={styles.modalInfoText}>
                      {selectedDelivery.orders?.profiles?.full_name || 'Customer'}
                    </Text>
                  </View>

                  <View style={styles.modalInfoRow}>
                    <Ionicons name="cash-outline" size={18} color="#666" />
                    <Text style={styles.modalInfoText}>
                      {formatCurrency(selectedDelivery.orders?.total_amount || 0)}
                    </Text>
                  </View>
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.declineButton]}
                    onPress={declineDelivery}
                  >
                    <Text style={styles.declineButtonText}>Decline</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modalButton, styles.acceptModalButton]}
                    onPress={acceptDelivery}
                  >
                    <Text style={styles.acceptModalButtonText}>Accept</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Earnings Breakdown Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showEarningsModal}
        onRequestClose={() => setShowEarningsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Earnings Breakdown</Text>
              <TouchableOpacity onPress={() => setShowEarningsModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.earningsBreakdownCard}>
                <View style={styles.earningsBreakdownItem}>
                  <Text style={styles.earningsBreakdownLabel}>Today</Text>
                  <Text style={styles.earningsBreakdownValue}>
                    {formatCurrency(stats.todayEarnings)}
                  </Text>
                </View>
                
                <View style={styles.earningsBreakdownItem}>
                  <Text style={styles.earningsBreakdownLabel}>This Week</Text>
                  <Text style={styles.earningsBreakdownValue}>
                    {formatCurrency(earningsBreakdown.weekly)}
                  </Text>
                </View>
                
                <View style={styles.earningsBreakdownItem}>
                  <Text style={styles.earningsBreakdownLabel}>This Month</Text>
                  <Text style={styles.earningsBreakdownValue}>
                    {formatCurrency(earningsBreakdown.monthly)}
                  </Text>
                </View>
                
                <View style={styles.earningsDivider} />
                
                <View style={styles.earningsBreakdownItem}>
                  <Text style={styles.earningsBreakdownLabel}>Pending</Text>
                  <Text style={[styles.earningsBreakdownValue, { color: '#F59E0B' }]}>
                    {formatCurrency(earningsBreakdown.pending)}
                  </Text>
                </View>
                
                <View style={styles.earningsBreakdownTotal}>
                  <Text style={styles.earningsTotalLabel}>Total Earnings</Text>
                  <Text style={styles.earningsTotalValue}>
                    {formatCurrency(stats.totalEarnings)}
                  </Text>
                </View>
              </View>

              <Text style={styles.earningsNote}>
                * Earnings are based on each order's delivery fee.
              </Text>
            </View>
          </View>
        </View>
      </Modal>

      {/* Success/Error Alert */}
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
    backgroundColor: '#f8f9fa',
  },
  scrollView: {
    flex: 1,
    zIndex: 0,
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
  // Header Styles
  header: {
    position: 'relative',
    zIndex: 10,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 15,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    elevation: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  riderIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  riderLogoWrap: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#0033A0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    padding: 3,
  },
  riderLogo: {
    width: 34,
    height: 34,
    borderRadius: 6,
  },
  greeting: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  userName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0033A0',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusIndicator: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  statusOnline: {
    backgroundColor: '#10B98110',
    borderColor: '#10B981',
  },
  statusOffline: {
    backgroundColor: '#EF444410',
    borderColor: '#EF4444',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotOnline: {
    backgroundColor: '#10B981',
  },
  dotOffline: {
    backgroundColor: '#EF4444',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f4ff',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ED2939',
  },
  profileButton: {
    marginLeft: 4,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0033A0',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#0033A0',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  avatarText: {
    fontSize: 18,
    color: '#fff',
    fontWeight: 'bold',
  },
  // Quick Stats
  quickStatsRow: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    padding: 12,
    marginBottom: 15,
  },
  quickStat: {
    flex: 1,
    alignItems: 'center',
  },
  quickStatDivider: {
    width: 1,
    backgroundColor: '#e9ecef',
  },
  quickStatValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 4,
  },
  quickStatLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  // Quick Actions
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 5,
  },
  quickActionItem: {
    alignItems: 'center',
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  quickActionText: {
    fontSize: 11,
    color: '#666',
    fontWeight: '500',
  },
  // Scroll Content
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  // Earnings Card
  earningsCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  earningsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  earningsTitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  earningsAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#0033A0',
  },
  earningsBadge: {
    backgroundColor: '#10B98110',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  earningsBadgeText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '600',
  },
  earningsProgress: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  earningsProgressItem: {
    flex: 1,
    alignItems: 'center',
  },
  earningsProgressLabel: {
    fontSize: 11,
    color: '#999',
    marginBottom: 2,
  },
  earningsProgressValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  // Performance Card
  performanceCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  performanceGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
  },
  performanceItem: {
    alignItems: 'center',
  },
  performanceValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 4,
  },
  performanceLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  // Section Styles
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  viewAllText: {
    fontSize: 13,
    color: '#0033A0',
    fontWeight: '600',
  },
  // Delivery Card
  deliveryCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  deliveryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  deliveryOrderNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  deliveryStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deliveryInfo: {
    gap: 8,
  },
  deliveryInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deliveryInfoText: {
    flex: 1,
    fontSize: 13,
    color: '#666',
  },
  acceptButton: {
    backgroundColor: '#10B981',
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 12,
    alignItems: 'center',
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  // Recent Item
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  recentIcon: {
    marginRight: 12,
  },
  recentInfo: {
    flex: 1,
  },
  recentOrder: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  recentTime: {
    fontSize: 11,
    color: '#999',
  },
  recentAmount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#10B981',
  },
  // Modal Styles
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
  modalDeliveryInfo: {
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
    alignItems: 'center',
    marginBottom: 10,
    gap: 12,
  },
  modalInfoText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  declineButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  declineButtonText: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '600',
  },
  acceptModalButton: {
    backgroundColor: '#10B981',
  },
  acceptModalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Earnings Breakdown Styles
  earningsBreakdownCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  earningsBreakdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  earningsBreakdownLabel: {
    fontSize: 14,
    color: '#666',
  },
  earningsBreakdownValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  earningsDivider: {
    height: 1,
    backgroundColor: '#e9ecef',
    marginVertical: 8,
  },
  earningsBreakdownTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    marginTop: 4,
  },
  earningsTotalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  earningsTotalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0033A0',
  },
  earningsNote: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
  },
});