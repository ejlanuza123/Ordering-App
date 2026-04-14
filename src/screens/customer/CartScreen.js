import React, { useCallback, useState } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  StyleSheet,
  Platform,
  Modal,
  TextInput
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useCart } from '../../context/CartContext';
import CustomAlertModal from '../../components/CustomAlertModal';
import { supabase } from '../../lib/supabase';

export default function CartScreen({ navigation }) {
  const { cartItems, removeFromCart, updateQuantity, getCartTotal } = useCart();
  const insets = useSafeAreaInsets();
  const total = getCartTotal();
  const [defaultDeliveryFee, setDefaultDeliveryFee] = useState(50);
  const [removeModalVisible, setRemoveModalVisible] = useState(false);
  const [itemToRemove, setItemToRemove] = useState(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [itemToEdit, setItemToEdit] = useState(null);
  const [editMode, setEditMode] = useState('liters');
  const [editValue, setEditValue] = useState('1');

  const fetchDefaultDeliveryFee = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'default_delivery_fee')
        .single();

      if (error) {
        console.log('Could not fetch default delivery fee for cart:', error.message);
        return;
      }

      const parsedFee = parseFloat(data?.value);
      if (!Number.isNaN(parsedFee) && parsedFee >= 0) {
        setDefaultDeliveryFee(parsedFee);
      }
    } catch (error) {
      console.log('Error fetching default delivery fee for cart:', error.message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchDefaultDeliveryFee();
    }, [fetchDefaultDeliveryFee])
  );

  const deliveryFee = total >= 500 ? 0 : defaultDeliveryFee;
  const totalToPay = total + deliveryFee;
  
  const handleRemovePress = (item) => {
    setItemToRemove(item);
    setRemoveModalVisible(true);
  };

  const confirmRemove = () => {
    if (itemToRemove) {
      removeFromCart(itemToRemove.id);
      setRemoveModalVisible(false);
      setItemToRemove(null);
    }
  };

  const handleEditPress = (item) => {
    const isFuel = item.category === 'Fuel';
    const mode = isFuel ? 'liters' : 'bottle';

    setItemToEdit(item);
    setEditMode(mode);
    setEditValue(isFuel ? String(item.quantity.toFixed(2)) : String(item.quantity));
    setEditModalVisible(true);
  };

  const getEditedMetrics = () => {
    if (!itemToEdit) {
      return { quantity: 0, total: 0 };
    }

    const parsed = parseFloat(editValue);
    if (Number.isNaN(parsed) || parsed <= 0) {
      return { quantity: 0, total: 0 };
    }

    if (itemToEdit.category === 'Fuel') {
      if (editMode === 'amount') {
        const liters = parsed / itemToEdit.current_price;
        return { quantity: liters, total: parsed };
      }
      return { quantity: parsed, total: parsed * itemToEdit.current_price };
    }

    if (editMode === 'amount') {
      const bottles = parsed / itemToEdit.current_price;
      return { quantity: bottles, total: parsed };
    }

    return { quantity: parsed, total: parsed * itemToEdit.current_price };
  };

  const handleSaveEdit = () => {
    if (!itemToEdit) return;

    const { quantity } = getEditedMetrics();
    if (quantity <= 0) {
      return;
    }

    const normalizedQuantity =
      itemToEdit.category === 'Fuel'
        ? parseFloat(quantity.toFixed(2))
        : Math.max(1, Math.round(quantity));

    if (itemToEdit.stock_quantity !== undefined && normalizedQuantity > itemToEdit.stock_quantity) {
      return;
    }

    updateQuantity(itemToEdit.id, normalizedQuantity);
    setEditModalVisible(false);
    setItemToEdit(null);
  };

  const renderItem = ({ item }) => {
    const isFuel = item.category === 'Fuel';
    
    return (
      <TouchableOpacity style={styles.cartItem} activeOpacity={0.85} onPress={() => handleEditPress(item)}>
        <View style={styles.itemInfo}>
          <View style={styles.itemHeader}>
            <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
            <TouchableOpacity 
              onPress={() => handleRemovePress(item)}
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

          <Text style={styles.editHintText}>
            Tap item to edit by {isFuel ? 'liters/amount' : 'bottle/amount'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  // Empty state with consistent header layout
  if (cartItems.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Custom header for empty state to match main screen */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <TouchableOpacity 
              onPress={() => navigation.goBack()}
              style={styles.backButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="arrow-back" size={24} color="#0033A0" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>My Cart</Text>
            <View style={{width: 40}} />
          </View>
        </View>

        {/* Empty Content */}
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

  // Main cart screen with items
  return (
    <>
      <CustomAlertModal
        visible={removeModalVisible}
        onClose={() => setRemoveModalVisible(false)}
        type="confirm"
        title="Remove Item"
        message={`Are you sure you want to remove "${itemToRemove?.name}" from your cart?`}
        confirmText="Yes, Remove"
        cancelText="Cancel"
        showCancelButton={true}
        onConfirm={confirmRemove}
      />
      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlayEditor}>
          <View style={styles.modalCardEditor}>
            <View style={styles.modalEditorHeader}>
              <Text style={styles.modalEditorTitle}>Edit Order Amount</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close" size={24} color="#374151" />
              </TouchableOpacity>
            </View>

            {itemToEdit && (
              <>
                <Text style={styles.modalEditorItemName}>{itemToEdit.name}</Text>
                <Text style={styles.modalEditorItemPrice}>₱{itemToEdit.current_price.toFixed(2)} per {itemToEdit.unit}</Text>

                <View style={styles.modalModeRow}>
                  {itemToEdit.category === 'Fuel' ? (
                    <>
                      <TouchableOpacity
                        style={[styles.modalModeBtn, editMode === 'liters' && styles.modalModeBtnActive]}
                        onPress={() => {
                          setEditMode('liters');
                          setEditValue(String(itemToEdit.quantity.toFixed(2)));
                        }}
                      >
                        <Text style={[styles.modalModeText, editMode === 'liters' && styles.modalModeTextActive]}>By Liters</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.modalModeBtn, editMode === 'amount' && styles.modalModeBtnActive]}
                        onPress={() => {
                          setEditMode('amount');
                          setEditValue(String(itemToEdit.totalItemPrice.toFixed(2)));
                        }}
                      >
                        <Text style={[styles.modalModeText, editMode === 'amount' && styles.modalModeTextActive]}>By Amount</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <TouchableOpacity
                        style={[styles.modalModeBtn, editMode === 'bottle' && styles.modalModeBtnActive]}
                        onPress={() => {
                          setEditMode('bottle');
                          setEditValue(String(itemToEdit.quantity));
                        }}
                      >
                        <Text style={[styles.modalModeText, editMode === 'bottle' && styles.modalModeTextActive]}>By Bottle</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.modalModeBtn, editMode === 'amount' && styles.modalModeBtnActive]}
                        onPress={() => {
                          setEditMode('amount');
                          setEditValue(String(itemToEdit.totalItemPrice.toFixed(2)));
                        }}
                      >
                        <Text style={[styles.modalModeText, editMode === 'amount' && styles.modalModeTextActive]}>By Amount</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>

                <View style={styles.modalInputWrap}>
                  <TextInput
                    style={styles.modalInput}
                    keyboardType="numeric"
                    value={editValue}
                    onChangeText={(text) => setEditValue(text.replace(/[^0-9.]/g, ''))}
                    placeholder={editMode === 'amount' ? 'Enter amount' : 'Enter quantity'}
                  />
                </View>

                <View style={styles.modalSummaryBox}>
                  <Text style={styles.modalSummaryText}>
                    Qty: {itemToEdit.category === 'Fuel' ? getEditedMetrics().quantity.toFixed(2) : Math.max(1, Math.round(getEditedMetrics().quantity || 0))}
                  </Text>
                  <Text style={styles.modalSummaryText}>
                    Total: ₱{getEditedMetrics().total.toFixed(2)}
                  </Text>
                </View>

                <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSaveEdit}>
                  <Text style={styles.modalSaveText}>Save Changes</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Custom header for main screen */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <TouchableOpacity 
              onPress={() => navigation.goBack()}
              style={styles.backButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="arrow-back" size={24} color="#0033A0" />
            </TouchableOpacity>
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle}>My Cart</Text>
              <Text style={styles.headerSubtitle}>
                {cartItems.length} {cartItems.length === 1 ? 'item' : 'items'}
              </Text>
            </View>
            <View style={{width: 40}} />
          </View>
        </View>

        {/* List of Items */}
        <FlatList
          data={cartItems}
          keyExtractor={(item, index) => item.id.toString() + index}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: 120 } // Increased padding to make room for footer
          ]}
          showsVerticalScrollIndicator={false}
        />

        {/* Fixed Footer - REMOVED absolute positioning */}
        <View style={[styles.footer, { paddingBottom: insets.bottom }]}>
          <View style={styles.summaryContainer}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>₱{total.toFixed(2)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Delivery Fee</Text>
              <Text style={styles.summaryValue}>{deliveryFee === 0 ? 'FREE' : `₱${deliveryFee.toFixed(2)}`}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total to Pay</Text>
              <Text style={styles.totalAmount}>₱{totalToPay.toFixed(2)}</Text>
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
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  // Header styles - consistent for both empty and non-empty states
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
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0033A0',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f4ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Empty state styles
  emptyContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    marginTop: -60, // Adjust for visual centering
  },
  emptyIcon: {
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
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
  // List styles
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
  editHintText: {
    marginTop: 10,
    fontSize: 12,
    color: '#4B628A',
    fontWeight: '600',
  },
  modalOverlayEditor: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalCardEditor: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 18,
  },
  modalEditorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalEditorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  modalEditorItemName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0033A0',
    marginBottom: 2,
  },
  modalEditorItemPrice: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 14,
  },
  modalModeRow: {
    flexDirection: 'row',
    backgroundColor: '#EEF4FF',
    borderRadius: 12,
    padding: 4,
    marginBottom: 12,
  },
  modalModeBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 9,
  },
  modalModeBtnActive: {
    backgroundColor: '#0033A0',
  },
  modalModeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#34507E',
  },
  modalModeTextActive: {
    color: '#fff',
  },
  modalInputWrap: {
    borderWidth: 1,
    borderColor: '#DCE5F5',
    borderRadius: 12,
    marginBottom: 12,
    paddingHorizontal: 12,
  },
  modalInput: {
    height: 46,
    fontSize: 16,
    color: '#1F2937',
  },
  modalSummaryBox: {
    backgroundColor: '#F8FBFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2EAF7',
    padding: 12,
    marginBottom: 14,
  },
  modalSummaryText: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '600',
    marginBottom: 4,
  },
  modalSaveBtn: {
    backgroundColor: '#0033A0',
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 14,
  },
  modalSaveText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  // Footer styles
  footer: {
    left: 0,
    right: 0,
    bottom: 10,
    backgroundColor: 'white',
    padding: 20,
    paddingBottom: 10,
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