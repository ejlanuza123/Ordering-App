import React from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  StyleSheet,
  Alert,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCart } from '../../context/CartContext';
import { Header } from '../../components/Header';

export default function CartScreen({ navigation }) {
  const { cartItems, removeFromCart, getCartTotal } = useCart();
  const insets = useSafeAreaInsets();
  const total = getCartTotal();

  const renderItem = ({ item }) => {
    const isFuel = item.category === 'Fuel';
    
    return (
      <View style={styles.cartItem}>
        <View style={styles.itemInfo}>
          <View style={styles.itemHeader}>
            <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
            <TouchableOpacity 
              onPress={() => removeFromCart(item.id)}
              style={styles.removeBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="trash-outline" size={20} color="#ED2939" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.itemDetailsRow}>
            <Text style={styles.itemDetails}>
              {isFuel 
                ? `${item.quantity.toFixed(2)} Liters` 
                : `${item.quantity} ${item.unit}(s)`} 
              {' @ '}₱{item.current_price.toFixed(2)}
            </Text>
            <Text style={styles.itemTotal}>
              ₱{item.totalItemPrice.toFixed(2)}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  if (cartItems.length === 0) {
    return (
      <View style={[styles.emptyContainer, { paddingTop: insets.top }]}>
        <Header
          title="My Cart"
          showBackButton={true}
          onBackPress={() => navigation.goBack()}
          backgroundColor="#fff"
        />
        <View style={[styles.emptyContent, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.emptyIcon}>
            <Ionicons name="cart-outline" size={80} color="#ccc" />
          </View>
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptySubtitle}>
            Add some fuel or lubricants to get started
          </Text>
          <TouchableOpacity 
            style={styles.shopButton}
            onPress={() => navigation.navigate('Selection')}
            activeOpacity={0.8}
          >
            <Text style={styles.shopButtonText}>Browse Products</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header
        title="My Cart"
        subtitle={`${cartItems.length} ${cartItems.length === 1 ? 'item' : 'items'}`}
        showBackButton={true}
        onBackPress={() => navigation.goBack()}
        backgroundColor="#fff"
      />

      {/* List of Items */}
      <FlatList
        data={cartItems}
        keyExtractor={(item, index) => item.id.toString() + index}
        renderItem={renderItem}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 200 } // Extra padding for footer
        ]}
        showsVerticalScrollIndicator={false}
      />

      {/* Fixed Footer with safe area padding */}
      <View style={[styles.footer, { bottom: insets.bottom }]}>
        <View style={styles.summaryContainer}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>₱{total.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Delivery Fee</Text>
            <Text style={styles.summaryValue}>₱0.00</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total to Pay</Text>
            <Text style={styles.totalAmount}>₱{total.toFixed(2)}</Text>
          </View>
        </View>

        <TouchableOpacity 
          style={styles.checkoutButton}
          onPress={() => navigation.navigate('Checkout')}
          activeOpacity={0.8}
        >
          <Text style={styles.checkoutText}>PROCEED TO CHECKOUT</Text>
          <Ionicons name="arrow-forward" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  emptyContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  shopButton: {
    backgroundColor: '#0033A0',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  shopButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  listContent: {
    padding: 20,
  },
  cartItem: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  itemInfo: {
    flex: 1,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    marginRight: 10,
  },
  removeBtn: {
    padding: 4,
  },
  itemDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemDetails: {
    fontSize: 14,
    color: '#666',
  },
  itemTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0033A0',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: 'white',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  summaryContainer: {
    marginBottom: 20,
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
    fontWeight: '600',
    color: '#333',
  },
  divider: {
    height: 1,
    backgroundColor: '#e9ecef',
    marginVertical: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ED2939',
  },
  checkoutButton: {
    backgroundColor: '#ED2939',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    elevation: 5,
    shadowColor: '#ED2939',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  checkoutText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    marginRight: 8,
  },
});