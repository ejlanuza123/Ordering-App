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
  Alert 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons'; // Ensure expo/vector-icons is installed
import { useCart } from '../../context/CartContext';

export default function ProductDetailsScreen({ route, navigation }) {
  // 1. Get the product passed from Home Screen
  const { product } = route.params;
  
  // 2. State for calculation
  const [quantity, setQuantity] = useState('1'); // Liters or Bottles
  const [totalPrice, setTotalPrice] = useState(product.current_price);
  const [mode, setMode] = useState('liters'); // 'liters' or 'amount' (Only for Fuel)
  const { addToCart } = useCart();

  // 3. Auto-Calculate when inputs change
  useEffect(() => {
    if (!quantity || isNaN(quantity)) {
      setTotalPrice(0);
      return;
    }

    const val = parseFloat(quantity);
    
    if (mode === 'liters') {
      // Input is Liters -> Calculate Price
      setTotalPrice(val * product.current_price);
    } else {
      // Input is Amount (Money) -> Calculate Liters (Just for display)
      // We don't update totalPrice here because the user IS typing the price
      setTotalPrice(val); 
    }
  }, [quantity, mode]);

  // 4. Handle Text Input
  const handleInputChange = (text) => {
    // Only allow numbers and one decimal point
    const cleanText = text.replace(/[^0-9.]/g, '');
    setQuantity(cleanText);
  };

  // 5. Add to Cart Logic (Placeholder)
  const handleAddToCart = () => {
    if (totalPrice <= 0) {
      Alert.alert('Error', 'Please enter a valid amount.');
      return;
    }

    // Calculate final liters (if they used "By Amount" mode)
    const finalLiters = mode === 'liters' 
      ? parseFloat(quantity) 
      : parseFloat(quantity) / product.current_price;

    // Call the Context function
    addToCart(product, finalLiters, parseFloat(totalPrice));
    
    // Go back to shop more
    navigation.goBack();
  };

  const isFuel = product.category === 'Fuel';

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      {/* Product Header Image */}
      <View style={styles.imageContainer}>
         {product.image_url ? (
            <Image source={{ uri: product.image_url }} style={styles.image} />
        ) : (
            <View style={[styles.image, { backgroundColor: '#ccc' }]} /> 
        )}
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="black" />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {/* Title & Price */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>{product.name}</Text>
            <Text style={styles.category}>{product.category}</Text>
          </View>
          <View style={styles.priceTag}>
            <Text style={styles.priceText}>
              ₱{product.current_price.toFixed(2)}
              <Text style={styles.unitText}>/{product.unit}</Text>
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* INPUT SECTION */}
        <Text style={styles.sectionTitle}>
          {isFuel ? 'How much fuel?' : 'Quantity'}
        </Text>

        {/* Toggle for Fuel (Liters vs Peso Amount) */}
        {isFuel && (
          <View style={styles.toggleContainer}>
            <TouchableOpacity 
              style={[styles.toggleBtn, mode === 'liters' && styles.activeToggle]}
              onPress={() => { setMode('liters'); setQuantity('1'); }}
            >
              <Text style={[styles.toggleText, mode === 'liters' && styles.activeText]}>
                By Liters
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.toggleBtn, mode === 'amount' && styles.activeToggle]}
              onPress={() => { setMode('amount'); setQuantity('100'); }}
            >
              <Text style={[styles.toggleText, mode === 'amount' && styles.activeText]}>
                By Amount (₱)
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Main Input Field */}
        <View style={styles.inputWrapper}>
          <Text style={styles.inputLabel}>
            {mode === 'liters' || !isFuel ? 'Quantity' : 'Amount (₱)'}
          </Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={quantity}
              onChangeText={handleInputChange}
              keyboardType="decimal-pad"
              placeholder="0"
            />
            <Text style={styles.suffix}>
              {mode === 'liters' || !isFuel ? product.unit : 'PHP'}
            </Text>
          </View>
        </View>

        {/* Calculation Display */}
        {isFuel && (
          <Text style={styles.helperText}>
            {mode === 'liters' 
              ? `Total: ₱${totalPrice.toFixed(2)}` 
              : `Approx: ${(parseFloat(quantity || 0) / product.current_price).toFixed(2)} Liters`
            }
          </Text>
        )}

      </View>

      {/* Bottom Action Button */}
      <View style={styles.footer}>
        <View>
          <Text style={styles.footerLabel}>Total</Text>
          <Text style={styles.footerPrice}>
            ₱{mode === 'amount' ? parseFloat(quantity || 0).toFixed(2) : totalPrice.toFixed(2)}
          </Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={handleAddToCart}>
          <Text style={styles.addButtonText}>Add to Order</Text>
        </TouchableOpacity>
      </View>

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  imageContainer: { height: 200, width: '100%', position: 'relative' },
  image: { width: '100%', height: '100%', resizeMode: 'cover' },
  backButton: {
    position: 'absolute', top: 40, left: 20,
    backgroundColor: 'white', padding: 8, borderRadius: 20, elevation: 5
  },
  content: { flex: 1, padding: 20 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#0033A0' },
  category: { fontSize: 16, color: '#666', marginTop: 4 },
  priceTag: { alignItems: 'flex-end' },
  priceText: { fontSize: 20, fontWeight: 'bold', color: '#ED2939' },
  unitText: { fontSize: 14, color: '#666', fontWeight: 'normal' },
  divider: { height: 1, backgroundColor: '#eee', marginVertical: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 15 },
  
  toggleContainer: { 
    flexDirection: 'row', backgroundColor: '#f0f0f0', 
    borderRadius: 8, padding: 4, marginBottom: 20 
  },
  toggleBtn: { flex: 1, padding: 10, alignItems: 'center', borderRadius: 6 },
  activeToggle: { backgroundColor: 'white', elevation: 2 },
  toggleText: { color: '#666', fontWeight: '600' },
  activeText: { color: '#0033A0' },

  inputWrapper: { marginBottom: 10 },
  inputLabel: { fontSize: 14, color: '#888', marginBottom: 5 },
  inputContainer: { 
    flexDirection: 'row', alignItems: 'center', 
    borderWidth: 1, borderColor: '#ddd', borderRadius: 10, paddingHorizontal: 15 
  },
  input: { flex: 1, fontSize: 24, fontWeight: 'bold', paddingVertical: 10, color: '#333' },
  suffix: { fontSize: 18, color: '#888', fontWeight: '600' },
  helperText: { color: '#666', fontSize: 14, marginTop: 5 },

  footer: { 
    padding: 20, borderTopWidth: 1, borderTopColor: '#eee', 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' 
  },
  footerLabel: { fontSize: 12, color: '#888' },
  footerPrice: { fontSize: 24, fontWeight: 'bold', color: '#0033A0' },
  addButton: { 
    backgroundColor: '#ED2939', paddingVertical: 12, paddingHorizontal: 30, 
    borderRadius: 10 
  },
  addButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
});
