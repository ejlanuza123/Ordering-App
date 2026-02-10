import React from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  StyleSheet, 
  Alert 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCart } from '../../context/CartContext';

export default function CartScreen({ navigation }) {
  const { cartItems, removeFromCart, getCartTotal } = useCart();
  const total = getCartTotal();

  // 1. Render each item in the cart
  const renderItem = ({ item }) => {
    const isFuel = item.category === 'Fuel';
    
    return (
      <View style={styles.cartItem}>
        <View style={styles.itemInfo}>
          <Text style={styles.itemName}>{item.name}</Text>
          <Text style={styles.itemDetails}>
            {/* Display Logic: 5.2 Liters vs 2 Bottles */}
            {isFuel 
              ? `${item.quantity.toFixed(2)} Liters` 
              : `${item.quantity} ${item.unit}(s)`} 
            {' @ '}₱{item.current_price}
          </Text>
        </View>

        <View style={styles.itemRight}>
          <Text style={styles.itemTotal}>
            ₱{item.totalItemPrice.toFixed(2)}
          </Text>
          <TouchableOpacity 
            onPress={() => removeFromCart(item.id)}
            style={styles.removeBtn}
          >
            <Ionicons name="trash-outline" size={20} color="#ED2939" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // 2. Handle Empty Cart
  if (cartItems.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="cart-outline" size={80} color="#ccc" />
        <Text style={styles.emptyText}>Your cart is empty</Text>
        <TouchableOpacity 
          style={styles.shopButton}
          onPress={() => navigation.navigate('Home')}
        >
          <Text style={styles.shopButtonText}>Start Ordering</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>My Order</Text>

      {/* List of Items */}
      <FlatList
        data={cartItems}
        keyExtractor={(item, index) => item.id.toString() + index} // simple unique key
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
      />

      {/* Footer Section */}
      <View style={styles.footer}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Grand Total</Text>
          <Text style={styles.totalAmount}>₱{total.toFixed(2)}</Text>
        </View>

        <TouchableOpacity 
          style={styles.checkoutButton}
          onPress={() => navigation.navigate('Checkout')} 
        >
          <Text style={styles.checkoutText}>PROCEED TO CHECKOUT</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9f9f9' },
  headerTitle: {
    fontSize: 24, fontWeight: 'bold', color: '#0033A0',
    padding: 20, backgroundColor: '#fff', elevation: 2
  },
  listContent: { padding: 15 },
  
  // Cart Item Styles
  cartItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: 'white', padding: 15, borderRadius: 10, marginBottom: 10,
    elevation: 2
  },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  itemDetails: { fontSize: 14, color: '#666', marginTop: 4 },
  
  itemRight: { alignItems: 'flex-end' },
  itemTotal: { fontSize: 16, fontWeight: 'bold', color: '#0033A0', marginBottom: 5 },
  removeBtn: { padding: 5 },

  // Empty State Styles
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 18, color: '#888', marginTop: 10, marginBottom: 20 },
  shopButton: { backgroundColor: '#0033A0', paddingVertical: 12, paddingHorizontal: 30, borderRadius: 25 },
  shopButtonText: { color: 'white', fontWeight: 'bold' },

  // Footer Styles
  footer: { 
    backgroundColor: 'white', padding: 20, 
    borderTopWidth: 1, borderTopColor: '#eee', elevation: 10 
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  totalLabel: { fontSize: 18, fontWeight: '600', color: '#333' },
  totalAmount: { fontSize: 24, fontWeight: 'bold', color: '#ED2939' },
  
  checkoutButton: {
    backgroundColor: '#ED2939', padding: 15, borderRadius: 10, alignItems: 'center'
  },
  checkoutText: { color: 'white', fontWeight: 'bold', fontSize: 16, letterSpacing: 1 }
});