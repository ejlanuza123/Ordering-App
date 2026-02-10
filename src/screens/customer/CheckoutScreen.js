import React, { useState } from 'react';
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
  ScrollView
} from 'react-native';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

export default function CheckoutScreen({ navigation }) {
  const { cartItems, getCartTotal, clearCart } = useCart();
  const { user } = useAuth();
  
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  
  const totalAmount = getCartTotal();

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
            total_amount: totalAmount,
            delivery_address: address,
            status: 'Pending',
            payment_method: 'Cash on Delivery' // Hardcoded for OJT simplicity
          }
        ])
        .select()
        .single(); // We need the returned ID

      if (orderError) throw orderError;

      const orderId = orderData.id;

      // 2. Prepare Order Items
      const orderItemsData = cartItems.map((item) => ({
        order_id: orderId,
        product_id: item.id,
        quantity: item.quantity,
        price_at_order: item.current_price // Saves the price at this moment
      }));

      // 3. Insert All Items
      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItemsData);

      if (itemsError) throw itemsError;

      // 4. Success!
      clearCart(); // Empty the cart
      Alert.alert(
        'Order Placed!', 
        'Your order has been received. Please wait for delivery.',
        [{ text: 'OK', onPress: () => navigation.navigate('Home') }]
      );

    } catch (error) {
      console.error('Checkout Error:', error);
      Alert.alert('Order Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        <View style={styles.header}>
          <Text style={styles.title}>Checkout</Text>
        </View>

        {/* Order Summary Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Order Summary</Text>
          {cartItems.map((item, index) => (
            <View key={index} style={styles.summaryRow}>
              <Text style={styles.itemName}>
                {item.quantity.toFixed(2)} x {item.name}
              </Text>
              <Text style={styles.itemPrice}>
                ₱{item.totalItemPrice.toFixed(2)}
              </Text>
            </View>
          ))}
          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total to Pay</Text>
            <Text style={styles.totalAmount}>₱{totalAmount.toFixed(2)}</Text>
          </View>
        </View>

        {/* Delivery Details Input */}
        <View style={styles.formSection}>
          <Text style={styles.label}>Delivery Address</Text>
          <TextInput
            style={styles.inputArea}
            placeholder="House No., Street, Barangay, San Pedro..."
            value={address}
            onChangeText={setAddress}
            multiline
            numberOfLines={3}
          />
          <Text style={styles.paymentNote}>
            Payment Method: <Text style={{fontWeight:'bold'}}>Cash on Delivery</Text>
          </Text>
        </View>

        {/* Submit Button */}
        <TouchableOpacity 
          style={styles.placeOrderBtn} 
          onPress={handlePlaceOrder}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.btnText}>PLACE ORDER</Text>
          )}
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scrollContent: { padding: 20 },
  header: { marginBottom: 20 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#0033A0' },
  
  card: {
    backgroundColor: 'white', padding: 20, borderRadius: 12, marginBottom: 20,
    elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 4
  },
  cardTitle: { fontSize: 18, fontWeight: '600', marginBottom: 15, color: '#333' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  itemName: { color: '#555', flex: 1 },
  itemPrice: { fontWeight: '600', color: '#333' },
  divider: { height: 1, backgroundColor: '#eee', marginVertical: 10 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 },
  totalLabel: { fontSize: 18, fontWeight: 'bold' },
  totalAmount: { fontSize: 18, fontWeight: 'bold', color: '#ED2939' },

  formSection: { marginBottom: 30 },
  label: { fontSize: 16, fontWeight: '600', marginBottom: 8, color: '#333' },
  inputArea: {
    backgroundColor: 'white', padding: 15, borderRadius: 10,
    borderWidth: 1, borderColor: '#ddd', height: 100, textAlignVertical: 'top',
    fontSize: 16
  },
  paymentNote: { marginTop: 10, color: '#666', fontStyle: 'italic', fontSize: 14 },

  placeOrderBtn: {
    backgroundColor: '#ED2939', padding: 18, borderRadius: 10,
    alignItems: 'center', elevation: 5
  },
  btnText: { color: 'white', fontWeight: 'bold', fontSize: 18, letterSpacing: 1 }
});