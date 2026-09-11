import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNotifications } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { formatDistanceToNow } from '../../utils/dateFormatter';
import CustomAlertModal from '../../components/CustomAlertModal';

export default function NotificationsScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { role } = useAuth();
  const { colors, isDarkMode } = useTheme();
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
    loadNotifications,
  } = useNotifications();

  const [refreshing, setRefreshing] = useState(false);
  const [showClearAllModal, setShowClearAllModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [notificationToDelete, setNotificationToDelete] = useState(null);
  const [showAlert, setShowAlert] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    type: 'warning',
    title: '',
    message: ''
  });

  const [selectedBroadcast, setSelectedBroadcast] = useState(null);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);

  // Automatically open broadcast detail modal if navigated here with selectedBroadcast param
  useEffect(() => {
    if (route?.params?.selectedBroadcast) {
      const broadcast = route.params.selectedBroadcast;
      setSelectedBroadcast(broadcast);
      setShowBroadcastModal(true);
      if (broadcast.id && !broadcast.is_read) {
        markAsRead(broadcast.id);
      }
    }
  }, [route?.params?.selectedBroadcast]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  };

  const handleNotificationPress = async (notification) => {
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }

    const payload = notification?.data || {};
    const payloadOrderId = payload?.order_id ?? payload?.orderId ?? null;
    const payloadDeliveryId = payload?.delivery_id ?? payload?.deliveryId ?? null;
    const payloadConversationId = payload?.conversation_id ?? payload?.conversationId ?? null;

    const isBroadcast =
      ['broadcast', 'announcement', 'weather_advisory', 'emergency'].includes(notification?.type) ||
      Boolean(payload?.broadcast_id) ||
      (notification?.type === 'promo' && !payloadOrderId);

    if (isBroadcast) {
      setSelectedBroadcast(notification);
      setShowBroadcastModal(true);
      return;
    }

    const isChatNotification = [
      'chat',
      'chat_message',
      'message',
      'order_chat',
    ].includes(notification?.type);

    if (isChatNotification) {
      if (role === 'rider') {
        if (payloadConversationId) {
          navigation.navigate('ChatThread', { conversationId: payloadConversationId });
        } else {
          navigation.navigate('ChatList');
        }
      } else {
        if (payloadConversationId) {
          navigation.navigate('ChatThread', { conversationId: payloadConversationId });
        } else {
          navigation.navigate('ChatList');
        }
      }
      return;
    }

    if (payloadOrderId) {
      if (role === 'rider') {
        navigation.navigate('RiderDeliveries');
      } else {
        navigation.navigate('OrderHistory');
      }
      return;
    }

    if (payloadDeliveryId && role === 'rider') {
      navigation.navigate('RiderDeliveries');
      return;
    }

    if (role === 'rider') {
      navigation.navigate('RiderDashboard');
    } else {
      navigation.navigate('Home');
    }
  };

  const handleDeletePress = (notification) => {
    setNotificationToDelete(notification);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (notificationToDelete) {
      await deleteNotification(notificationToDelete.id);
      setShowDeleteModal(false);
      setNotificationToDelete(null);
    }
  };

  const handleClearAllPress = () => {
    setShowClearAllModal(true);
  };

  const confirmClearAll = async () => {
    await clearAll();
    setShowClearAllModal(false);
    setAlertConfig({
      type: 'success',
      title: 'Success',
      message: 'All notifications cleared'
    });
    setShowAlert(true);
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'broadcast':
      case 'announcement':
        return { name: 'megaphone', color: colors.primary };
      case 'weather_advisory':
        return { name: 'rainy', color: '#EAB308' };
      case 'emergency':
        return { name: 'alert-circle', color: '#EF4444' };
      case 'chat':
      case 'chat_message':
      case 'message':
      case 'order_chat':
        return { name: 'chatbubbles', color: colors.primary };
      case 'order_status':
        return { name: 'sync', color: colors.primary };
      case 'order_delivered':
        return { name: 'checkmark-circle', color: '#10B981' };
      case 'order_cancelled':
        return { name: 'close-circle', color: '#EF4444' };
      case 'promo':
        return { name: 'pricetag', color: '#F59E0B' };
      default:
        return { name: 'notifications', color: colors.textSecondary };
    }
  };

  const formatTime = (timestamp) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch (error) {
      return 'some time ago';
    }
  };

  const formatFullDateTime = (dateString) => {
    if (!dateString) return '';
    try {
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleString('en-PH', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch (e) {
      return '';
    }
  };

  const getBroadcastCategoryInfo = (type, data) => {
    const cat = data?.category || type || 'announcement';
    switch (cat) {
      case 'weather_advisory':
        return {
          label: 'Weather & Operations',
          icon: 'rainy',
          color: '#EAB308',
          bg: isDarkMode ? 'rgba(234, 179, 8, 0.15)' : '#FEF9C3',
          borderColor: isDarkMode ? 'rgba(234, 179, 8, 0.3)' : '#FDE047',
        };
      case 'promo':
        return {
          label: 'Special Promotion',
          icon: 'flame',
          color: '#EC4899',
          bg: isDarkMode ? 'rgba(236, 72, 153, 0.15)' : '#FCE7F3',
          borderColor: isDarkMode ? 'rgba(236, 72, 153, 0.3)' : '#FBCFE8',
        };
      case 'emergency':
        return {
          label: 'Urgent Advisory',
          icon: 'alert-circle',
          color: '#EF4444',
          bg: isDarkMode ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2',
          borderColor: isDarkMode ? 'rgba(239, 68, 68, 0.3)' : '#FECACA',
        };
      case 'broadcast':
      case 'announcement':
      default:
        return {
          label: 'Official Announcement',
          icon: 'megaphone',
          color: colors.primary,
          bg: isDarkMode ? 'rgba(59, 130, 246, 0.15)' : '#DBEAFE',
          borderColor: isDarkMode ? 'rgba(59, 130, 246, 0.3)' : '#BFDBFE',
        };
    }
  };

  const handleShareBroadcast = async () => {
    if (!selectedBroadcast) return;
    try {
      await Share.share({
        title: selectedBroadcast.title || 'Broadcast Announcement',
        message: `${selectedBroadcast.title}\n\n${selectedBroadcast.message}\n\n— Broadcasted via Petron San Pedro`,
      });
    } catch (err) {
      console.warn('Failed to share broadcast:', err);
    }
  };

  const handleModalAction = () => {
    setShowBroadcastModal(false);
    if (role === 'rider') {
      navigation.navigate('RiderDeliveries');
    } else {
      navigation.navigate('Home');
    }
  };

  const renderNotification = ({ item }) => {
    const icon = getNotificationIcon(item.type);

    return (
      <TouchableOpacity
        style={[
          styles.notificationItem,
          { backgroundColor: colors.surface, borderBottomColor: colors.border },
          !item.is_read && { backgroundColor: isDarkMode ? '#1E293B' : '#F0F7FF' }
        ]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.iconContainer, { backgroundColor: `${icon.color}20` }]}>
          <Ionicons name={icon.name} size={24} color={icon.color} />
        </View>

        <View style={styles.notificationContent}>
          <View style={styles.notificationHeader}>
            <Text style={[styles.notificationTitle, { color: colors.textPrimary }, !item.is_read && { color: colors.primary }]}>
              {item.title}
            </Text>
            <Text style={[styles.notificationTime, { color: colors.textMuted }]}>{formatTime(item.created_at)}</Text>
          </View>

          <Text style={[styles.notificationMessage, { color: colors.textSecondary }]} numberOfLines={2}>
            {item.message}
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => handleDeletePress(item)}
          style={styles.deleteButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={colors.primary} />
          </TouchableOpacity>

          <View style={styles.headerTitleContainer}>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Notifications</Text>
            {unreadCount > 0 && (
              <Text style={styles.unreadBadge}>{unreadCount} unread</Text>
            )}
          </View>

          {notifications.length > 0 && (
            <TouchableOpacity
              onPress={handleClearAllPress}
              style={styles.clearButton}
            >
              <Ionicons name="trash-outline" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Mark All as Read Button (if there are unread) */}
      {unreadCount > 0 && (
        <TouchableOpacity 
          style={[styles.markAllButton, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]} 
          onPress={markAllAsRead}
        >
          <Ionicons name="checkmark-done" size={18} color={colors.primary} />
          <Text style={[styles.markAllText, { color: colors.primary }]}>Mark all as read</Text>
        </TouchableOpacity>
      )}

      {/* Notifications List */}
      {loading && notifications.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading notifications...</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderNotification}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 20 }
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="notifications-off-outline" size={80} color={colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No notifications yet</Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                We'll notify you when there are updates about your orders
              </Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Modals */}
      <CustomAlertModal
        visible={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        type="confirm"
        title="Delete Notification"
        message="Are you sure you want to delete this notification?"
        confirmText="Delete"
        cancelText="Cancel"
        showCancelButton={true}
        onConfirm={confirmDelete}
      />

      <CustomAlertModal
        visible={showClearAllModal}
        onClose={() => setShowClearAllModal(false)}
        type="warning"
        title="Clear All"
        message="Are you sure you want to delete all notifications? This action cannot be undone."
        confirmText="Clear All"
        cancelText="Cancel"
        showCancelButton={true}
        onConfirm={confirmClearAll}
      />

      <CustomAlertModal
        visible={showAlert}
        onClose={() => setShowAlert(false)}
        type={alertConfig.type}
        title={alertConfig.title}
        message={alertConfig.message}
        confirmText="OK"
      />

      {/* Broadcast Detail Modal */}
      <Modal
        visible={showBroadcastModal && !!selectedBroadcast}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowBroadcastModal(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalBackdropTouch} 
            activeOpacity={1} 
            onPress={() => setShowBroadcastModal(false)} 
          />
          <View style={[
            styles.broadcastModalCard, 
            { 
              backgroundColor: colors.surface, 
              borderColor: colors.border 
            }
          ]}>
            {selectedBroadcast && (() => {
              const catInfo = getBroadcastCategoryInfo(selectedBroadcast.type, selectedBroadcast.data);
              const targetAudience = selectedBroadcast.data?.target_audience;
              const audienceLabel = targetAudience === 'riders' 
                ? 'Riders Only' 
                : targetAudience === 'customers' 
                  ? 'Customers Only' 
                  : targetAudience === 'all' 
                    ? 'Everyone' 
                    : null;

              return (
                <>
                  {/* Top Bar: Category Badges & Close Button */}
                  <View style={styles.broadcastModalHeader}>
                    <View style={styles.badgeRow}>
                      <View style={[
                        styles.categoryBadge, 
                        { backgroundColor: catInfo.bg, borderColor: catInfo.borderColor }
                      ]}>
                        <Ionicons name={catInfo.icon} size={14} color={catInfo.color} style={styles.badgeIcon} />
                        <Text style={[styles.categoryBadgeText, { color: catInfo.color }]}>
                          {catInfo.label}
                        </Text>
                      </View>

                      {audienceLabel && (
                        <View style={[
                          styles.audienceBadge, 
                          { backgroundColor: isDarkMode ? colors.surfaceElevated : '#F1F5F9' }
                        ]}>
                          <Ionicons name="people-outline" size={12} color={colors.textSecondary} style={styles.badgeIcon} />
                          <Text style={[styles.audienceBadgeText, { color: colors.textSecondary }]}>
                            {audienceLabel}
                          </Text>
                        </View>
                      )}
                    </View>

                    <TouchableOpacity
                      style={[styles.modalCloseCircle, { backgroundColor: isDarkMode ? colors.surfaceElevated : '#F1F5F9' }]}
                      onPress={() => setShowBroadcastModal(false)}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                      accessibilityLabel="Close broadcast details"
                    >
                      <Ionicons name="close" size={20} color={colors.textPrimary} />
                    </TouchableOpacity>
                  </View>

                  {/* Title */}
                  <Text style={[styles.broadcastModalTitle, { color: colors.textPrimary }]}>
                    {selectedBroadcast.title}
                  </Text>

                  {/* Metadata Row */}
                  <View style={styles.broadcastMetaRow}>
                    <View style={styles.metaItem}>
                      <Ionicons name="time-outline" size={13} color={colors.textMuted} style={{ marginRight: 4 }} />
                      <Text style={[styles.broadcastMetaText, { color: colors.textMuted }]}>
                        {formatFullDateTime(selectedBroadcast.created_at) || formatTime(selectedBroadcast.created_at)}
                      </Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Ionicons name="checkmark-circle" size={13} color={colors.primary} style={{ marginRight: 4 }} />
                      <Text style={[styles.broadcastMetaText, { color: colors.primary, fontWeight: '600' }]}>
                        Official Broadcast
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.modalDivider, { backgroundColor: colors.border }]} />

                  {/* Scrollable Message Content */}
                  <ScrollView 
                    style={styles.broadcastBodyScroll} 
                    showsVerticalScrollIndicator={true}
                    contentContainerStyle={{ paddingVertical: 12 }}
                  >
                    <Text 
                      style={[styles.broadcastBodyText, { color: colors.textSecondary }]}
                      selectable={true}
                    >
                      {selectedBroadcast.message}
                    </Text>
                  </ScrollView>

                  {/* Action Buttons */}
                  <View style={styles.modalActionButtons}>
                    <TouchableOpacity
                      style={[styles.actionPrimaryButton, { backgroundColor: colors.primary }]}
                      onPress={handleModalAction}
                      activeOpacity={0.8}
                    >
                      <Ionicons 
                        name={role === 'rider' ? 'bicycle' : 'bag-handle-outline'} 
                        size={18} 
                        color="#FFFFFF" 
                        style={{ marginRight: 6 }} 
                      />
                      <Text style={styles.actionPrimaryButtonText}>
                        {role === 'rider' ? 'View Deliveries' : 'Browse Products'}
                      </Text>
                    </TouchableOpacity>

                    <View style={styles.modalSecondaryRow}>
                      <TouchableOpacity
                        style={[
                          styles.actionSecondaryButton, 
                          { 
                            borderColor: colors.border, 
                            backgroundColor: isDarkMode ? colors.surfaceElevated : '#F8FAFC' 
                          }
                        ]}
                        onPress={handleShareBroadcast}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="share-social-outline" size={18} color={colors.textPrimary} style={{ marginRight: 6 }} />
                        <Text style={[styles.actionSecondaryButtonText, { color: colors.textPrimary }]}>
                          Share
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.actionCloseButton, 
                          { 
                            borderColor: colors.border, 
                            backgroundColor: isDarkMode ? colors.surfaceElevated : '#F1F5F9' 
                          }
                        ]}
                        onPress={() => setShowBroadcastModal(false)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.actionCloseButtonText, { color: colors.textSecondary }]}>
                          Close
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              );
            })()}
          </View>
        </View>
      </Modal>
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
  headerTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0033A0',
  },
  unreadBadge: {
    marginLeft: 8,
    fontSize: 14,
    color: '#ED2939',
    fontWeight: '600',
  },
  clearButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f4ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  markAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f4ff',
    paddingVertical: 10,
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 20,
    gap: 6,
  },
  markAllText: {
    color: '#0033A0',
    fontSize: 14,
    fontWeight: '600',
  },
  centerContainer: {
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
    paddingTop: 8,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  unreadNotification: {
    backgroundColor: '#f0f7ff',
    borderColor: '#0033A0',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
    marginRight: 8,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  unreadTitle: {
    color: '#0033A0',
    fontWeight: '700',
  },
  notificationTime: {
    fontSize: 11,
    color: '#999',
    marginLeft: 8,
  },
  notificationMessage: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  deleteButton: {
    padding: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalBackdropTouch: {
    ...StyleSheet.absoluteFillObject,
  },
  broadcastModalCard: {
    width: '100%',
    maxHeight: '82%',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  broadcastModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  badgeIcon: {
    marginRight: 4,
  },
  categoryBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  audienceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  audienceBadgeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  modalCloseCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  broadcastModalTitle: {
    fontSize: 19,
    fontWeight: '700',
    lineHeight: 26,
    marginBottom: 8,
  },
  broadcastMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  broadcastMetaText: {
    fontSize: 12,
  },
  modalDivider: {
    height: 1,
    width: '100%',
    marginBottom: 4,
  },
  broadcastBodyScroll: {
    maxHeight: 220,
  },
  broadcastBodyText: {
    fontSize: 15,
    lineHeight: 23,
  },
  modalActionButtons: {
    marginTop: 16,
    gap: 10,
  },
  actionPrimaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  actionPrimaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  modalSecondaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionSecondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
  },
  actionSecondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  actionCloseButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
  },
  actionCloseButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});