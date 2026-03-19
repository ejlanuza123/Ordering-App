// src/screens/customer/RiderReviewsScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  StatusBar,
  RefreshControl,
  ScrollView,
  Dimensions,
  Modal,
  TextInput,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useRiderRatings } from '../../context/RiderRatingContext';
import CustomAlertModal from '../../components/CustomAlertModal';

const { width } = Dimensions.get('window');

export default function RiderReviewsScreen({ navigation }) {
  const { user } = useAuth();
  const { rateRider, hasUserRated, getUserRating } = useRiderRatings();
  const insets = useSafeAreaInsets();
  const [deliveries, setDeliveries] = useState([]);
  const [filteredDeliveries, setFilteredDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('all'); // all, pending, submitted
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingDelivery, setEditingDelivery] = useState(null);
  const [editRating, setEditRating] = useState(0);
  const [editComment, setEditComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    type: 'success',
    title: '',
    message: ''
  });
  const [userHasRated, setUserHasRated] = useState(false);
  const [existingRating, setExistingRating] = useState(null);

  const filters = [
    { id: 'all', label: 'All Deliveries' },
    { id: 'pending', label: 'Pending Rating' },
    { id: 'submitted', label: 'Rated' },
  ];

  useEffect(() => {
    fetchDeliveries();
  }, []);

  useEffect(() => {
    applyFilter(deliveries, selectedFilter);
  }, [selectedFilter, deliveries]);

  const fetchDeliveries = async () => {
    try {
      setLoading(true);

      // Fetch all completed/delivered orders with delivery and rider info
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          status,
          total_amount,
          created_at,
          deliveries (
            id,
            status,
            assigned_at,
            picked_up_at,
            delivered_at,
            rider_id,
            rider:profiles!deliveries_rider_id_fkey (
              id,
              full_name,
              avatar_url
            )
          )
        `)
        .eq('user_id', user.id)
        .in('status', ['Completed', 'completed']);

      if (ordersError) throw ordersError;

      // Process deliveries - only keep delivered ones with riders
      const allDeliveries = [];
      for (const order of ordersData || []) {
        for (const delivery of order.deliveries || []) {
          if (delivery.status === 'delivered' && delivery.rider_id) {
            // Check if user has rated this delivery
            const hasRated = await hasUserRated(delivery.id);
            let existingRating = null;
            if (hasRated) {
              existingRating = await getUserRating(delivery.id);
            }

            allDeliveries.push({
              ...delivery,
              order_id: order.id,
              order_number: order.order_number,
              total_amount: order.total_amount,
              created_at: order.created_at,
              submitted: !!existingRating,
              rating: existingRating?.rating || 0,
              comment: existingRating?.comment || null,
              ratingId: existingRating?.id || null,
            });
          }
        }
      }

      setDeliveries(allDeliveries);
    } catch (error) {
      console.error('Error fetching deliveries:', error);
      setAlertConfig({
        type: 'error',
        title: 'Error',
        message: 'Failed to load deliveries.'
      });
      setShowAlert(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const applyFilter = (deliveriesList, filter) => {
    if (!deliveriesList || deliveriesList.length === 0) {
      setFilteredDeliveries([]);
      return;
    }

    let filtered = deliveriesList;
    if (filter === 'pending') {
      filtered = deliveriesList.filter(d => !d.submitted);
    } else if (filter === 'submitted') {
      filtered = deliveriesList.filter(d => d.submitted);
    }

    setFilteredDeliveries(filtered);
  };

  const handleEditReview = async (delivery) => {
    setEditingDelivery(delivery);
    setEditRating(delivery.rating || 0);
    setEditComment(delivery.comment || '');
    setUserHasRated(delivery.submitted);
    setExistingRating(delivery.submitted ? { id: delivery.ratingId } : null);
    setShowEditModal(true);
  };

  const submitRating = async () => {
    if (editRating === 0) {
      setAlertConfig({
        type: 'warning',
        title: 'Rating Required',
        message: 'Please select a star rating.'
      });
      setShowAlert(true);
      return;
    }

    if (!editingDelivery || !editingDelivery.rider_id) {
      return;
    }

    setSubmitting(true);
    try {
      const result = await rateRider(
        editingDelivery.rider_id,
        editingDelivery.id,
        editRating,
        editComment
      );

      if (result.success) {
        setAlertConfig({
          type: 'success',
          title: 'Thank you!',
          message: userHasRated ? 'Your rating has been updated.' : 'Your rating has been submitted.'
        });
        setShowAlert(true);
        setShowEditModal(false);
        fetchDeliveries();
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error submitting rating:', error);
      setAlertConfig({
        type: 'error',
        title: 'Error',
        message: 'Failed to submit rating. Please try again.'
      });
      setShowAlert(true);
    } finally {
      setSubmitting(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchDeliveries();
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    });
  };

  const renderDeliveryItem = ({ item }) => (
    <TouchableOpacity
      style={styles.deliveryCard}
      onPress={() => handleEditReview(item)}
      activeOpacity={0.7}
    >
      {item.rider?.avatar_url && (
        <Image
          source={{ uri: item.rider.avatar_url }}
          style={styles.riderAvatar}
        />
      )}

      <View style={styles.deliveryContent}>
        <View style={styles.deliveryTop}>
          <View style={styles.riderInfo}>
            <Text style={styles.riderName} numberOfLines={1}>
              {item.rider?.full_name || 'Unknown Rider'}
            </Text>
            <Text style={styles.orderNumber}>
              Order #{item.order_number}
            </Text>
          </View>
          <View style={[
            styles.statusBadge,
            item.submitted ? styles.submittedBadge : styles.pendingBadge
          ]}>
            <Ionicons
              name={item.submitted ? 'checkmark-circle' : 'pencil'}
              size={14}
              color={item.submitted ? '#10B981' : '#F59E0B'}
            />
            <Text style={[
              styles.statusBadgeText,
              item.submitted ? styles.submittedText : styles.pendingText
            ]}>
              {item.submitted ? 'Rated' : 'Pending'}
            </Text>
          </View>
        </View>

        {/* Star Rating Display */}
        {item.submitted && item.rating > 0 && (
          <View style={styles.ratingDisplay}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Ionicons
                key={star}
                name={star <= item.rating ? 'star' : 'star-outline'}
                size={14}
                color="#F59E0B"
                style={{ marginRight: 3 }}
              />
            ))}
          </View>
        )}

        {/* Comment Preview */}
        {item.submitted && item.comment && (
          <Text style={styles.commentPreview} numberOfLines={1}>
            {item.comment}
          </Text>
        )}

        {/* Delivery Date */}
        <Text style={styles.deliveryDate}>
          Delivered {formatDate(item.delivered_at)}
        </Text>
      </View>

      <Ionicons name="chevron-forward" size={20} color="#999" />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0033A0" />
          <Text style={styles.loadingText}>Loading deliveries...</Text>
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
          <Text style={styles.headerTitle}>Rate Riders</Text>
          <View style={{ width: 40 }} />
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

      {/* Deliveries List */}
      <FlatList
        data={filteredDeliveries}
        keyExtractor={(item) => `delivery-${item.id}`}
        renderItem={renderDeliveryItem}
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
            <Ionicons name="bicycle-outline" size={80} color="#ccc" />
            <Text style={styles.emptyTitle}>No deliveries to rate</Text>
            <Text style={styles.emptySubtitle}>
              {selectedFilter === 'all'
                ? 'Your completed deliveries will appear here'
                : selectedFilter === 'pending'
                  ? 'All your deliveries have been rated'
                  : 'You have not rated any deliveries yet'}
            </Text>
          </View>
        }
      />

      {/* Rating Modal */}
      <Modal
        visible={showEditModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Rate This Rider</Text>
              <TouchableOpacity
                onPress={() => setShowEditModal(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color="#0033A0" />
              </TouchableOpacity>
            </View>

            {editingDelivery?.rider && (
              <Text style={styles.riderNameModal}>
                {editingDelivery.rider.full_name}
              </Text>
            )}

            {/* Star Rating Selector */}
            <View style={styles.starRatingContainer}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setEditRating(star)}
                  style={styles.starButton}
                >
                  <Ionicons
                    name={star <= editRating ? 'star' : 'star-outline'}
                    size={40}
                    color={star <= editRating ? '#F59E0B' : '#ccc'}
                  />
                </TouchableOpacity>
              ))}
            </View>

            {/* Rating Label */}
            {editRating > 0 && (
              <Text style={styles.ratingLabel}>
                {editRating === 1 && 'Poor'}
                {editRating === 2 && 'Fair'}
                {editRating === 3 && 'Good'}
                {editRating === 4 && 'Very Good'}
                {editRating === 5 && 'Excellent'}
              </Text>
            )}

            {/* Comment Input */}
            <View style={styles.commentInputContainer}>
              <Text style={styles.commentLabel}>Comments (optional)</Text>
              <TextInput
                style={styles.commentInput}
                placeholder="Share your delivery experience..."
                placeholderTextColor="#999"
                multiline
                numberOfLines={4}
                maxLength={500}
                value={editComment}
                onChangeText={setEditComment}
                editable={!submitting}
              />
              <Text style={styles.commentLength}>
                {editComment.length}/500
              </Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.actionButton, styles.cancelButton]}
                onPress={() => setShowEditModal(false)}
                disabled={submitting}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.submitButton]}
                onPress={submitRating}
                disabled={submitting || editRating === 0}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>
                    {userHasRated ? 'Update Rating' : 'Submit Rating'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  filterWrapper: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  filterContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f4ff',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  filterTabActive: {
    backgroundColor: '#0033A0',
    borderColor: '#0033A0',
  },
  filterText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#fff',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  deliveryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  riderAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f0f4ff',
    marginRight: 12,
  },
  deliveryContent: {
    flex: 1,
  },
  deliveryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  riderInfo: {
    flex: 1,
    marginRight: 8,
  },
  riderName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  orderNumber: {
    fontSize: 12,
    color: '#666',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  pendingBadge: {
    backgroundColor: '#FEF3C7',
  },
  submittedBadge: {
    backgroundColor: '#DCFCE7',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  pendingText: {
    color: '#B45309',
  },
  submittedText: {
    color: '#166534',
  },
  ratingDisplay: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  commentPreview: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
    marginBottom: 4,
  },
  deliveryDate: {
    fontSize: 10,
    color: '#999',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
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
    paddingHorizontal: 20,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  riderNameModal: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
    fontWeight: '500',
  },
  starRatingContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  starButton: {
    padding: 4,
  },
  ratingLabel: {
    textAlign: 'center',
    fontSize: 14,
    color: '#F59E0B',
    fontWeight: '600',
    marginBottom: 16,
  },
  commentInputContainer: {
    marginBottom: 20,
  },
  commentLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  commentInput: {
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#333',
    textAlignVertical: 'top',
    marginBottom: 4,
  },
  commentLength: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  actionButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f4ff',
    borderWidth: 1,
    borderColor: '#0033A0',
  },
  cancelButtonText: {
    color: '#0033A0',
    fontSize: 14,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#0033A0',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
