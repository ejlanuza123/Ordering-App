// src/screens/rider/RiderDeliveryDetailsScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Modal,
  TextInput,
  Share,
  Clipboard,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { formatCurrency, formatOrderNumber } from '../../utils/formatters';
import CustomAlertModal from '../../components/CustomAlertModal';
import * as ImagePicker from 'expo-image-picker';
import { useDeliveryProof } from '../../context/DeliveryProofContext';
import { useAuth } from '../../context/AuthContext';
import { RIDER_CANCELLATION_REASONS, CANCEL_REASON_OTHER } from '../../constants/cancellationReasons';

const devLog = (...args) => {
  if (__DEV__) {
    console.log(...args);
  }
};

export default function RiderDeliveryDetailsScreen({ route, navigation }) {
  const { delivery } = route.params;
  const { profile } = useAuth(); // Get current rider profile
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(true);
  const [deliveryData, setDeliveryData] = useState(delivery);
  const [orderData, setOrderData] = useState(null);
  const [customerData, setCustomerData] = useState(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ type: 'success', title: '', message: '' });
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [showProofModal, setShowProofModal] = useState(false);
  const [proofImage, setProofImage] = useState(null);
  const [showContactOptions, setShowContactOptions] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [issueReason, setIssueReason] = useState('');
  const [issueDescription, setIssueDescription] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState(RIDER_CANCELLATION_REASONS[0]);
  const [cancelCustomReason, setCancelCustomReason] = useState('');
  const [selectedAction, setSelectedAction] = useState(null);

  // proof of delivery state
  const [proofModalVisible, setProofModalVisible] = useState(false);
  const [proofImageUri, setProofImageUri] = useState(null);
  const [uploadingProof, setUploadingProof] = useState(false);
  const deliveryTimerRef = useRef(null);
  const { uploadProofPhoto, saveDeliveryProof } = useDeliveryProof();
  const displayOrderNumber = formatOrderNumber(orderData?.order_number, orderData?.id || deliveryData?.order_id);

  const hasExistingProof = async (deliveryId) => {
    const { count, error } = await supabase
      .from('delivery_proofs')
      .select('*', { count: 'exact', head: true })
      .eq('delivery_id', deliveryId);

    if (error) throw error;
    return (count || 0) > 0;
  };

  const getCancellationReasonText = () => {
    const customReason = cancelCustomReason.trim();

    if (cancelReason === CANCEL_REASON_OTHER) {
      return customReason;
    }

    return cancelReason;
  };

  useEffect(() => {
    fetchAllDeliveryData();

    devLog('Initial delivery data:', delivery);
    
    // Subscribe to real-time updates
    const channel = supabase
      .channel(`delivery-${delivery.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'deliveries',
          filter: `id=eq.${delivery.id}`
        },
        (payload) => {
          // Fetch fresh data when delivery is updated
          fetchAllDeliveryData();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
      if (deliveryTimerRef.current) {
        clearInterval(deliveryTimerRef.current);
        deliveryTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    startDeliveryTimer();
  }, [deliveryData.status, deliveryData.assigned_at, deliveryData.accepted_at, deliveryData.picked_up_at]);

  const startDeliveryTimer = () => {
    if (deliveryTimerRef.current) {
      clearInterval(deliveryTimerRef.current);
      deliveryTimerRef.current = null;
    }

    setTimeElapsed(0);

    const activeStatuses = ['accepted', 'picked_up', 'out_for_delivery'];
    if (!activeStatuses.includes(deliveryData.status)) return;

    const timerStart = deliveryData.accepted_at || deliveryData.picked_up_at || deliveryData.assigned_at;
    if (!timerStart) return;

    const startTime = new Date(timerStart).getTime();
    setTimeElapsed(Math.max(0, Math.floor((Date.now() - startTime) / 1000)));

    deliveryTimerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setTimeElapsed(Math.max(0, elapsed));
    }, 1000);
  };

  const formatTimeElapsed = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const fetchAllDeliveryData = async () => {
    setFetchingData(true);
    try {
      // 1. Fetch the delivery record
      const { data: deliveryRecord, error: deliveryError } = await supabase
        .from('deliveries')
        .select('*')
        .eq('id', delivery.id)
        .maybeSingle();

      if (deliveryError) throw deliveryError;
      
      if (!deliveryRecord) {
        console.error('No delivery found with ID:', delivery.id);
        setFetchingData(false);
        return;
      }
      
      setDeliveryData(deliveryRecord);
      setDeliveryNotes(deliveryRecord.notes || '');

      // 2. Fetch the associated order
      if (deliveryRecord.order_id) {
        const { data: orderRecord, error: orderError } = await supabase
          .from('orders')
          .select(`
            *,
            order_items (
              quantity,
              price_at_order,
              products (
                id,
                name,
                unit,
                category,
                image_url
              )
            )
          `)
          .eq('id', deliveryRecord.order_id)
          .maybeSingle();

        if (orderError) {
          console.error('Error fetching order:', orderError);
        } else if (orderRecord) {
          setOrderData(orderRecord);

          // 3. Fetch customer profile if user_id exists
          if (orderRecord.user_id) {
            const { data: profileRecord, error: profileError } = await supabase
              .from('profiles')
              .select('full_name, phone_number')
              .eq('id', orderRecord.user_id)
              .maybeSingle();

            if (!profileError && profileRecord) {
              setCustomerData(profileRecord);
            } else if (profileError) {
              console.error('Error fetching profile:', profileError);
            }
          }
        } else {
          devLog('No order found for ID:', deliveryRecord.order_id);
        }
      }

      devLog('Fetched all data:', {
        delivery: deliveryRecord, 
        order: orderData, 
        customer: customerData 
      });
    } catch (error) {
      console.error('Error fetching delivery details:', error.message);
      Alert.alert('Error', 'Failed to load delivery details');
    } finally {
      setFetchingData(false);
    }
  };

  // FIXED: Updated function to set rider_id when accepting
  const updateDeliveryStatus = async (newStatus) => {
    setLoading(true);
    
    try {
      if (newStatus === 'delivered') {
        const proofExists = await hasExistingProof(deliveryData.id);
        if (!proofExists) {
          throw new Error('Please capture and upload proof of delivery before marking this order as delivered.');
        }
      }

      const updates = {
        status: newStatus,
        notes: deliveryNotes || null,
        ...(newStatus === 'picked_up' && { picked_up_at: new Date().toISOString() }),
        ...(newStatus === 'delivered' && { delivered_at: new Date().toISOString() }),
        ...(newStatus === 'failed' && { failed_at: new Date().toISOString() })
      };

      // Ensure rider_id is set for this rider to satisfy RLS policies
      // (especially important when saving delivery proof).
      // Only set if it is currently missing so we don't overwrite an existing assignment.
      if (profile?.id && !deliveryData.rider_id) {
        updates.rider_id = profile.id;
      }

      // Update delivery
      const { error: deliveryError } = await supabase
        .from('deliveries')
        .update(updates)
        .eq('id', deliveryData.id);

      if (deliveryError) throw deliveryError;

      // Order status sync is handled server-side by a deliveries trigger.
      // This keeps lifecycle transitions consistent even with strict rider RLS on orders.

      // Handle notifications
      let notificationTitle = '';
      let notificationMessage = '';

      switch(newStatus) {
        case 'accepted':
          notificationTitle = 'Order Accepted';
          notificationMessage = `Your order ${displayOrderNumber} has been accepted by a rider.`;
          break;
        case 'picked_up':
          notificationTitle = 'Order Picked Up';
          notificationMessage = `Your order ${displayOrderNumber} has been picked up.`;
          break;
        case 'out_for_delivery':
          notificationTitle = 'Order Out for Delivery';
          notificationMessage = `Your order ${displayOrderNumber} is on its way!`;
          break;
        case 'delivered':
          notificationTitle = 'Order Delivered';
          notificationMessage = `Your order ${displayOrderNumber} has been delivered. Thank you!`;
          break;
        case 'failed':
          notificationTitle = 'Delivery Failed';
          notificationMessage = `Your order ${displayOrderNumber} delivery failed. Please contact support.`;
          break;
      }

      // Notifications are now generated server-side by a deliveries status trigger.
      // This avoids rider-side INSERT attempts against hardened notifications RLS.
      if (orderData && orderData.user_id && notificationTitle) {
        devLog('Delivery status updated; notification will be created by DB trigger.');
      }

      // Update rider earnings if delivered
      if (newStatus === 'delivered' && profile?.id) {
        try {
          // Get the delivery fee from the order
          const deliveryFee = parseFloat(orderData?.delivery_fee) || 0;
          
          const { data: profileRow, error: profileError } = await supabase
            .from('profiles')
            .select('total_earnings')
            .eq('id', profile.id)
            .single();

          if (!profileError && profileRow) {
            // Earnings = delivery fee from the order (dynamic, not hardcoded)
            const newTotal = (parseFloat(profileRow.total_earnings) || 0) + deliveryFee;
            await supabase
              .from('profiles')
              .update({
                total_earnings: newTotal,
                updated_at: new Date().toISOString()
              })
              .eq('id', profile.id);
          }
        } catch (err) {
          console.error('Error updating rider earnings:', err);
        }
      }

      setAlertConfig({
        type: 'success',
        title: 'Success!',
        message: `Delivery status updated to ${
          newStatus === 'accepted' ? 'Accepted' :
          newStatus === 'picked_up' ? 'Picked Up' : 
          newStatus === 'out_for_delivery' ? 'Out for Delivery' : 
          newStatus === 'delivered' ? 'Delivered' : 'Failed'
        }`
      });
      setShowAlert(true);
      
      await fetchAllDeliveryData();
      setShowStatusModal(false);
      setSelectedAction(null);
    } catch (error) {
      // Notifications are created server-side via trigger; 42501 can happen if RLS blocks that insert.
      // Check both direct error properties and stringified message for robustness.
      const errorCode = error?.code || error?.status;
      const errorMsg = (error?.message || JSON.stringify(error) || '').toLowerCase();
      const isNotificationsRLS = errorMsg.includes('notifications') && errorMsg.includes('row-level security');
      
      if ((errorCode === '42501' || errorCode === 42501) && isNotificationsRLS) {
        devLog('Notification RLS blocked (non-critical); delivery status update was successful.');
        
        setAlertConfig({
          type: 'success',
          title: 'Status Updated',
          message: `Delivery status updated to ${
            newStatus === 'accepted' ? 'Accepted' :
            newStatus === 'picked_up' ? 'Picked Up' : 
            newStatus === 'out_for_delivery' ? 'Out for Delivery' : 
            newStatus === 'delivered' ? 'Delivered' : 'Failed'
          }. Customer notification will be sent automatically.`
        });
        setShowAlert(true);

        // refresh state in UI and continue as success path
        await fetchAllDeliveryData();
        setShowStatusModal(false);
        setSelectedAction(null);
      } else {
        console.error('Error updating status:', error);
        setAlertConfig({
          type: 'error',
          title: 'Error',
          message: error?.message || error?.details || 'Failed to update status'
        });
        setShowAlert(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const reportIssue = async () => {
    if (!issueReason) {
      Alert.alert('Error', 'Please select a reason');
      return;
    }

    setLoading(true);
    try {
      await supabase
        .from('deliveries')
        .update({
          status: 'issue_reported',
          issue_reason: issueReason,
          issue_description: issueDescription,
          issue_reported_at: new Date().toISOString()
        })
        .eq('id', deliveryData.id);

      // Admin notifications are generated server-side under hardened RLS.
      // Rider clients should not insert directly into notifications.
      devLog('Issue reported; admin notification should be handled server-side.');

      setAlertConfig({
        type: 'info',
        title: 'Issue Reported',
        message: 'Your issue has been reported. Support will contact you shortly.'
      });
      setShowAlert(true);
      setShowIssueModal(false);
      
      await fetchAllDeliveryData(); // Refresh data
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const cancelOrder = async () => {
    const cancellationReason = getCancellationReasonText();

    if (!cancellationReason) {
      Alert.alert('Error', 'Please select a reason or write your own reason');
      return;
    }

    setLoading(true);
    try {
      const updates = {
        status: 'failed',
        cancellation_reason: cancellationReason,
        failed_at: new Date().toISOString(),
      };

      if (profile?.id && !deliveryData.rider_id) {
        updates.rider_id = profile.id;
      }

      const { error } = await supabase
        .from('deliveries')
        .update(updates)
        .eq('id', deliveryData.id);

      if (error) throw error;

      devLog('Delivery cancelled by rider; order cancellation reason will sync via DB trigger.');

      setAlertConfig({
        type: 'success',
        title: 'Order Cancelled',
        message: `Cancellation reason saved: ${cancellationReason}`
      });
      setShowAlert(true);
      setShowCancelModal(false);
      setCancelReason(RIDER_CANCELLATION_REASONS[0]);
      setCancelCustomReason('');
      setSelectedAction(null);

      await fetchAllDeliveryData();
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to cancel order');
    } finally {
      setLoading(false);
    }
  };

  const openMaps = () => {
    if (orderData?.delivery_lat && orderData?.delivery_lng) {
      const url = Platform.select({
        ios: `maps:${orderData.delivery_lat},${orderData.delivery_lng}`,
        android: `geo:${orderData.delivery_lat},${orderData.delivery_lng}`
      });
      
      Linking.openURL(url);
    } else {
      // Fallback to address search
      const address = encodeURIComponent(orderData?.delivery_address || '');
      const url = Platform.select({
        ios: `maps:?q=${address}`,
        android: `geo:0,0?q=${address}`
      });
      Linking.openURL(url);
    }
  };

  const callCustomer = () => {
    const phone = customerData?.phone_number;
    if (phone) {
      Linking.openURL(`tel:${phone}`);
    } else {
      Alert.alert('No Phone', 'Customer phone number not available');
    }
  };

  const messageCustomer = () => {
    const phone = customerData?.phone_number;
    if (phone) {
      const cleanPhone = phone.replace(/\D/g, '');
      Linking.openURL(`sms:${cleanPhone}`);
    } else {
      Alert.alert('No Phone', 'Customer phone number not available');
    }
  };

  const whatsappCustomer = () => {
    const phone = customerData?.phone_number;
    if (phone) {
      const cleanPhone = phone.replace(/\D/g, '');
      Linking.openURL(`whatsapp://send?phone=${cleanPhone}`);
    } else {
      Alert.alert('No WhatsApp', 'Customer phone number not available');
    }
  };

  const copyAddress = () => {
    Clipboard.setString(orderData?.delivery_address || '');
    setAlertConfig({
      type: 'success',
      title: 'Success',
      message: 'Address copied to clipboard'
    });
    setShowAlert(true);
  };

  const shareDelivery = async () => {
    try {
      await Share.share({
        message: `Delivery ${displayOrderNumber}\nAddress: ${orderData?.delivery_address}\nTotal: ${formatCurrency(orderData?.total_amount || 0)}`,
        title: 'Delivery Details'
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'assigned': return '#F59E0B';
      case 'accepted': return '#10B981';
      case 'picked_up': return '#0033A0';
      case 'out_for_delivery': return '#0033A0';
      case 'delivered': return '#10B981';
      case 'failed': return '#EF4444';
      case 'issue_reported': return '#EF4444';
      default: return '#666';
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
      case 'issue_reported': return 'warning';
      default: return 'help-circle';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'assigned': return 'Waiting for Acceptance';
      case 'accepted': return 'Accepted - Ready to Pick Up';
      case 'picked_up': return 'Picked Up';
      case 'out_for_delivery': return 'Out for Delivery';
      case 'delivered': return 'Delivered';
      case 'failed': return 'Failed';
      case 'issue_reported': return 'Issue Reported';
      default: return status;
    }
  };

  // FIXED: Updated to include 'accepted' as an option when status is 'assigned'
  const getNextStatusOptions = () => {
    switch (deliveryData.status) {
      case 'assigned':
        return [
          { label: 'Accept Delivery', value: 'accepted', icon: 'checkmark-circle', color: '#10B981' },
          { label: 'Cancel Order', value: 'cancel', icon: 'close-circle', color: '#EF4444' },
          { label: 'Report Issue', value: 'issue', icon: 'warning', color: '#F59E0B' }
        ];
      case 'accepted':
        return [
          { label: 'Picked Up Order', value: 'picked_up', icon: 'bicycle', color: '#0033A0' },
          { label: 'Cancel Order', value: 'cancel', icon: 'close-circle', color: '#EF4444' },
          { label: 'Report Issue', value: 'issue', icon: 'warning', color: '#F59E0B' }
        ];
      case 'picked_up':
        return [
          { label: 'Start Delivery Route', value: 'out_for_delivery', icon: 'navigate', color: '#0033A0' },
          { label: 'Cancel Order', value: 'cancel', icon: 'close-circle', color: '#EF4444' },
          { label: 'Report Issue', value: 'issue', icon: 'warning', color: '#F59E0B' }
        ];
      case 'out_for_delivery':
        return [
          { label: 'Mark as Delivered', value: 'delivered', icon: 'checkmark-circle', color: '#10B981' },
          { label: 'Cancel Order', value: 'cancel', icon: 'close-circle', color: '#EF4444' },
          { label: 'Report Issue', value: 'issue', icon: 'warning', color: '#F59E0B' }
        ];
      default:
        return [];
    }
  };

  if (fetchingData) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#0033A0" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Delivery Details</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0033A0" />
          <Text style={styles.loadingText}>Loading delivery details...</Text>
        </View>
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
        <Text style={styles.headerTitle}>Delivery Details</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={shareDelivery} style={styles.headerButton}>
            <Ionicons name="share-outline" size={22} color="#0033A0" />
          </TouchableOpacity>
          <TouchableOpacity onPress={fetchAllDeliveryData} style={styles.headerButton}>
            <Ionicons name="refresh" size={22} color="#0033A0" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Timer Card for Active Deliveries */}
        {['accepted', 'picked_up', 'out_for_delivery'].includes(deliveryData.status) && (
          <View style={styles.timerCard}>
            <Ionicons name="time" size={24} color="#0033A0" />
            <View style={styles.timerInfo}>
              <Text style={styles.timerLabel}>Time Elapsed</Text>
              <Text style={styles.timerValue}>{formatTimeElapsed(timeElapsed)}</Text>
            </View>
            <View style={[styles.statusIndicator, { backgroundColor: getStatusColor(deliveryData.status) }]}>
              <Text style={styles.statusIndicatorText}>{getStatusText(deliveryData.status)}</Text>
            </View>
          </View>
        )}

        {/* Status Card */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(deliveryData.status) + '20' }]}>
              <Ionicons 
                name={getStatusIcon(deliveryData.status)} 
                size={20} 
                color={getStatusColor(deliveryData.status)} 
              />
              <Text style={[styles.statusText, { color: getStatusColor(deliveryData.status) }]}>
                {getStatusText(deliveryData.status)}
              </Text>
            </View>
            <Text style={styles.orderNumber} numberOfLines={1}>
              Order {displayOrderNumber}
            </Text>
          </View>

          {deliveryData.delivered_at && (
            <Text style={styles.deliveredTime}>
              Delivered: {new Date(deliveryData.delivered_at).toLocaleString()}
            </Text>
          )}
          {deliveryData.picked_up_at && (
            <Text style={styles.deliveredTime}>
              Picked Up: {new Date(deliveryData.picked_up_at).toLocaleString()}
            </Text>
          )}
        </View>

        {/* Action Buttons */}
        {getNextStatusOptions().length > 0 && (
          <View style={styles.actionSection}>
            <Text style={styles.sectionTitle}>Update Status</Text>
            <View style={styles.actionButtons}>
              {getNextStatusOptions().map((option, index) => (
                <TouchableOpacity
                  key={index}
                  style={[styles.actionButton, { backgroundColor: option.color }]}
                  onPress={() => {
                    if (option.value === 'issue') {
                      setShowIssueModal(true);
                      } else if (option.value === 'cancel') {
                        setShowCancelModal(true);
                    } else {
                      // Show confirmation modal before proceeding
                      setSelectedAction(option);
                      setShowStatusModal(true);
                    }
                  }}
                >
                  <Ionicons name={option.icon} size={20} color="#fff" />
                  <Text style={styles.actionButtonText}>{option.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickAction} onPress={callCustomer}>
            <View style={[styles.quickActionIcon, { backgroundColor: '#0033A020' }]}>
              <Ionicons name="call" size={24} color="#0033A0" />
            </View>
            <Text style={styles.quickActionText}>Call</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.quickAction} onPress={messageCustomer}>
            <View style={[styles.quickActionIcon, { backgroundColor: '#10B98120' }]}>
              <Ionicons name="chatbubble" size={24} color="#10B981" />
            </View>
            <Text style={styles.quickActionText}>SMS</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.quickAction} onPress={whatsappCustomer}>
            <View style={[styles.quickActionIcon, { backgroundColor: '#25D36620' }]}>
              <Ionicons name="logo-whatsapp" size={24} color="#25D366" />
            </View>
            <Text style={styles.quickActionText}>WhatsApp</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.quickAction} onPress={openMaps}>
            <View style={[styles.quickActionIcon, { backgroundColor: '#F59E0B20' }]}>
              <Ionicons name="navigate" size={24} color="#F59E0B" />
            </View>
            <Text style={styles.quickActionText}>Navigate</Text>
          </TouchableOpacity>
        </View>

        {/* Additional Actions Row */}
        <View style={styles.additionalActions}>
          <TouchableOpacity style={styles.additionalAction} onPress={copyAddress}>
            <Ionicons name="copy-outline" size={20} color="#666" />
            <Text style={styles.additionalActionText}>Copy Address</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.additionalAction} onPress={() => setShowNotesModal(true)}>
            <Ionicons name="document-text-outline" size={20} color="#666" />
            <Text style={styles.additionalActionText}>Add Notes</Text>
          </TouchableOpacity>
        </View>

        {/* Customer Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer Information</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Ionicons name="person" size={18} color="#666" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Name</Text>
                <Text style={styles.infoValue}>
                  {customerData?.full_name || 'Customer'}
                </Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="call" size={18} color="#666" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Phone</Text>
                <Text style={styles.infoValue}>
                  {customerData?.phone_number || 'Not provided'}
                </Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="location" size={18} color="#666" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Address</Text>
                <Text style={styles.infoValue}>{orderData?.delivery_address || 'Address not available'}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Order Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Items</Text>
          <View style={styles.itemsCard}>
            {orderData?.order_items && orderData.order_items.length > 0 ? (
              (() => {
                let subtotal = 0;
                return (
                  <>
                    {orderData.order_items.map((item, index) => {
                      const quantity = parseFloat(item.quantity) || 0;
                      const price = parseFloat(item.price_at_order) || 0;
                      const itemTotal = quantity * price;
                      subtotal += itemTotal;
                      
                      return (
                        <View key={index} style={styles.itemRow}>
                          <View style={styles.itemInfo}>
                            <Text style={styles.itemName}>{item.products?.name || 'Product'}</Text>
                            <Text style={styles.itemQuantity}>
                              {quantity} {item.products?.unit || 'unit'} × ₱{price.toFixed(2)}
                            </Text>
                          </View>
                          <Text style={styles.itemTotal}>
                            ₱{itemTotal.toFixed(2)}
                          </Text>
                        </View>
                      );
                    })}

                    {/* subtotal line to explain total */}
                    <View style={[styles.totalRow, { borderTopWidth: 1, borderTopColor: '#f0f4ff', paddingTop: 8, marginTop: 8 }]}> 
                      <Text style={styles.totalLabel}>Items Subtotal</Text>
                      <Text style={styles.totalValue}>₱{subtotal.toFixed(2)}</Text>
                    </View>
                    {orderData?.delivery_fee != null && (
                      <View style={[styles.totalRow, { marginTop: 4 }]}> 
                        <Text style={styles.totalLabel}>Delivery Fee</Text>
                        <Text style={styles.totalValue}>₱{parseFloat(orderData.delivery_fee).toFixed(2)}</Text>
                      </View>
                    )}
                  </>
                );
              })()
            ) : (
              <Text style={styles.emptyText}>No items found</Text>
            )}
            
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Amount</Text>
              <Text style={styles.totalValue}>
                ₱{parseFloat(orderData?.total_amount || 0).toFixed(2)}
              </Text>
            </View>
          </View>
        </View>

        {/* Payment Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment</Text>
          <View style={styles.paymentCard}>
            <View style={styles.paymentRow}>
              <Ionicons name="card" size={18} color="#666" />
              <Text style={styles.paymentLabel}>Method:</Text>
              <Text style={styles.paymentValue}>{orderData?.payment_method || 'Cash on Delivery'}</Text>
            </View>
            <View style={styles.paymentRow}>
              <Ionicons name="cash" size={18} color="#666" />
              <Text style={styles.paymentLabel}>Order Total:</Text>
              <Text style={styles.paymentValue}>
                ₱{parseFloat(orderData?.total_amount || 0).toFixed(2)}
              </Text>
            </View>
          
            {orderData?.special_instructions && (
              <View style={styles.instructions}>
                <Ionicons name="document-text" size={18} color="#666" />
                <Text style={styles.instructionsText}>{orderData.special_instructions}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Delivery Notes */}
        {deliveryNotes ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Delivery Notes</Text>
            <View style={styles.notesCard}>
              <Text style={styles.notesText}>{deliveryNotes}</Text>
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* Status Update Modal */}
      {selectedAction && (
        <CustomAlertModal
          visible={showStatusModal}
          onClose={() => {
            setShowStatusModal(false);
            setSelectedAction(null);
          }}
          type="confirm"
          title={`Update to ${selectedAction.label}?`}
          message={`Are you sure you want to mark this delivery as ${selectedAction.label.toLowerCase()}?`}
          confirmText="Confirm"
          cancelText="Cancel"
          showCancelButton={true}
          onConfirm={() => {
            const val = selectedAction.value;
            if (val === 'delivered') {
              // Delivery completion requires proof upload first.
              setProofModalVisible(true);
              setShowStatusModal(false);
              return;
            }

            updateDeliveryStatus(val);
            setShowStatusModal(false);
            setSelectedAction(null);
          }}
          loading={loading}
        />
      )}

      {/* Add Notes Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showNotesModal}
        onRequestClose={() => setShowNotesModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Delivery Notes</Text>
              <TouchableOpacity onPress={() => setShowNotesModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <TextInput
                style={styles.notesInput}
                placeholder="Add notes about this delivery (e.g., gate code, special instructions)"
                value={deliveryNotes}
                onChangeText={setDeliveryNotes}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelModalButton]}
                  onPress={() => setShowNotesModal(false)}
                >
                  <Text style={styles.cancelModalButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalButton, styles.saveModalButton]}
                  onPress={async () => {
                    await supabase
                      .from('deliveries')
                      .update({ notes: deliveryNotes })
                      .eq('id', deliveryData.id);
                    setShowNotesModal(false);
                    Alert.alert('Success', 'Notes saved successfully');
                  }}
                >
                  <Text style={styles.saveModalButtonText}>Save Notes</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Proof of Delivery Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={proofModalVisible}
        onRequestClose={() => setProofModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}> 
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Capture Delivery Proof</Text>
              <TouchableOpacity onPress={() => setProofModalVisible(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              {!proofImageUri ? (
                <TouchableOpacity
                  style={styles.captureButton}
                  onPress={async () => {
                    const { status } = await ImagePicker.requestCameraPermissionsAsync();
                    if (status !== 'granted') {
                      Alert.alert('Permission required', 'Camera permission is needed');
                      return;
                    }
                    const result = await ImagePicker.launchCameraAsync({ 
                      mediaTypes: ['images'],
                      quality: 0.7 
                    });
                    if (!result.canceled) {
                      setProofImageUri(result.assets[0].uri);
                    }
                  }}
                >
                  <Ionicons name="camera" size={48} color="#0033A0" />
                  <Text style={styles.captureText}>Take Photo</Text>
                </TouchableOpacity>
              ) : (
                <View style={{ alignItems: 'center' }}>
                  <Image source={{ uri: proofImageUri }} style={styles.capturedImage} />
                  <TouchableOpacity
                    style={[styles.modalButton, styles.cancelModalButton, styles.retakeButton]}
                    onPress={() => setProofImageUri(null)}
                  >
                    <Text style={[styles.cancelModalButtonText, styles.retakeButtonText]}>Retake</Text>
                  </TouchableOpacity>
                </View>
              )}

              {uploadingProof ? (
                <View style={styles.uploadingOverlay}>
                  <ActivityIndicator size="large" color="#0033A0" />
                  <Text style={styles.uploadingText}>Uploading proof...</Text>
                </View>
              ) : (
                proofImageUri && (
                  <View style={styles.proofModalActions}>
                    <TouchableOpacity
                      style={[styles.modalButton, styles.saveModalButton, styles.fullWidthModalButton]}
                      onPress={async () => {
                        setUploadingProof(true);
                        try {
                          // upload and save then update status
                          const { success, photoUrl, error } = await uploadProofPhoto(proofImageUri, deliveryData.id);
                          if (!success) throw new Error(error || 'Could not upload photo');

                          const { success: saved, error: saveError } = await saveDeliveryProof({
                            delivery_id: deliveryData.id,
                            photo_url: photoUrl
                          });

                          if (!saved) throw new Error(saveError || 'Could not save proof data');

                          if (selectedAction) {
                            await updateDeliveryStatus(selectedAction.value);
                            setSelectedAction(null);
                          }

                          setProofImageUri(null);
                          setProofModalVisible(false);
                        } catch (err) {
                          console.error('Proof upload/save error:', err);
                          Alert.alert('Error', err.message || 'Failed to upload proof');
                        } finally {
                          setUploadingProof(false);
                        }
                      }}
                      disabled={uploadingProof}
                    >
                      <Text style={styles.saveModalButtonText}>Upload & Continue</Text>
                    </TouchableOpacity>
                  </View>
                )
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Report Issue Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showIssueModal}
        onRequestClose={() => setShowIssueModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Report Issue</Text>
              <TouchableOpacity onPress={() => setShowIssueModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.inputLabel}>Reason for issue *</Text>
              <View style={styles.issueOptions}>
                {[
                  'Customer not available',
                  'Wrong address',
                  'Customer cancelled',
                  'Payment issue',
                  'Vehicle problem',
                  'Safety concern',
                  'Other'
                ].map((reason) => (
                  <TouchableOpacity
                    key={reason}
                    style={[
                      styles.issueOption,
                      issueReason === reason && styles.issueOptionSelected
                    ]}
                    onPress={() => setIssueReason(reason)}
                  >
                    <Text style={[
                      styles.issueOptionText,
                      issueReason === reason && styles.issueOptionTextSelected
                    ]}>
                      {reason}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Description (Optional)</Text>
              <TextInput
                style={styles.issueDescriptionInput}
                placeholder="Provide more details about the issue..."
                value={issueDescription}
                onChangeText={setIssueDescription}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelModalButton]}
                  onPress={() => {
                    setShowIssueModal(false);
                    setIssueReason('');
                    setIssueDescription('');
                  }}
                >
                  <Text style={styles.cancelModalButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalButton, styles.reportModalButton]}
                  onPress={reportIssue}
                  disabled={!issueReason || loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.reportModalButtonText}>Report Issue</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Cancel Order Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showCancelModal}
        onRequestClose={() => {
          setShowCancelModal(false);
          setCancelReason(RIDER_CANCELLATION_REASONS[0]);
          setCancelCustomReason('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Cancel Order</Text>
              <TouchableOpacity onPress={() => {
                setShowCancelModal(false);
                setCancelReason(RIDER_CANCELLATION_REASONS[0]);
                setCancelCustomReason('');
              }}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.inputLabel}>Reason for cancellation *</Text>
              <View style={styles.issueOptions}>
                {RIDER_CANCELLATION_REASONS.map((reason) => (
                  <TouchableOpacity
                    key={reason}
                    style={[
                      styles.issueOption,
                      cancelReason === reason && styles.issueOptionSelected
                    ]}
                    onPress={() => setCancelReason(reason)}
                  >
                    <Text style={[
                      styles.issueOptionText,
                      cancelReason === reason && styles.issueOptionTextSelected
                    ]}>
                      {reason}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {cancelReason === CANCEL_REASON_OTHER && (
                <>
                  <Text style={styles.inputLabel}>Write your reason *</Text>
                  <TextInput
                    style={styles.issueDescriptionInput}
                    placeholder="Add a custom reason"
                    value={cancelCustomReason}
                    onChangeText={setCancelCustomReason}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </>
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelModalButton]}
                  onPress={() => {
                    setShowCancelModal(false);
                    setCancelReason(RIDER_CANCELLATION_REASONS[0]);
                    setCancelCustomReason('');
                  }}
                >
                  <Text style={styles.cancelModalButtonText}>Back</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalButton, styles.reportModalButton]}
                  onPress={cancelOrder}
                  disabled={loading || !getCancellationReasonText().trim()}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.reportModalButtonText}>Confirm Cancel</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
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
    fontSize: 14,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    paddingVertical: 20,
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
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
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
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
  scrollContent: {
    padding: 16,
  },
  timerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  timerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  timerLabel: {
    fontSize: 12,
    color: '#666',
  },
  timerValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0033A0',
  },
  statusIndicator: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusIndicatorText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  statusCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  orderNumber: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  deliveredTime: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 4,
  },
  actionSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  actionButtons: {
    flexDirection: 'column',
    gap: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  quickAction: {
    flex: 1,
    minWidth: '22%',
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
  additionalActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  additionalAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e9ecef',
    gap: 6,
  },
  additionalActionText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  section: {
    marginBottom: 16,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  itemsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
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
    marginBottom: 2,
  },
  itemQuantity: {
    fontSize: 12,
    color: '#666',
  },
  itemTotal: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0033A0',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ED2939',
  },
  paymentCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  paymentLabel: {
    fontSize: 14,
    color: '#666',
  },
  paymentValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  instructions: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f4ff',
  },
  instructionsText: {
    flex: 1,
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
  },
  notesCard: {
    backgroundColor: '#f0f7ff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#0033A0',
  },
  notesText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
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
  notesInput: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#e9ecef',
    minHeight: 100,
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  issueOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  issueOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  issueOptionSelected: {
    backgroundColor: '#0033A0',
    borderColor: '#0033A0',
  },
  issueOptionText: {
    fontSize: 13,
    color: '#666',
  },
  issueOptionTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  issueDescriptionInput: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    fontSize: 14,
    color: '#333',
    borderWidth: 1,
    borderColor: '#e9ecef',
    minHeight: 80,
    marginBottom: 20,
  },
  uploadingOverlay: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  uploadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#333',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  proofModalActions: {
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  fullWidthModalButton: {
    width: '100%',
  },
  cancelModalButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  cancelModalButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 20,
    textAlign: 'center',
  },
  saveModalButton: {
    backgroundColor: '#0033A0',
  },
  saveModalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    lineHeight: 20,
    textAlign: 'center',
  },
  retakeButton: {
    marginTop: 12,
    marginBottom: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#FFF1F1',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  retakeButtonText: {
    fontSize: 14,
    lineHeight: 18,
    color: '#EF4444',
    fontWeight: '600',
  },
  reportModalButton: {
    backgroundColor: '#F59E0B',
  },
  reportModalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  captureButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    borderWidth: 1,
    borderColor: '#0033A0',
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  captureText: {
    marginTop: 8,
    color: '#0033A0',
    fontSize: 14,
    fontWeight: '600',
  },
  capturedImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    resizeMode: 'cover',
  },
});