// src/screens/customer/ProductReviewsScreen.js
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
import CustomAlertModal from '../../components/CustomAlertModal';

const { width } = Dimensions.get('window');

export default function ProductReviewsScreen({ navigation }) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [reviews, setReviews] = useState([]);
  const [filteredReviews, setFilteredReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('all'); // all, pending, submitted
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingReview, setEditingReview] = useState(null);
  const [editRating, setEditRating] = useState(0);
  const [editComment, setEditComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    type: 'success',
    title: '',
    message: ''
  });

  const filters = [
    { id: 'all', label: 'All Reviews' },
    { id: 'pending', label: 'Pending Review' },
    { id: 'submitted', label: 'Submitted' },
  ];

  useEffect(() => {
    fetchReviews();
  }, []);

  useEffect(() => {
    applyFilter(reviews, selectedFilter);
  }, [selectedFilter, reviews]);

  const fetchReviews = async () => {
    try {
      setLoading(true);

      // Fetch all products the user ordered
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          order_items (
            product_id,
            products (
              id,
              name,
              category,
              image_url
            )
          )
        `)
        .eq('user_id', user.id);

      if (ordersError) throw ordersError;

      // Get unique product IDs
      const productIds = new Set();
      ordersData?.forEach(order => {
        order.order_items?.forEach(item => {
          if (item.product_id) productIds.add(item.product_id);
        });
      });

      if (productIds.size === 0) {
        setReviews([]);
        setFilteredReviews([]);
        setLoading(false);
        return;
      }

      // Fetch all reviews for these products
      const { data: reviewsData, error: reviewsError } = await supabase
        .from('product_reviews')
        .select(`
          id,
          product_id,
          rating,
          comment,
          created_at,
          products (
            id,
            name,
            category,
            image_url
          )
        `)
        .in('product_id', Array.from(productIds))
        .eq('user_id', user.id);

      if (reviewsError) throw reviewsError;

      // Build complete review list with pending and submitted reviews
      const reviewMap = new Map();
      reviewsData?.forEach(review => {
        reviewMap.set(review.product_id, { ...review, submitted: true });
      });

      // Add pending reviews (products ordered but not reviewed)
      // Use a Set to track which product IDs we've already added
      const pendingProductIds = new Set();
      const allProductsForReview = [];
      
      ordersData?.forEach(order => {
        order.order_items?.forEach(item => {
          if (item.product_id && !reviewMap.has(item.product_id) && !pendingProductIds.has(item.product_id)) {
            pendingProductIds.add(item.product_id);
            allProductsForReview.push({
              product_id: item.product_id,
              products: item.products,
              submitted: false,
              id: null,
              rating: 0,
              comment: null,
              created_at: null,
            });
          }
        });
      });

      // Combine submitted and pending reviews
      const combinedReviews = [
        ...Array.from(reviewMap.values()),
        ...allProductsForReview
      ];

      setReviews(combinedReviews);
    } catch (error) {
      console.error('Error fetching reviews:', error);
      setAlertConfig({
        type: 'error',
        title: 'Error',
        message: 'Failed to load your reviews.'
      });
      setShowAlert(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const applyFilter = (reviewsList, filter) => {
    if (!reviewsList || reviewsList.length === 0) {
      setFilteredReviews([]);
      return;
    }

    let filtered = reviewsList;
    if (filter === 'pending') {
      filtered = reviewsList.filter(r => !r.submitted);
    } else if (filter === 'submitted') {
      filtered = reviewsList.filter(r => r.submitted);
    }

    setFilteredReviews(filtered);
  };

  const handleEditReview = (review) => {
    setEditingReview(review);
    setEditRating(review.rating || 0);
    setEditComment(review.comment || '');
    setShowEditModal(true);
  };

  const submitReview = async () => {
    if (editRating === 0) {
      setAlertConfig({
        type: 'warning',
        title: 'Rating Required',
        message: 'Please select a star rating.'
      });
      setShowAlert(true);
      return;
    }

    setSubmitting(true);
    try {
      if (editingReview.submitted && editingReview.id) {
        // Update existing review
        const { error } = await supabase
          .from('product_reviews')
          .update({
            rating: editRating,
            comment: editComment || null,
          })
          .eq('id', editingReview.id)
          .eq('user_id', user.id);

        if (error) throw error;

        setAlertConfig({
          type: 'success',
          title: 'Success',
          message: 'Your review has been updated.'
        });
      } else {
        // Create new review
        const { error } = await supabase
          .from('product_reviews')
          .insert([{
            product_id: editingReview.product_id,
            user_id: user.id,
            rating: editRating,
            comment: editComment || null,
          }]);

        if (error) throw error;

        setAlertConfig({
          type: 'success',
          title: 'Thank you!',
          message: 'Your review has been submitted.'
        });
      }

      setShowAlert(true);
      setShowEditModal(false);
      fetchReviews();
    } catch (error) {
      console.error('Error submitting review:', error);
      setAlertConfig({
        type: 'error',
        title: 'Error',
        message: 'Failed to submit review. Please try again.'
      });
      setShowAlert(true);
    } finally {
      setSubmitting(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchReviews();
  };

  const renderReviewItem = ({ item }) => (
    <TouchableOpacity
      style={styles.reviewCard}
      onPress={() => handleEditReview(item)}
      activeOpacity={0.7}
    >
      {item.products?.image_url && (
        <View style={styles.productImageContainer}>
          <Image
            source={{ uri: item.products.image_url }}
            style={styles.productImage}
          />
        </View>
      )}

      <View style={styles.reviewContent}>
        <View style={styles.reviewTop}>
          <View style={styles.productInfo}>
            <Text style={styles.productName} numberOfLines={2}>
              {item.products?.name || 'Product'}
            </Text>
            <Text style={styles.productCategory}>
              {item.products?.category || 'Uncategorized'}
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
              {item.submitted ? 'Submitted' : 'Pending'}
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
                size={16}
                color="#F59E0B"
                style={{ marginRight: 4 }}
              />
            ))}
          </View>
        )}

        {/* Comment Preview */}
        {item.submitted && item.comment && (
          <Text style={styles.commentPreview} numberOfLines={2}>
            {item.comment}
          </Text>
        )}

        {/* Review Date */}
        {item.submitted && item.created_at && (
          <Text style={styles.reviewDate}>
            {new Date(item.created_at).toLocaleDateString()}
          </Text>
        )}
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
          <Text style={styles.loadingText}>Loading your reviews...</Text>
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
          <Text style={styles.headerTitle}>Product Reviews</Text>
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

      {/* Reviews List */}
      <FlatList
        data={filteredReviews}
        keyExtractor={(item) => `product-${item.product_id}-${item.id || 'pending'}`}
        renderItem={renderReviewItem}
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
            <Ionicons name="star-outline" size={80} color="#ccc" />
            <Text style={styles.emptyTitle}>No reviews yet</Text>
            <Text style={styles.emptySubtitle}>
              {selectedFilter === 'all'
                ? 'Product reviews will appear here'
                : selectedFilter === 'pending'
                  ? 'You have no pending reviews'
                  : 'You have not submitted any reviews'}
            </Text>
          </View>
        }
      />

      {/* Edit Review Modal */}
      <Modal
        visible={showEditModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingReview?.submitted ? 'Edit Review' : 'Add Review'}
              </Text>
              <TouchableOpacity
                onPress={() => setShowEditModal(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color="#0033A0" />
              </TouchableOpacity>
            </View>

            {editingReview?.products && (
              <Text style={styles.productNameModal}>
                {editingReview.products.name}
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
                placeholder="Share your experience with this product..."
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
                onPress={submitReview}
                disabled={submitting || editRating === 0}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>
                    {editingReview?.submitted ? 'Update Review' : 'Submit Review'}
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
  reviewCard: {
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
  productImageContainer: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#f0f4ff',
    marginRight: 12,
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  reviewContent: {
    flex: 1,
  },
  reviewTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  productInfo: {
    flex: 1,
    marginRight: 8,
  },
  productName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  productCategory: {
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
    marginBottom: 8,
  },
  commentPreview: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
    marginBottom: 4,
  },
  reviewDate: {
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
  productNameModal: {
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
