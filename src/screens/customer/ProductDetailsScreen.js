// src/screens/customer/ProductDetailsScreen.js
import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  Image, 
  KeyboardAvoidingView, 
  Platform,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { useFavorites } from '../../context/FavoritesContext';
import CustomAlertModal from '../../components/CustomAlertModal';

const { width, height } = Dimensions.get('window');

export default function ProductDetailsScreen({ route, navigation }) {
  const { product } = route.params;
  const { user } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [quantity, setQuantity] = useState('1');
  const [totalPrice, setTotalPrice] = useState(product.current_price);
  const [mode, setMode] = useState('liters');
  const [showAlert, setShowAlert] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    type: 'warning',
    title: '',
    message: ''
  });
  const { addToCart } = useCart();
  const insets = useSafeAreaInsets();

  const handleFavPress = async () => {
    if (!user) return;
    const added = await toggleFavorite(product.id);
    setAlertConfig({
      type: 'success',
      title: added ? 'Added to Favorites' : 'Removed from Favorites',
      message: added ? `${product.name} has been added to your favorites.`
                     : `${product.name} has been removed from your favorites.`
    });
    setShowAlert(true);
  };

  const isFuel = product.category === 'Fuel';

  useEffect(() => {
    if (!quantity || isNaN(quantity)) {
      setTotalPrice(0);
      return;
    }

    const val = parseFloat(quantity);
    
    if (mode === 'liters') {
      setTotalPrice(val * product.current_price);
    } else {
      setTotalPrice(val);
    }
  }, [quantity, mode]);

  const handleInputChange = (text) => {
    const cleanText = text.replace(/[^0-9.]/g, '');
    setQuantity(cleanText);
  };

  const handleAddToCart = () => {
    if (totalPrice <= 0) {
      setAlertConfig({
        type: 'warning',
        title: 'Error',
        message: 'Please enter a valid amount.'
      });
      setShowAlert(true);
      return;
    }

    const finalLiters = mode === 'liters' 
      ? parseFloat(quantity) 
      : parseFloat(quantity) / product.current_price;

    addToCart(product, finalLiters, parseFloat(totalPrice));
    
    setAlertConfig({
      type: 'success',
      title: 'Added to Cart',
      message: `${product.name} has been added to your cart.`
    });
    setShowAlert(true);
  };

  return (
    <>
      <CustomAlertModal
        visible={showAlert}
        onClose={() => {
          setShowAlert(false);
          if (alertConfig.type === 'success') {
            navigation.goBack();
          }
        }}
        type={alertConfig.type}
        title={alertConfig.title}
        message={alertConfig.message}
        confirmText="OK"
      />
      
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          {/* Back Button - Fixed position */}
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>

          {/* Product Image - Fixed height */}
          <View style={styles.imageContainer}>
            {product.image_url ? (
              <Image source={{ uri: product.image_url }} style={styles.image} />
            ) : (
              <View style={[
                styles.placeholderImage, 
                { backgroundColor: isFuel ? '#0033A0' : '#ED2939' }
              ]}>
                <Ionicons 
                  name={isFuel ? "water" : "water"} 
                  size={60} 
                  color="#fff" 
                />
              </View>
            )}
          </View>

          {/* Content - Takes remaining space */}
          <View style={styles.content}>
            {/* Title & Price */}
            <View style={styles.headerRow}>
              <View style={styles.titleContainer}>
                <Text style={styles.title} numberOfLines={2}>{product.name}</Text>
                <View style={styles.categoryContainer}>
                  <View style={[
                    styles.categoryBadge,
                    { backgroundColor: isFuel ? '#0033A0' : '#ED2939' }
                  ]}>
                    <Text style={styles.categoryText}>
                      {product.category}
                    </Text>
                  </View>
                  {product.stock_quantity > 0 && (
                    <View style={styles.stockBadge}>
                      <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                      <Text style={styles.stockText}>In Stock</Text>
                    </View>
                  )}
                </View>
              </View>
              <View style={styles.priceContainer}>
                <Text style={styles.unitPrice}>
                  ₱{product.current_price.toFixed(2)}
                  <Text style={styles.unit}>/{product.unit}</Text>
                </Text>
              </View>
              {/* favorite icon in details header */}
              <TouchableOpacity
                style={styles.detailFavButton}
                onPress={handleFavPress}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={isFavorite(product.id) ? 'heart' : 'heart-outline'}
                  size={24}
                  color={isFavorite(product.id) ? '#ED2939' : '#fff'}
                />
              </TouchableOpacity>
            </View>

            {product.description && (
              <View style={styles.descriptionContainer}>
                <Text style={styles.descriptionTitle}>Description</Text>
                <Text style={styles.descriptionText} numberOfLines={2}>
                  {product.description}
                </Text>
              </View>
            )}

            <View style={styles.divider} />

            {/* Quantity Input Section */}
            <Text style={styles.sectionTitle}>
              {isFuel ? 'How much would you like?' : 'Select Quantity'}
            </Text>

            {/* Toggle for Fuel */}
            {isFuel && (
              <View style={styles.toggleContainer}>
                <TouchableOpacity 
                  style={[styles.toggleBtn, mode === 'liters' && styles.activeToggle]}
                  onPress={() => { setMode('liters'); setQuantity('1'); }}
                  activeOpacity={0.7}
                >
                  <Ionicons 
                    name="water" 
                    size={20} 
                    color={mode === 'liters' ? '#0033A0' : '#666'} 
                  />
                  <Text style={[styles.toggleText, mode === 'liters' && styles.activeText]}>
                    By Liters
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.toggleBtn, mode === 'amount' && styles.activeToggle]}
                  onPress={() => { setMode('amount'); setQuantity('100'); }}
                  activeOpacity={0.7}
                >
                  <Ionicons 
                    name="cash" 
                    size={20} 
                    color={mode === 'amount' ? '#0033A0' : '#666'} 
                  />
                  <Text style={[styles.toggleText, mode === 'amount' && styles.activeText]}>
                    By Amount
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Input Field */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>
                {mode === 'liters' || !isFuel ? 'Quantity' : 'Amount (₱)'}
              </Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  value={quantity}
                  onChangeText={handleInputChange}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor="#999"
                />
                <Text style={styles.suffix}>
                  {mode === 'liters' || !isFuel ? product.unit : 'PHP'}
                </Text>
              </View>
              
              {/* Calculation Display */}
              {isFuel && (
                <Text style={styles.helperText}>
                  {mode === 'liters' 
                    ? `Total: ₱${totalPrice.toFixed(2)}` 
                    : `Approx: ${((parseFloat(quantity) || 0) / product.current_price).toFixed(2)} Liters`
                  }
                </Text>
              )}
            </View>

            {/* Delivery Info */}
            <View style={styles.deliveryInfo}>
              <Ionicons name="time" size={20} color="#0033A0" />
              <Text style={styles.deliveryText}>15-30 min delivery • San Pedro Area</Text>
            </View>
          </View>
        </KeyboardAvoidingView>

        {/* Fixed Bottom Bar */}
        <View style={[styles.footer, { paddingBottom: insets.bottom }]}>
          <View style={styles.footerContent}>
            <View>
              <Text style={styles.footerLabel}>Total Amount</Text>
              <Text style={styles.footerPrice}>
                ₱{mode === 'amount' ? parseFloat(quantity || 0).toFixed(2) : totalPrice.toFixed(2)}
              </Text>
            </View>
            <TouchableOpacity 
              style={[styles.addButton, !product.stock_quantity && styles.disabledButton]}
              onPress={handleAddToCart}
              disabled={!product.stock_quantity}
              activeOpacity={0.8}
            >
              <Ionicons name="cart" size={20} color="#fff" />
              <Text style={styles.addButtonText}>
                {product.stock_quantity ? 'Add to Order' : 'Out of Stock'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  keyboardView: {
    flex: 1,
  },
  backButton: {
    position: 'absolute',
    top: 20,
    left: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailFavButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageContainer: {
    height: height * 0.25, // 25% of screen height
    width: '100%',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  titleContainer: {
    flex: 1,
    marginRight: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0033A0',
    marginBottom: 8,
  },
  categoryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 10,
    marginBottom: 4,
  },
  categoryText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  stockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B98120',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  stockText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 4,
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  unitPrice: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ED2939',
  },
  unit: {
    fontSize: 14,
    color: '#666',
    fontWeight: 'normal',
  },
  descriptionContainer: {
    marginBottom: 15,
  },
  descriptionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  descriptionText: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: '#e9ecef',
    marginVertical: 15,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#f0f4ff',
    borderRadius: 10,
    padding: 3,
    marginBottom: 15,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  activeToggle: {
    backgroundColor: '#fff',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginLeft: 6,
  },
  activeText: {
    color: '#0033A0',
  },
  inputContainer: {
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#0033A0',
    borderRadius: 10,
    paddingHorizontal: 14,
    marginBottom: 6,
  },
  input: {
    flex: 1,
    fontSize: 24,
    fontWeight: 'bold',
    paddingVertical: 10,
    color: '#333',
  },
  suffix: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
    marginLeft: 6,
  },
  helperText: {
    fontSize: 13,
    color: '#0033A0',
    fontWeight: '600',
  },
  deliveryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f7ff',
    padding: 12,
    borderRadius: 10,
  },
  deliveryText: {
    marginLeft: 8,
    fontSize: 13,
    color: '#0033A0',
    fontWeight: '500',
  },
  footer: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  footerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 60, 
  },
  footerLabel: {
    fontSize: 11,
    color: '#666',
    marginBottom: 2,
  },
  footerPrice: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0033A0',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0033A0',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    elevation: 3,
    shadowColor: '#0033A0',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 6,
  },
});