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
  TextInput
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../utils/formatters';
import CustomAlertModal from '../../components/CustomAlertModal';

const { width } = Dimensions.get('window');

export default function RiderDashboardScreen({ navigation }) {
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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

  const fetchDashboardData = useCallback(async () => {
    try {
      if (!profile) return;

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
        d.status === 'assigned' || d.status === 'accepted' || d.status === 'picked_up'
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

      // Calculate earnings
      const completedDeliveriesList = deliveries?.filter(d => d.status === 'delivered') || [];
      const totalEarnings = completedDeliveriesList.length * 50;
      const todayEarnings = completedToday.length * 50;
      
      // Weekly earnings
      const weeklyDeliveries = deliveries?.filter(d => 
        d.status === 'delivered' && new Date(d.delivered_at) >= startOfWeek
      ) || [];
      const weeklyEarnings = weeklyDeliveries.length * 50;
      
      // Monthly earnings
      const monthlyDeliveries = deliveries?.filter(d => 
        d.status === 'delivered' && new Date(d.delivered_at) >= startOfMonth
      ) || [];
      const monthlyEarnings = monthlyDeliveries.length * 50;
      
      // Pending earnings (deliveries in progress)
      const pendingEarnings = pending.length * 50;

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

      setStats({
        todayDeliveries: todayDeliveries.length,
        completedToday: completedToday.length,
        pendingDeliveries: pending.length,
        totalEarnings,
        todayEarnings,
        rating: 4.8, // You can calculate this from ratings table
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

      // Notify admin that rider declined
      await supabase
        .from('notifications')
        .insert({
          user_id: null, // Will be sent to all admins
          type: 'system',
          title: 'Delivery Declined',
          message: `Rider ${profile.full_name} declined delivery #${selectedDelivery.order_id}`,
          data: { delivery_id: selectedDelivery.id }
        });

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

  const toggleOnlineStatus = async () => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          is_active: !onlineStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', profile.id);

      if (error) throw error;
      
      setOnlineStatus(!onlineStatus);
      
      setAlertConfig({
        type: 'success',
        title: 'Status Updated',
        message: `You are now ${!onlineStatus ? 'online' : 'offline'}`
      });
      setShowAlert(true);
    } catch (error) {
      console.error('Error toggling status:', error);
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
      case 'delivered': return '#10B981';
      case 'failed': return '#EF4444';
      default: return '#666';
    }
  };

  const getStatusText = (status) => {
    switch(status) {
      case 'assigned': return 'Ready to Accept';
      case 'accepted': return 'Accepted';
      case 'picked_up': return 'On Delivery';
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
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />

      {/* Header with Online Status Toggle */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.greetingContainer}>
            <Text style={styles.greeting}>Hello,</Text>
            <Text style={styles.userName}>{profile?.full_name || 'Rider'}</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity 
              style={[styles.onlineToggle, onlineStatus ? styles.online : styles.offline]}
              onPress={toggleOnlineStatus}
            >
              <View style={[styles.statusDot, onlineStatus ? styles.onlineDot : styles.offlineDot]} />
              <Text style={styles.onlineText}>{onlineStatus ? 'Online' : 'Offline'}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.profileButton}
              onPress={() => navigation.navigate('RiderProfile')}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {profile?.full_name?.charAt(0)?.toUpperCase() || 'R'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.subtitle}>
          {onlineStatus ? 'You are online and ready to deliver' : 'You are offline'}
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0033A0']} />
        }
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
      >
        {/* Stats Cards */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: '#0033A0' }]}>
            <Text style={styles.statValue}>{stats.todayDeliveries}</Text>
            <Text style={styles.statLabel}>Today's Deliveries</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#ED2939' }]}>
            <Text style={styles.statValue}>{stats.completedToday}</Text>
            <Text style={styles.statLabel}>Completed Today</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#F59E0B' }]}>
            <Text style={styles.statValue}>{stats.pendingDeliveries}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <TouchableOpacity 
            style={[styles.statCard, { backgroundColor: '#10B981' }]}
            onPress={() => setShowEarningsModal(true)}
          >
            <Text style={styles.statValue}>₱{stats.todayEarnings}</Text>
            <Text style={styles.statLabel}>Today's Earnings</Text>
          </TouchableOpacity>
        </View>

        {/* Performance Metrics */}
        <View style={styles.performanceRow}>
          <View style={styles.performanceItem}>
            <Ionicons name="stats-chart" size={20} color="#0033A0" />
            <Text style={styles.performanceLabel}>Acceptance</Text>
            <Text style={styles.performanceValue}>{stats.acceptanceRate}%</Text>
          </View>
          <View style={styles.performanceDivider} />
          <View style={styles.performanceItem}>
            <Ionicons name="time" size={20} color="#10B981" />
            <Text style={styles.performanceLabel}>On-Time</Text>
            <Text style={styles.performanceValue}>{stats.onTimeRate}%</Text>
          </View>
          <View style={styles.performanceDivider} />
          <View style={styles.performanceItem}>
            <Ionicons name="star" size={20} color="#F59E0B" />
            <Text style={styles.performanceLabel}>Rating</Text>
            <Text style={styles.performanceValue}>{stats.rating}</Text>
          </View>
        </View>

        {/* Earnings Summary - Clickable */}
        <TouchableOpacity 
          style={styles.earningsCard}
          onPress={() => setShowEarningsModal(true)}
        >
          <View style={styles.earningsHeader}>
            <Text style={styles.earningsTitle}>Earnings Summary</Text>
            <Ionicons name="chevron-forward" size={20} color="#0033A0" />
          </View>
          <View style={styles.earningsRow}>
            <View style={styles.earningItem}>
              <Text style={styles.earningLabel}>Today</Text>
              <Text style={styles.earningValue}>{formatCurrency(stats.todayEarnings)}</Text>
            </View>
            <View style={styles.earningDivider} />
            <View style={styles.earningItem}>
              <Text style={styles.earningLabel}>This Week</Text>
              <Text style={styles.earningValue}>{formatCurrency(earningsBreakdown.weekly)}</Text>
            </View>
            <View style={styles.earningDivider} />
            <View style={styles.earningItem}>
              <Text style={styles.earningLabel}>Total</Text>
              <Text style={styles.earningValue}>{formatCurrency(stats.totalEarnings)}</Text>
            </View>
          </View>
          <Text style={styles.earningNote}>Tap for detailed breakdown</Text>
        </TouchableOpacity>

        {/* Active Deliveries */}
        {activeDeliveries.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Active Deliveries</Text>
              <TouchableOpacity onPress={() => navigation.navigate('RiderDeliveries')}>
                <Text style={styles.viewAllText}>View All</Text>
              </TouchableOpacity>
            </View>
            {activeDeliveries.map((delivery, index) => (
              <TouchableOpacity
                key={delivery.id}
                style={styles.deliveryCard}
                onPress={() => navigation.navigate('RiderDeliveryDetails', { delivery })}
              >
                <View style={styles.deliveryHeader}>
                  <View style={styles.orderInfo}>
                    <Text style={styles.orderNumber}>
                      Order #{delivery.orders?.order_number || delivery.order_id}
                    </Text>
                    <View style={[
                      styles.statusBadge,
                      { backgroundColor: getStatusColor(delivery.status) + '20' }
                    ]}>
                      <Ionicons 
                        name={getStatusIcon(delivery.status)} 
                        size={12} 
                        color={getStatusColor(delivery.status)} 
                      />
                      <Text style={[styles.statusText, { color: getStatusColor(delivery.status) }]}>
                        {getStatusText(delivery.status)}
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#999" />
                </View>
                
                <View style={styles.deliveryDetails}>
                  <View style={styles.detailRow}>
                    <Ionicons name="location" size={16} color="#666" />
                    <Text style={styles.detailText} numberOfLines={1}>
                      {delivery.orders?.delivery_address}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Ionicons name="person" size={16} color="#666" />
                    <Text style={styles.detailText}>
                      {delivery.orders?.profiles?.full_name || 'Customer'}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Ionicons name="time" size={16} color="#666" />
                    <Text style={styles.detailText}>
                      {delivery.timeSinceAssignment} ago
                    </Text>
                  </View>
                </View>

                {/* Accept Button for newly assigned deliveries */}
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

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionGrid}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => navigation.navigate('RiderDeliveries')}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#0033A020' }]}>
                <Ionicons name="list" size={24} color="#0033A0" />
              </View>
              <Text style={styles.actionText}>All Deliveries</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => navigation.navigate('RiderMap')}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#10B98120' }]}>
                <Ionicons name="map" size={24} color="#10B981" />
              </View>
              <Text style={styles.actionText}>Map View</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => navigation.navigate('RiderProfile')}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#F59E0B20' }]}>
                <Ionicons name="person" size={24} color="#F59E0B" />
              </View>
              <Text style={styles.actionText}>Profile</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => {
                Linking.openURL('tel:123456789');
              }}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#ED293920' }]}>
                <Ionicons name="headset" size={24} color="#ED2939" />
              </View>
              <Text style={styles.actionText}>Support</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Deliveries */}
        {recentDeliveries.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Deliveries</Text>
            {recentDeliveries.map((delivery) => (
              <View key={delivery.id} style={styles.recentItem}>
                <View style={styles.recentIcon}>
                  <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                </View>
                <View style={styles.recentInfo}>
                  <Text style={styles.recentOrder}>
                    Order #{delivery.orders?.order_number || delivery.order_id}
                  </Text>
                  <Text style={styles.recentTime}>
                    {formatTimeAgo(delivery.delivered_at)}
                  </Text>
                </View>
                <Text style={styles.recentAmount}>
                  +₱50.00
                </Text>
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
          <View style={styles.modalContent}>
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
                    Order #{selectedDelivery.orders?.order_number || selectedDelivery.order_id}
                  </Text>
                  
                  <View style={styles.modalDetailRow}>
                    <Ionicons name="location" size={18} color="#666" />
                    <Text style={styles.modalDetailText}>
                      {selectedDelivery.orders?.delivery_address}
                    </Text>
                  </View>

                  <View style={styles.modalDetailRow}>
                    <Ionicons name="person" size={18} color="#666" />
                    <Text style={styles.modalDetailText}>
                      {selectedDelivery.orders?.profiles?.full_name || 'Customer'}
                    </Text>
                  </View>

                  <View style={styles.modalDetailRow}>
                    <Ionicons name="cash" size={18} color="#666" />
                    <Text style={styles.modalDetailText}>
                      {formatCurrency(selectedDelivery.orders?.total_amount)}
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
          <View style={styles.modalContent}>
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
                * ₱50 per completed delivery
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
    fontSize: 16,
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  greetingContainer: {
    flex: 1,
  },
  greeting: {
    fontSize: 14,
    color: '#666',
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0033A0',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  onlineToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  online: {
    backgroundColor: '#10B98120',
    borderColor: '#10B981',
  },
  offline: {
    backgroundColor: '#EF444420',
    borderColor: '#EF4444',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  onlineDot: {
    backgroundColor: '#10B981',
  },
  offlineDot: {
    backgroundColor: '#EF4444',
  },
  onlineText: {
    fontSize: 12,
    fontWeight: '600',
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
  },
  avatarText: {
    fontSize: 18,
    color: '#fff',
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  statCard: {
    width: '48%',
    padding: 16,
    borderRadius: 16,
    marginBottom: 10,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#fff',
    opacity: 0.9,
  },
  performanceRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  performanceItem: {
    flex: 1,
    alignItems: 'center',
  },
  performanceDivider: {
    width: 1,
    height: '100%',
    backgroundColor: '#e9ecef',
  },
  performanceLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
  },
  performanceValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 2,
  },
  earningsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
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
    marginBottom: 12,
  },
  earningsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  earningsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 8,
  },
  earningItem: {
    flex: 1,
    alignItems: 'center',
  },
  earningLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  earningValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0033A0',
  },
  earningDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#e9ecef',
  },
  earningNote: {
    fontSize: 11,
    color: '#999',
    textAlign: 'center',
    fontStyle: 'italic',
  },
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
    fontSize: 14,
    color: '#0033A0',
    fontWeight: '600',
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
  deliveryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginRight: 12,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  deliveryDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    flex: 1,
    fontSize: 13,
    color: '#666',
  },
  acceptButton: {
    backgroundColor: '#10B981',
    padding: 12,
    borderRadius: 10,
    marginTop: 12,
    alignItems: 'center',
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionButton: {
    width: '48%',
    alignItems: 'center',
    marginBottom: 16,
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
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
  modalDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 12,
  },
  modalDetailText: {
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
});