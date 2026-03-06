// src/screens/rider/RiderDeliveryDetailsScreen.js
import React, { useState, useEffect } from 'react';
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
  Clipboard
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { formatCurrency } from '../../utils/formatters';
import CustomAlertModal from '../../components/CustomAlertModal';


export default function RiderDeliveryDetailsScreen({ route, navigation }) {
  const { delivery } = route.params;
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [deliveryData, setDeliveryData] = useState(delivery);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ type: 'success', title: '', message: '' });
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [showProofModal, setShowProofModal] = useState(false);
  const [proofImage, setProofImage] = useState(null);
  const [showContactOptions, setShowContactOptions] = useState(false);
  const [deliveryTimer, setDeliveryTimer] = useState(null);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [issueReason, setIssueReason] = useState('');
  const [issueDescription, setIssueDescription] = useState('');

  const order = deliveryData.orders;

  useEffect(() => {
    fetchDeliveryDetails();
    startDeliveryTimer();
    
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
          setDeliveryData(payload.new);
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
      if (deliveryTimer) clearInterval(deliveryTimer);
    };
  }, []);

  const startDeliveryTimer = () => {
    if (deliveryData.status !== 'delivered' && deliveryData.assigned_at) {
      const startTime = new Date(deliveryData.assigned_at).getTime();
      const timer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setTimeElapsed(elapsed);
      }, 1000);
      setDeliveryTimer(timer);
    }
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

  const fetchDeliveryDetails = async () => {
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
              id,
              full_name,
              phone_number
            ),
            payment_method,
            special_instructions,
            status as order_status,
            created_at,
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
          )
        `)
        .eq('id', delivery.id)
        .single();

      if (error) throw error;
      setDeliveryData(data);
      setDeliveryNotes(data.notes || '');
    } catch (error) {
      console.error('Error fetching delivery details:', error.message);
    }
  };

  const updateDeliveryStatus = async (newStatus) => {
    setLoading(true);
    try {
      const updates = {
        status: newStatus,
        notes: deliveryNotes || null,
        ...(newStatus === 'picked_up' && { picked_up_at: new Date().toISOString() }),
        ...(newStatus === 'delivered' && { delivered_at: new Date().toISOString() }),
        ...(newStatus === 'failed' && { failed_at: new Date().toISOString() })
      };

      // Update delivery
      const { error: deliveryError } = await supabase
        .from('deliveries')
        .update(updates)
        .eq('id', delivery.id);

      if (deliveryError) throw deliveryError;

      // Update order status accordingly
      let orderStatus = 'Processing';
      let notificationMessage = '';
      let notificationTitle = '';

      switch(newStatus) {
        case 'picked_up':
          orderStatus = 'Out for Delivery';
          notificationTitle = 'Order Out for Delivery';
          notificationMessage = `Your order #${order.order_number} is on its way!`;
          break;
        case 'delivered':
          orderStatus = 'Completed';
          notificationTitle = 'Order Delivered';
          notificationMessage = `Your order #${order.order_number} has been delivered. Thank you!`;
          break;
        case 'failed':
          orderStatus = 'Cancelled';
          notificationTitle = 'Delivery Failed';
          notificationMessage = `Your order #${order.order_number} delivery failed. Please contact support.`;
          break;
      }

      const { error: orderError } = await supabase
        .from('orders')
        .update({ 
          status: orderStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id);

      if (orderError) throw orderError;

      // Notify customer
      await supabase
        .from('notifications')
        .insert({
          user_id: order.customer_name?.id || order.user_id,
          type: newStatus === 'delivered' ? 'order_delivered' : 'order_status',
          title: notificationTitle,
          message: notificationMessage,
          data: { 
            order_id: order.id,
            delivery_id: delivery.id,
            status: newStatus
          }
        });

      // Update rider earnings if delivered
      if (newStatus === 'delivered') {
        await supabase
          .from('profiles')
          .update({
            total_earnings: supabase.raw('total_earnings + 50'),
            updated_at: new Date().toISOString()
          })
          .eq('id', delivery.rider_id);
      }

      setAlertConfig({
        type: 'success',
        title: 'Success!',
        message: `Delivery status updated to ${newStatus === 'picked_up' ? 'Picked Up' : 
                  newStatus === 'delivered' ? 'Delivered' : 'Failed'}`
      });
      setShowAlert(true);
      
      fetchDeliveryDetails();
      setShowStatusModal(false);
    } catch (error) {
      setAlertConfig({
        type: 'error',
        title: 'Error',
        message: error.message
      });
      setShowAlert(true);
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
        .eq('id', delivery.id);

      // Notify admin
      await supabase
        .from('notifications')
        .insert({
          user_id: null, // Will be sent to all admins
          type: 'system',
          title: 'Delivery Issue Reported',
          message: `Rider reported issue with delivery #${order.order_number}: ${issueReason}`,
          data: { 
            delivery_id: delivery.id,
            order_id: order.id,
            reason: issueReason,
            description: issueDescription
          }
        });

      setAlertConfig({
        type: 'info',
        title: 'Issue Reported',
        message: 'Your issue has been reported. Support will contact you shortly.'
      });
      setShowAlert(true);
      setShowIssueModal(false);
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const openMaps = () => {
    if (order.delivery_lat && order.delivery_lng) {
      const url = Platform.select({
        ios: `maps:${order.delivery_lat},${order.delivery_lng}`,
        android: `geo:${order.delivery_lat},${order.delivery_lng}`
      });
      
      Linking.openURL(url);
    } else {
      // Fallback to address search
      const address = encodeURIComponent(order.delivery_address);
      const url = Platform.select({
        ios: `maps:?q=${address}`,
        android: `geo:0,0?q=${address}`
      });
      Linking.openURL(url);
    }
  };

  const callCustomer = () => {
    const phone = order.customer_name?.phone_number;
    if (phone) {
      Linking.openURL(`tel:${phone}`);
    } else {
      Alert.alert('No Phone', 'Customer phone number not available');
    }
  };

  const messageCustomer = () => {
    const phone = order.customer_name?.phone_number;
    if (phone) {
      const cleanPhone = phone.replace(/\D/g, '');
      Linking.openURL(`sms:${cleanPhone}`);
    } else {
      Alert.alert('No Phone', 'Customer phone number not available');
    }
  };

  const whatsappCustomer = () => {
    const phone = order.customer_name?.phone_number;
    if (phone) {
      const cleanPhone = phone.replace(/\D/g, '');
      Linking.openURL(`whatsapp://send?phone=${cleanPhone}`);
    } else {
      Alert.alert('No WhatsApp', 'Customer phone number not available');
    }
  };

  const copyAddress = () => {
    Clipboard.setString(order.delivery_address);
    Alert.alert('Success', 'Address copied to clipboard');
  };

  const shareDelivery = async () => {
    try {
      await Share.share({
        message: `Delivery #${order.order_number}\nAddress: ${order.delivery_address}\nTotal: ${formatCurrency(order.total_amount)}`,
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
      case 'delivered': return 'checkmark-done';
      case 'failed': return 'close-circle';
      case 'issue_reported': return 'warning';
      default: return 'help-circle';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'assigned': return 'Ready to Pick Up';
      case 'accepted': return 'Accepted';
      case 'picked_up': return 'Out for Delivery';
      case 'delivered': return 'Delivered';
      case 'failed': return 'Failed';
      case 'issue_reported': return 'Issue Reported';
      default: return status;
    }
  };

  const getNextStatusOptions = () => {
    switch (deliveryData.status) {
      case 'assigned':
      case 'accepted':
        return [
          { label: 'Picked Up Order', value: 'picked_up', icon: 'bicycle', color: '#0033A0' },
          { label: 'Report Issue', value: 'issue', icon: 'warning', color: '#EF4444' }
        ];
      case 'picked_up':
        return [
          { label: 'Mark as Delivered', value: 'delivered', icon: 'checkmark-circle', color: '#10B981' },
          { label: 'Report Issue', value: 'issue', icon: 'warning', color: '#EF4444' }
        ];
      default:
        return [];
    }
  };

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
          <TouchableOpacity onPress={fetchDeliveryDetails} style={styles.headerButton}>
            <Ionicons name="refresh" size={22} color="#0033A0" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Timer Card for Active Deliveries */}
        {deliveryData.status !== 'delivered' && deliveryData.status !== 'failed' && (
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
            <Text style={styles.orderNumber}>
              Order #{order?.order_number || order?.id}
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
                    } else {
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
                <Text style={styles.infoValue}>{order?.customer_name?.full_name || 'Customer'}</Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="call" size={18} color="#666" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Phone</Text>
                <Text style={styles.infoValue}>{order?.customer_name?.phone_number || 'Not provided'}</Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="location" size={18} color="#666" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Address</Text>
                <Text style={styles.infoValue}>{order?.delivery_address}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Order Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Items</Text>
          <View style={styles.itemsCard}>
            {order?.order_items?.map((item, index) => (
              <View key={index} style={styles.itemRow}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.products?.name}</Text>
                  <Text style={styles.itemQuantity}>
                    {item.quantity} {item.products?.unit} × {formatCurrency(item.price_at_order)}
                  </Text>
                </View>
                <Text style={styles.itemTotal}>
                  {formatCurrency(item.quantity * item.price_at_order)}
                </Text>
              </View>
            ))}
            
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Amount</Text>
              <Text style={styles.totalValue}>{formatCurrency(order?.total_amount)}</Text>
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
              <Text style={styles.paymentValue}>{order?.payment_method}</Text>
            </View>
            {order?.special_instructions && (
              <View style={styles.instructions}>
                <Ionicons name="document-text" size={18} color="#666" />
                <Text style={styles.instructionsText}>{order.special_instructions}</Text>
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
      <CustomAlertModal
        visible={showStatusModal}
        onClose={() => setShowStatusModal(false)}
        type="confirm"
        title="Update Delivery Status"
        message="Are you sure you want to update this delivery status?"
        confirmText="Confirm"
        cancelText="Cancel"
        showCancelButton={true}
        onConfirm={() => {
          const options = getNextStatusOptions();
          if (options.length > 0 && options[0].value !== 'issue') {
            updateDeliveryStatus(options[0].value);
          }
        }}
        loading={loading}
      />

      {/* Add Notes Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showNotesModal}
        onRequestClose={() => setShowNotesModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
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
                      .eq('id', delivery.id);
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

      {/* Report Issue Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showIssueModal}
        onRequestClose={() => setShowIssueModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
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
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    gap: 8,
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
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
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
  },
  saveModalButton: {
    backgroundColor: '#0033A0',
  },
  saveModalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  reportModalButton: {
    backgroundColor: '#EF4444',
  },
  reportModalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});