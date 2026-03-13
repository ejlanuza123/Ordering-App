// src/screens/customer/OrderHistoryScreen.js
import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  StyleSheet, 
  ActivityIndicator, 
  TouchableOpacity,
  RefreshControl,
  StatusBar,
  Modal,
  ScrollView,
  Dimensions,
  Platform,
  Linking
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CustomAlertModal from '../../components/CustomAlertModal';
import RiderInfoCard from '../../components/RiderInfoCard';

const { width } = Dimensions.get('window');

const PAGE_SIZE = 20;

export default function OrderHistoryScreen({ navigation }) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderDetailsModal, setOrderDetailsModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState(null);
  const [showAlert, setShowAlert] = useState(false);
  const [hasMoreData, setHasMoreData] = useState(true);
  const [page, setPage] = useState(0);
  const [alertConfig, setAlertConfig] = useState({
    type: 'warning',
    title: '',
    message: ''
  });

  const filters = [
    { id: 'all', label: 'All Orders' },
    { id: 'pending', label: 'Pending' },
    { id: 'processing', label: 'Processing' },
    { id: 'delivery', label: 'Out for Delivery' },
    { id: 'completed', label: 'Completed' },
    { id: 'cancelled', label: 'Cancelled' },
  ];

  // helper removes leading zeros after prefix (e.g. ORD-000010 -> ORD-10)
  const formatOrderNumber = (num) => {
    if (!num) return '';
    if (typeof num === 'string' && num.startsWith('ORD-')) {
      const raw = num.slice(4);
      const trimmed = parseInt(raw, 10).toString();
      return `ORD-${trimmed}`;
    }
    return num;
  };

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          total_amount,
          status,
          delivery_address,
          payment_method,
          created_at,
          order_items (
            quantity,
            price_at_order,
            products (
              id,
              name,
              category,
              unit
            )
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setOrders(data || []);
      applyFilter(data || [], selectedFilter);
    } catch (error) {
      console.log('Error fetching orders:', error.message);
      setAlertConfig({
        type: 'error',
        title: 'Error',
        message: 'Failed to load orders'
      });
      setShowAlert(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchOrderDetails = async (orderId) => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          total_amount,
          status,
          delivery_address,
          payment_method,
          created_at,
          order_items (
            quantity,
            price_at_order,
            products (
              id,
              name,
              category,
              unit
            )
          ),
          deliveries (
            id,
            status,
            assigned_at,
            accepted_at,
            picked_up_at,
            delivered_at,
            failed_at,
            rider:profiles!deliveries_rider_id_fkey (
              id,
              full_name,
              phone_number
            )
          )
        `)
        .eq('id', orderId)
        .single();

      if (error) throw error;
      
      console.log('Fetched order details with deliveries:', data.deliveries);
      setSelectedOrder(data);
      setOrderDetailsModal(true);
    } catch (error) {
      console.log('Error fetching order details:', error.message);
      setAlertConfig({
        type: 'error',
        title: 'Error',
        message: 'Failed to load order details'
      });
      setShowAlert(true);
    }
  };

  const applyFilter = (ordersList, filter) => {
    if (!ordersList || ordersList.length === 0) {
      setFilteredOrders([]);
      return;
    }

    if (filter === 'all') {
      setFilteredOrders(ordersList);
    } else {
      const filtered = ordersList.filter(order => {
        const status = order.status?.toLowerCase() || '';
        switch (filter) {
          case 'pending': return status === 'pending';
          case 'processing': return status === 'processing';
          case 'delivery': return status === 'out for delivery';
          case 'completed': return status === 'completed';
          case 'cancelled': return status === 'cancelled';
          default: return true;
        }
      });
      setFilteredOrders(filtered);
    }
  };

  const handleCancelPress = (order) => {
    const status = order.status?.toLowerCase();
    if (status !== 'pending' && status !== 'processing') {
      setAlertConfig({
        type: 'warning',
        title: 'Cannot Cancel',
        message: `Orders with status "${order.status}" cannot be cancelled. Please contact support for assistance.`
      });
      setShowAlert(true);
      return;
    }
    
    setOrderToCancel(order);
    setShowCancelModal(true);
  };

  const confirmCancelOrder = async () => {
    if (!orderToCancel) return;
    
    setCancelling(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({ 
          status: 'Cancelled',
          notes: 'Cancelled by customer'
        })
        .eq('id', orderToCancel.id)
        .eq('user_id', user.id);

      if (error) throw error;

      setAlertConfig({
        type: 'success',
        title: 'Success',
        message: 'Order has been cancelled successfully.'
      });
      setShowAlert(true);
      
      fetchOrders();
      setOrderDetailsModal(false);
      setSelectedOrder(null);
    } catch (error) {
      setAlertConfig({
        type: 'error',
        title: 'Error',
        message: 'Failed to cancel order. Please try again.'
      });
      setShowAlert(true);
    } finally {
      setCancelling(false);
      setShowCancelModal(false);
      setOrderToCancel(null);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  useEffect(() => {
    applyFilter(orders, selectedFilter);
  }, [selectedFilter, orders]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  const getStatusColor = (status) => {
    switch(status?.toLowerCase()) {
      case 'pending': return '#F59E0B';
      case 'processing': return '#0033A0';
      case 'out for delivery':
      case 'out_for_delivery':
      case 'outfordelivery':
        return '#7e0083';
      case 'completed': return '#10B981';
      case 'cancelled': return '#EF4444';
      default: return '#666';
    }
  };

  const getStatusIcon = (status) => {
    switch(status?.toLowerCase()) {
      case 'pending': return 'time';
      case 'processing': return 'sync';
      case 'out for delivery':
      case 'out_for_delivery':
      case 'outfordelivery':
        return 'bicycle';
      case 'completed': return 'checkmark-circle';
      case 'cancelled': return 'close-circle';
      default: return 'help-circle';
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-PH', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
      return `${diffMins} min ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hr ago`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
    }
  };

  const calculateItemTotal = (quantity, price) => {
    return parseFloat(quantity) * parseFloat(price);
  };

  const canCancelOrder = (status) => {
    const lowerStatus = status?.toLowerCase();
    return lowerStatus === 'pending' || lowerStatus === 'processing';
  };

  const renderOrderItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.orderCard}
      onPress={() => fetchOrderDetails(item.id)}
      activeOpacity={0.8}
    >
      <View style={styles.orderHeader}>
        <View style={styles.orderInfo}>
          <Text style={styles.orderNumber}>
            {formatOrderNumber(item.order_number) || `Order #${item.id}`}
          </Text>
          <Text style={styles.orderDate}>{formatTimeAgo(item.created_at)}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
          <Ionicons 
            name={getStatusIcon(item.status)} 
            size={14} 
            color={getStatusColor(item.status)} 
          />
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {item.status}
          </Text>
        </View>
      </View>

      <View style={styles.orderItemsPreview}>
        {item.order_items && item.order_items.slice(0, 2).map((orderItem, index) => (
          <Text key={index} style={styles.previewItem} numberOfLines={1}>
            • {orderItem.products?.name || 'Product'} ({orderItem.quantity} {orderItem.products?.unit || 'unit'})
          </Text>
        ))}
        {item.order_items && item.order_items.length > 2 && (
          <Text style={styles.moreItems}>+{item.order_items.length - 2} more items</Text>
        )}
      </View>

      <View style={styles.orderFooter}>
        <View style={styles.orderTotal}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalAmount}>₱{parseFloat(item.total_amount).toFixed(2)}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#999" />
      </View>
    </TouchableOpacity>
  );

  const renderOrderDetails = () => {
    if (!selectedOrder) return null;

    return (
      <Modal
        animationType="slide"
        transparent={false}
        visible={orderDetailsModal}
        onRequestClose={() => setOrderDetailsModal(false)}
      >
        <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity 
              onPress={() => setOrderDetailsModal(false)}
              style={styles.modalBackButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="arrow-back" size={24} color="#0033A0" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Order Details</Text>
            <View style={{width: 40}} />
          </View>

          <ScrollView 
            style={styles.modalContent}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.modalContentContainer,
              { paddingBottom: insets.bottom + 20 }
            ]}
          >
            {/* Order Header */}
            <View style={styles.detailsHeader}>
              <View style={styles.detailsHeaderLeft}>
                <Text style={styles.detailsOrderNumber}>
                  {formatOrderNumber(selectedOrder.order_number) || `Order #${selectedOrder.id}`}
                </Text>
                <Text style={styles.detailsDate}>{formatDate(selectedOrder.created_at)}</Text>
              </View>
              <View style={[styles.detailsStatus, { backgroundColor: getStatusColor(selectedOrder.status) + '20' }]}>
                <Ionicons 
                  name={getStatusIcon(selectedOrder.status)} 
                  size={16} 
                  color={getStatusColor(selectedOrder.status)} 
                />
                <Text style={[styles.detailsStatusText, { color: getStatusColor(selectedOrder.status) }]}>
                  {selectedOrder.status}
                </Text>
              </View>
            </View>

            {/* Cancel Button - Show if order can be cancelled */}
            {canCancelOrder(selectedOrder.status) && (
              <TouchableOpacity 
                style={styles.cancelButtonFull}
                onPress={() => handleCancelPress(selectedOrder)}
                disabled={cancelling}
              >
                {cancelling ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="close-circle" size={20} color="#fff" />
                    <Text style={styles.cancelButtonFullText}>Cancel Order</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {/* Order Items */}
            <View style={styles.detailsSection}>
              <Text style={styles.sectionTitle}>Order Items</Text>
              {selectedOrder.order_items && selectedOrder.order_items.map((item, index) => (
                <View key={index} style={styles.detailItem}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.products?.name || 'Product'}</Text>
                    <Text style={styles.itemDetails}>
                      {item.quantity} {item.products?.unit || 'unit'} × ₱{parseFloat(item.price_at_order).toFixed(2)}
                    </Text>
                  </View>
                  <Text style={styles.itemTotal}>
                    ₱{calculateItemTotal(item.quantity, item.price_at_order).toFixed(2)}
                  </Text>
                </View>
              ))}
            </View>

            {/* Order Summary */}
            <View style={styles.detailsSection}>
              <Text style={styles.sectionTitle}>Order Summary</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal</Text>
                <Text style={styles.summaryValue}>₱{parseFloat(selectedOrder.total_amount).toFixed(2)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Delivery Fee</Text>
                <Text style={styles.summaryValue}>₱0.00</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.summaryRow}>
                <Text style={styles.totalLabel}>Total Paid</Text>
                <Text style={styles.totalValue}>₱{parseFloat(selectedOrder.total_amount).toFixed(2)}</Text>
              </View>
            </View>

            {/* Delivery Information */}
            <View style={styles.detailsSection}>
              <Text style={styles.sectionTitle}>Delivery Information</Text>
              <View style={styles.infoRow}>
                <View style={styles.infoIcon}>
                  <Ionicons name="location" size={18} color="#666" />
                </View>
                <Text style={styles.infoText}>{selectedOrder.delivery_address}</Text>
              </View>
              <View style={styles.infoRow}>
                <View style={styles.infoIcon}>
                  <Ionicons name="card" size={18} color="#666" />
                </View>
                <Text style={styles.infoText}>Payment: {selectedOrder.payment_method}</Text>
              </View>
            </View>
            
            {/* Rider Information - Show when there's a delivery record */}
            {selectedOrder.deliveries && selectedOrder.deliveries.length > 0 && (
              <RiderInfoCard delivery={selectedOrder.deliveries[0]} />
            )}

            {/* Order Timeline */}
            <View style={[styles.detailsSection, styles.lastSection]}>
              <Text style={styles.sectionTitle}>Order Timeline</Text>
              <View style={styles.timeline}>
                <View style={styles.timelineItem}>
                  <View style={[styles.timelineDot, { backgroundColor: '#10B981' }]} />
                  <View style={styles.timelineContent}>
                    <Text style={styles.timelineTitle}>Order Placed</Text>
                    <Text style={styles.timelineTime}>{formatDate(selectedOrder.created_at)}</Text>
                  </View>
                </View>
                <View style={styles.timelineItem}>
                  <View style={[styles.timelineDot, { 
                    backgroundColor: selectedOrder.status === 'Completed' ? '#10B981' : 
                                   selectedOrder.status === 'Cancelled' ? '#EF4444' : '#e9ecef' 
                  }]} />
                  <View style={styles.timelineContent}>
                    <Text style={styles.timelineTitle}>
                      {selectedOrder.status === 'Cancelled' ? 'Order Cancelled' : 'Order Delivered'}
                    </Text>
                    <Text style={styles.timelineTime}>
                      {selectedOrder.status === 'Completed' ? formatDate(selectedOrder.deliveries?.[0]?.delivered_at || selectedOrder.created_at) : 
                       selectedOrder.status === 'Cancelled' ? formatDate(selectedOrder.created_at) : 'Pending'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0033A0" />
          <Text style={styles.loadingText}>Loading orders...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={24} color="#0033A0" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Orders</Text>
          <View style={{width: 40}} />
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterWrapper}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContent}
        >
          {filters.map((filter) => (
            <TouchableOpacity
              key={filter.id}
              style={[
                styles.filterTab,
                selectedFilter === filter.id && styles.filterTabActive
              ]}
              onPress={() => setSelectedFilter(filter.id)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.filterText,
                selectedFilter === filter.id && styles.filterTextActive
              ]}>
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Orders List */}
      <FlatList
        data={filteredOrders}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderOrderItem}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 20 }
        ]}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            colors={['#0033A0']}
            tintColor="#0033A0"
          />
        }
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={80} color="#ccc" />
            <Text style={styles.emptyTitle}>
              {selectedFilter === 'all' ? 'No orders yet' : `No ${selectedFilter} orders`}
            </Text>
            <Text style={styles.emptySubtitle}>
              {selectedFilter === 'all' 
                ? 'Place your first order to see it here!' 
                : `You don't have any ${selectedFilter} orders`
              }
            </Text>
            <TouchableOpacity 
              style={styles.orderNowButton}
              onPress={() => navigation.navigate('Selection')}
              activeOpacity={0.8}
            >
              <Text style={styles.orderNowText}>Order Now</Text>
            </TouchableOpacity>
          </View>
        }
        ListHeaderComponent={
          filteredOrders.length > 0 ? (
            <View style={styles.listHeader}>
              <Text style={styles.listHeaderText}>
                {filteredOrders.length} {filteredOrders.length === 1 ? 'order' : 'orders'} found
              </Text>
            </View>
          ) : null
        }
      />

      {/* Order Details Modal */}
      {renderOrderDetails()}
      
      <CustomAlertModal
        visible={showCancelModal}
        onClose={() => {
          setShowCancelModal(false);
          setOrderToCancel(null);
        }}
        type="confirm"
        title="Cancel Order"
        message={`Are you sure you want to cancel order ${orderToCancel?.order_number || `#${orderToCancel?.id}`}? This action cannot be undone.`}
        confirmText="Yes, Cancel"
        cancelText="No, Keep It"
        showCancelButton={true}
        onConfirm={confirmCancelOrder}
        loading={cancelling}
      />

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
  header: {
    backgroundColor: '#fff',
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    height: 60,
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
  filterWrapper: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  filterContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  filterTabActive: {
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
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  listHeader: {
    paddingBottom: 12,
  },
  listHeaderText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  orderCard: {
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
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderInfo: {
    flex: 1,
    marginRight: 12,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  orderDate: {
    fontSize: 12,
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
    fontSize: 12,
    fontWeight: '600',
  },
  orderItemsPreview: {
    marginBottom: 12,
  },
  previewItem: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  moreItems: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f4ff',
  },
  orderTotal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  totalLabel: {
    fontSize: 14,
    color: '#666',
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ED2939',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  orderNowButton: {
    backgroundColor: '#0033A0',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 25,
    elevation: 2,
    shadowColor: '#0033A0',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  orderNowText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  modalHeader: {
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
    height: 60,
  },
  modalBackButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f4ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalContent: {
    flex: 1,
  },
  modalContentContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  detailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  detailsHeaderLeft: {
    flex: 1,
    marginRight: 12,
  },
  detailsOrderNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  detailsDate: {
    fontSize: 12,
    color: '#666',
  },
  detailsStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 4,
  },
  detailsStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cancelButtonFull: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    gap: 8,
    elevation: 3,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  cancelButtonFullText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  detailsSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  lastSection: {
    marginBottom: 0,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f4ff',
  },
  itemInfo: {
    flex: 1,
    marginRight: 12,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  itemDetails: {
    fontSize: 12,
    color: '#666',
  },
  itemTotal: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  divider: {
    height: 1,
    backgroundColor: '#e9ecef',
    marginVertical: 12,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ED2939',
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  infoIcon: {
    width: 24,
    alignItems: 'center',
    marginRight: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  timeline: {
    marginTop: 4,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
    marginTop: 4,
  },
  timelineContent: {
    flex: 1,
  },
  timelineTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  timelineTime: {
    fontSize: 12,
    color: '#666',
  },
});