import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  StyleSheet, 
  ActivityIndicator, 
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  Modal,
  ScrollView,
  Dimensions
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

export default function OrderHistoryScreen({ navigation }) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderDetailsModal, setOrderDetailsModal] = useState(false);

  const filters = [
    { id: 'all', label: 'All Orders' },
    { id: 'pending', label: 'Pending' },
    { id: 'processing', label: 'Processing' },
    { id: 'delivery', label: 'Out for Delivery' },
    { id: 'completed', label: 'Completed' },
    { id: 'cancelled', label: 'Cancelled' },
  ];

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
          special_instructions,
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
      
      // Add order_number if not present (for backward compatibility)
      const ordersWithNumbers = data.map((order, index) => ({
        ...order,
        order_number: order.order_number || `ORD${String(order.id).padStart(6, '0')}`
      }));
      
      setOrders(ordersWithNumbers);
      applyFilter(ordersWithNumbers, selectedFilter);
    } catch (error) {
      console.log('Error fetching orders:', error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const applyFilter = (ordersList, filter) => {
    if (filter === 'all') {
      setFilteredOrders(ordersList);
    } else {
      const filtered = ordersList.filter(order => {
        const status = order.status.toLowerCase();
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
    switch(status.toLowerCase()) {
      case 'pending': return '#F59E0B'; // Orange
      case 'processing': return '#0033A0'; // Petron Blue
      case 'out for delivery': return '#10B981'; // Green
      case 'completed': return '#333'; // Dark Gray
      case 'cancelled': return '#EF4444'; // Red
      default: return '#666';
    }
  };

  const getStatusIcon = (status) => {
    switch(status.toLowerCase()) {
      case 'pending': return 'time';
      case 'processing': return 'sync';
      case 'out for delivery': return 'bicycle';
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

  const openOrderDetails = (order) => {
    setSelectedOrder(order);
    setOrderDetailsModal(true);
  };

  const renderOrderItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.orderCard}
      onPress={() => openOrderDetails(item)}
      activeOpacity={0.8}
    >
      <View style={styles.orderHeader}>
        <View>
          <Text style={styles.orderNumber}>Order #{item.order_number}</Text>
          <Text style={styles.orderDate}>{formatTimeAgo(item.created_at)}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
          <Ionicons 
            name={getStatusIcon(item.status)} 
            size={14} 
            color={getStatusColor(item.status)} 
            style={{ marginRight: 4 }}
          />
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {item.status}
          </Text>
        </View>
      </View>

      <View style={styles.orderItemsPreview}>
        {item.order_items.slice(0, 2).map((orderItem, index) => (
          <Text key={index} style={styles.previewItem} numberOfLines={1}>
            • {orderItem.products.name} ({orderItem.quantity} {orderItem.products.unit})
          </Text>
        ))}
        {item.order_items.length > 2 && (
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
        transparent={true}
        visible={orderDetailsModal}
        onRequestClose={() => setOrderDetailsModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity 
              onPress={() => setOrderDetailsModal(false)}
              style={styles.modalBackButton}
            >
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Order Details</Text>
            <View style={{width: 40}} />
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Order Header */}
            <View style={styles.detailsHeader}>
              <View>
                <Text style={styles.detailsOrderNumber}>Order #{selectedOrder.order_number}</Text>
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

            {/* Order Items */}
            <View style={styles.detailsSection}>
              <Text style={styles.sectionTitle}>Order Items</Text>
              {selectedOrder.order_items.map((item, index) => (
                <View key={index} style={styles.detailItem}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.products.name}</Text>
                    <Text style={styles.itemDetails}>
                      {item.quantity} {item.products.unit} @ ₱{parseFloat(item.price_at_order).toFixed(2)}
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
                <Ionicons name="location" size={18} color="#666" />
                <Text style={styles.infoText}>{selectedOrder.delivery_address}</Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="card" size={18} color="#666" />
                <Text style={styles.infoText}>Payment: {selectedOrder.payment_method}</Text>
              </View>
              {selectedOrder.special_instructions && (
                <View style={styles.infoRow}>
                  <Ionicons name="document-text" size={18} color="#666" />
                  <Text style={styles.infoText}>Note: {selectedOrder.special_instructions}</Text>
                </View>
              )}
            </View>

            {/* Order Timeline */}
            <View style={styles.detailsSection}>
              <Text style={styles.sectionTitle}>Order Timeline</Text>
              <View style={styles.timeline}>
                <View style={styles.timelineItem}>
                  <View style={[styles.timelineDot, { backgroundColor: '#10B981' }]} />
                  <View>
                    <Text style={styles.timelineTitle}>Order Placed</Text>
                    <Text style={styles.timelineTime}>{formatDate(selectedOrder.created_at)}</Text>
                  </View>
                </View>
                <View style={styles.timelineItem}>
                  <View style={[styles.timelineDot, { 
                    backgroundColor: selectedOrder.status === 'Completed' ? '#10B981' : '#e9ecef' 
                  }]} />
                  <View>
                    <Text style={styles.timelineTitle}>Order Delivered</Text>
                    <Text style={styles.timelineTime}>
                      {selectedOrder.status === 'Completed' ? formatDate(selectedOrder.created_at) : 'In progress...'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Actions */}
            {selectedOrder.status === 'Pending' || selectedOrder.status === 'Processing' ? (
              <View style={styles.actionButtons}>
                <TouchableOpacity 
                  style={styles.cancelButton}
                  onPress={() => {
                    Alert.alert(
                      'Cancel Order',
                      'Are you sure you want to cancel this order?',
                      [
                        { text: 'No', style: 'cancel' },
                        { 
                          text: 'Yes, Cancel', 
                          style: 'destructive',
                          onPress: async () => {
                            // Implement cancel order logic here
                            setOrderDetailsModal(false);
                            Alert.alert('Order Cancelled', 'Your order has been cancelled.');
                          }
                        }
                      ]
                    );
                  }}
                >
                  <Ionicons name="close-circle" size={20} color="#EF4444" />
                  <Text style={styles.cancelButtonText}>Cancel Order</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.supportButton}
                  onPress={() => {
                    Alert.alert('Contact Support', 'Call our support hotline: (02) 8888-9999');
                  }}
                >
                  <Ionicons name="call" size={20} color="#0033A0" />
                  <Text style={styles.supportButtonText}>Contact Support</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#0033A0" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Orders</Text>
        <View style={{width: 40}} />
      </View>

      {/* Filter Tabs */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
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

      {/* Orders List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0033A0" />
          <Text style={styles.loadingText}>Loading orders...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredOrders}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderOrderItem}
          contentContainerStyle={styles.listContent}
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
              <Ionicons name="receipt" size={80} color="#ccc" />
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
      )}

      {/* Order Details Modal */}
      {renderOrderDetails()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 15,
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
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0033A0',
  },
  // Filter Tabs
  filterContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    backgroundColor: '#fff',
  },
  filterContent: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: '#f8f9fa',
  },
  filterTabActive: {
    backgroundColor: '#0033A0',
  },
  filterText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#fff',
  },
  // Loading
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
  // List
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  listHeader: {
    paddingVertical: 15,
  },
  listHeaderText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  // Order Card
  orderCard: {
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
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
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
    alignItems: 'baseline',
  },
  totalLabel: {
    fontSize: 14,
    color: '#666',
    marginRight: 8,
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ED2939',
  },
  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    marginTop: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 20,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 25,
    lineHeight: 20,
  },
  orderNowButton: {
    backgroundColor: '#0033A0',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
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
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  modalBackButton: {
    padding: 4,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  // Order Details Styles
  detailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginTop: 20,
    marginBottom: 16,
    elevation: 2,
  },
  detailsOrderNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  detailsDate: {
    fontSize: 13,
    color: '#666',
  },
  detailsStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  detailsStatusText: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
  detailsSection: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    elevation: 2,
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
  },
  itemName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  itemDetails: {
    fontSize: 13,
    color: '#666',
  },
  itemTotal: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
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
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ED2939',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    marginLeft: 12,
    lineHeight: 20,
  },
  timeline: {
    marginTop: 8,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
    marginTop: 4,
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
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#EF4444',
    padding: 14,
    borderRadius: 12,
    marginRight: 8,
  },
  cancelButtonText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  supportButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#0033A0',
    padding: 14,
    borderRadius: 12,
    marginLeft: 8,
  },
  supportButtonText: {
    color: '#0033A0',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
});