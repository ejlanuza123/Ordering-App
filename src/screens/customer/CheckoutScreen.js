import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Alert, 
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
  SafeAreaView,
  StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function CheckoutScreen({ navigation }) {
  const { cartItems, getCartTotal, clearCart } = useCart();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('Cash on Delivery');
  const [specialInstructions, setSpecialInstructions] = useState('');
  
  const totalAmount = getCartTotal();

  // Calculate delivery fee (free for orders above ₱500)
  const deliveryFee = totalAmount >= 500 ? 0 : 50;
  const grandTotal = totalAmount + deliveryFee;

  // Fetch saved addresses
  useEffect(() => {
    fetchSavedAddresses();
  }, []);

  const fetchSavedAddresses = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('address')
        .eq('id', user.id)
        .single();

      if (data && data.address) {
        setSavedAddresses([data.address]);
        setAddress(data.address);
      }
    } catch (error) {
      console.log('Error fetching addresses:', error.message);
    }
  };

  const saveAddressToProfile = async () => {
    if (!address.trim()) return;

    setSavingAddress(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ address: address })
        .eq('id', user.id);

      if (error) throw error;
      
      Alert.alert('Success', 'Address saved to your profile!');
      setSavedAddresses([address]);
    } catch (error) {
      Alert.alert('Error', 'Failed to save address.');
    } finally {
      setSavingAddress(false);
    }
  };

  const handlePlaceOrder = async () => {
    if (!address.trim()) {
      Alert.alert('Missing Info', 'Please enter your delivery address.');
      return;
    }

    if (cartItems.length === 0) {
      Alert.alert('Error', 'Your cart is empty.');
      return;
    }

    setLoading(true);

    try {
      // 1. Create the Main Order Record
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert([
          {
            user_id: user.id,
            total_amount: grandTotal,
            delivery_address: address,
            payment_method: paymentMethod,
            special_instructions: specialInstructions.trim() || null,
            status: 'Pending'
          }
        ])
        .select()
        .single();

      if (orderError) throw orderError;

      const orderId = orderData.id;

      // 2. Prepare Order Items
      const orderItemsData = cartItems.map((item) => ({
        order_id: orderId,
        product_id: item.id,
        quantity: item.quantity,
        price_at_order: item.current_price,
        product_name: item.name // Store product name for reference
      }));

      // 3. Insert All Items
      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItemsData);

      if (itemsError) throw itemsError;

      // 4. Show success modal with order details
      showSuccessModal(orderId, grandTotal);

      // 5. Clear cart
      clearCart();

    } catch (error) {
      console.error('Checkout Error:', error);
      Alert.alert('Order Failed', error.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const showSuccessModal = (orderId, total) => {
    Alert.alert(
      '🎉 Order Placed Successfully!',
      `Order #${orderId}\n\nTotal: ₱${total.toFixed(2)}\n\nYour order has been received and is being processed. You can track your order in the Orders section.`,
      [
        { 
          text: 'Track Order', 
          onPress: () => navigation.navigate('OrderHistory')
        },
        { 
          text: 'Continue Shopping',
          style: 'default',
          onPress: () => navigation.navigate('Selection')
        }
      ]
    );
  };

  const selectSavedAddress = (selectedAddress) => {
    setAddress(selectedAddress);
    setShowAddressModal(false);
  };

  const formatItemQuantity = (item) => {
    if (item.category === 'Fuel') {
      return `${item.quantity.toFixed(2)} Liters`;
    }
    return `${item.quantity} ${item.unit}(s)`;
  };

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView 
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Header with Back Button */}
          <View style={styles.header}>
            <TouchableOpacity 
              onPress={() => navigation.goBack()}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={24} color="#0033A0" />
            </TouchableOpacity>
            <Text style={styles.title}>Checkout</Text>
            <View style={{width: 40}} />
          </View>

          {/* Progress Steps */}
          <View style={styles.progressContainer}>
            <View style={styles.progressStep}>
              <View style={[styles.progressCircle, styles.progressCircleActive]}>
                <Ionicons name="cart" size={20} color="#fff" />
              </View>
              <Text style={styles.progressTextActive}>Cart</Text>
            </View>
            
            <View style={styles.progressLine} />
            
            <View style={styles.progressStep}>
              <View style={[styles.progressCircle, styles.progressCircleActive]}>
                <Text style={styles.progressNumber}>2</Text>
              </View>
              <Text style={styles.progressTextActive}>Checkout</Text>
            </View>
            
            <View style={styles.progressLine} />
            
            <View style={styles.progressStep}>
              <View style={styles.progressCircle}>
                <Text style={styles.progressNumber}>3</Text>
              </View>
              <Text style={styles.progressText}>Complete</Text>
            </View>
          </View>

          {/* Order Summary Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="receipt" size={24} color="#0033A0" />
              <Text style={styles.cardTitle}>Order Summary</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Cart')}>
                <Text style={styles.editButton}>Edit</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.itemsContainer}>
              {cartItems.map((item, index) => (
                <View key={index} style={styles.itemRow}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.itemDetails}>
                      {formatItemQuantity(item)} @ ₱{item.current_price.toFixed(2)}
                    </Text>
                  </View>
                  <Text style={styles.itemPrice}>₱{item.totalItemPrice.toFixed(2)}</Text>
                </View>
              ))}
            </View>
            
            <View style={styles.divider} />
            
            <View style={styles.summarySection}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal</Text>
                <Text style={styles.summaryValue}>₱{totalAmount.toFixed(2)}</Text>
              </View>
              
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Delivery Fee</Text>
                <Text style={[
                  styles.summaryValue,
                  deliveryFee === 0 && styles.freeDelivery
                ]}>
                  {deliveryFee === 0 ? 'FREE' : `₱${deliveryFee.toFixed(2)}`}
                </Text>
              </View>
              
              {deliveryFee === 0 && (
                <View style={styles.freeDeliveryBadge}>
                  <Ionicons name="trophy" size={16} color="#10B981" />
                  <Text style={styles.freeDeliveryText}>Free delivery on orders ₱500+</Text>
                </View>
              )}
              
              <View style={styles.divider} />
              
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total to Pay</Text>
                <Text style={styles.totalAmount}>₱{grandTotal.toFixed(2)}</Text>
              </View>
            </View>
          </View>

          {/* Delivery Address Section */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="location" size={24} color="#0033A0" />
              <Text style={styles.cardTitle}>Delivery Address</Text>
              {savedAddresses.length > 0 && (
                <TouchableOpacity onPress={() => setShowAddressModal(true)}>
                  <Text style={styles.editButton}>Saved</Text>
                </TouchableOpacity>
              )}
            </View>
            
            <Text style={styles.sectionSubtitle}>Where should we deliver your order?</Text>
            
            <TextInput
              style={styles.inputArea}
              placeholder="House No., Street, Barangay, City..."
              value={address}
              onChangeText={setAddress}
              multiline
              numberOfLines={3}
              placeholderTextColor="#999"
            />
            
            <TouchableOpacity 
              style={styles.saveAddressButton}
              onPress={saveAddressToProfile}
              disabled={savingAddress || !address.trim()}
            >
              {savingAddress ? (
                <ActivityIndicator size="small" color="#0033A0" />
              ) : (
                <>
                  <Ionicons name="bookmark" size={16} color="#0033A0" />
                  <Text style={styles.saveAddressText}>Save to my addresses</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Payment Method Section */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="card" size={24} color="#0033A0" />
              <Text style={styles.cardTitle}>Payment Method</Text>
            </View>
            
            <View style={styles.paymentOptions}>
              <TouchableOpacity 
                style={[
                  styles.paymentOption,
                  paymentMethod === 'Cash on Delivery' && styles.paymentOptionSelected
                ]}
                onPress={() => setPaymentMethod('Cash on Delivery')}
              >
                <Ionicons 
                  name="cash" 
                  size={24} 
                  color={paymentMethod === 'Cash on Delivery' ? '#0033A0' : '#666'} 
                />
                <View style={styles.paymentOptionInfo}>
                  <Text style={[
                    styles.paymentOptionTitle,
                    paymentMethod === 'Cash on Delivery' && styles.paymentOptionTitleSelected
                  ]}>
                    Cash on Delivery
                  </Text>
                  <Text style={styles.paymentOptionDescription}>
                    Pay when you receive your order
                  </Text>
                </View>
                {paymentMethod === 'Cash on Delivery' && (
                  <Ionicons name="checkmark-circle" size={24} color="#0033A0" />
                )}
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.paymentOption,
                  paymentMethod === 'GCash' && styles.paymentOptionSelected
                ]}
                onPress={() => setPaymentMethod('GCash')}
              >
                <View style={[styles.gcashIcon, { backgroundColor: paymentMethod === 'GCash' ? '#0033A0' : '#f0f4ff' }]}>
                  <Text style={[styles.gcashText, { color: paymentMethod === 'GCash' ? '#fff' : '#0033A0' }]}>G</Text>
                </View>
                <View style={styles.paymentOptionInfo}>
                  <Text style={[
                    styles.paymentOptionTitle,
                    paymentMethod === 'GCash' && styles.paymentOptionTitleSelected
                  ]}>
                    GCash
                  </Text>
                  <Text style={styles.paymentOptionDescription}>
                    Pay via GCash (Coming Soon)
                  </Text>
                </View>
                {paymentMethod === 'GCash' && (
                  <Ionicons name="checkmark-circle" size={24} color="#0033A0" />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Special Instructions */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="document-text" size={24} color="#0033A0" />
              <Text style={styles.cardTitle}>Special Instructions</Text>
            </View>
            
            <TextInput
              style={styles.specialInstructionsInput}
              placeholder="Any special instructions for delivery? (Optional)"
              value={specialInstructions}
              onChangeText={setSpecialInstructions}
              multiline
              numberOfLines={2}
              placeholderTextColor="#999"
            />
          </View>

          {/* Terms and Conditions */}
          <View style={styles.termsContainer}>
            <Text style={styles.termsText}>
              By placing your order, you agree to our Terms of Service and Privacy Policy. Delivery time: 15-30 minutes.
            </Text>
          </View>

          {/* Place Order Button */}
          <TouchableOpacity 
            style={[
              styles.placeOrderButton,
              (loading || cartItems.length === 0) && styles.placeOrderButtonDisabled
            ]}
            onPress={handlePlaceOrder}
            disabled={loading || cartItems.length === 0}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.placeOrderText}>PLACE ORDER</Text>
                <View style={styles.orderTotalBadge}>
                  <Text style={styles.orderTotalText}>₱{grandTotal.toFixed(2)}</Text>
                </View>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Saved Addresses Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showAddressModal}
        onRequestClose={() => setShowAddressModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Saved Addresses</Text>
              <TouchableOpacity onPress={() => setShowAddressModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.addressesList}>
              {savedAddresses.map((savedAddress, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.addressItem}
                  onPress={() => selectSavedAddress(savedAddress)}
                >
                  <Ionicons name="location" size={20} color="#0033A0" />
                  <Text style={styles.addressText}>{savedAddress}</Text>
                  <Ionicons name="chevron-forward" size={20} color="#999" />
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            <TouchableOpacity 
              style={styles.addNewAddressButton}
              onPress={() => {
                setShowAddressModal(false);
                setAddress('');
              }}
            >
              <Ionicons name="add-circle" size={20} color="#0033A0" />
              <Text style={styles.addNewAddressText}>Add New Address</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingTop: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f4ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#0033A0',
  },
  // Progress Steps
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 30,
    paddingHorizontal: 10,
  },
  progressStep: {
    alignItems: 'center',
  },
  progressCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e9ecef',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressCircleActive: {
    backgroundColor: '#0033A0',
  },
  progressNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
  },
  progressLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#e9ecef',
    marginHorizontal: 10,
  },
  progressText: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
  },
  progressTextActive: {
    color: '#0033A0',
    fontWeight: 'bold',
  },
  // Cards
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  cardTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 10,
  },
  editButton: {
    color: '#0033A0',
    fontSize: 14,
    fontWeight: '600',
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  // Order Items
  itemsContainer: {
    marginBottom: 15,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f4ff',
  },
  itemInfo: {
    flex: 1,
    marginRight: 10,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  itemDetails: {
    fontSize: 13,
    color: '#666',
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ED2939',
  },
  divider: {
    height: 1,
    backgroundColor: '#e9ecef',
    marginVertical: 16,
  },
  // Summary
  summarySection: {
    paddingTop: 5,
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
    fontWeight: '600',
    color: '#333',
  },
  freeDelivery: {
    color: '#10B981',
    fontWeight: 'bold',
  },
  freeDeliveryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B98110',
    padding: 8,
    borderRadius: 8,
    marginTop: 10,
  },
  freeDeliveryText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '600',
    marginLeft: 6,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ED2939',
  },
  // Address Input
  inputArea: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#e9ecef',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  saveAddressButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f4ff',
    padding: 12,
    borderRadius: 10,
    marginTop: 12,
    justifyContent: 'center',
  },
  saveAddressText: {
    color: '#0033A0',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  // Payment Options
  paymentOptions: {
    marginTop: 10,
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  paymentOptionSelected: {
    backgroundColor: '#f0f4ff',
    borderColor: '#0033A0',
  },
  paymentOptionInfo: {
    flex: 1,
    marginLeft: 15,
    marginRight: 15,
  },
  paymentOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  paymentOptionTitleSelected: {
    color: '#0033A0',
  },
  paymentOptionDescription: {
    fontSize: 13,
    color: '#666',
  },
  gcashIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gcashText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  // Special Instructions
  specialInstructionsInput: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#e9ecef',
    minHeight: 60,
    textAlignVertical: 'top',
  },
  // Terms
  termsContainer: {
    backgroundColor: '#f0f7ff',
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
  },
  termsText: {
    fontSize: 12,
    color: '#0033A0',
    lineHeight: 16,
    textAlign: 'center',
  },
  // Place Order Button
  placeOrderButton: {
    backgroundColor: '#0033A0',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
    borderRadius: 12,
    elevation: 5,
    shadowColor: '#0033A0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    marginBottom: 30,
  },
  placeOrderButtonDisabled: {
    backgroundColor: '#8da2c0',
  },
  placeOrderText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  orderTotalBadge: {
    backgroundColor: '#ED2939',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginLeft: 15,
  },
  orderTotalText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
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
    paddingBottom: 30,
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  addressesList: {
    paddingHorizontal: 20,
    maxHeight: 300,
  },
  addressItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  addressText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: '#333',
  },
  addNewAddressButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    marginTop: 10,
  },
  addNewAddressText: {
    color: '#0033A0',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});