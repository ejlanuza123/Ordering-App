import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Dimensions, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 45) / 2;

export default function ProductCard({ product, onPress, onAddToCart }) {
  const isFuel = product.category === 'Fuel';
  
  const getCategoryColor = () => {
    if (isFuel) return '#0033A0';
    if (product.category === 'Motor Oil') return '#10B981';
    if (product.category === 'Engine Oil') return '#F59E0B';
    return '#ED2939';
  };

  const getCategoryIcon = () => {
    if (isFuel) return 'water';
    return 'oil';
  };

  const handleAddToCart = () => {
    if (onAddToCart) {
      onAddToCart(product);
    } else {
      Alert.alert('Info', 'Add to cart functionality not available');
    }
  };

  return (
    <TouchableOpacity 
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.9}
    >
      {/* Image Container */}
      <View style={styles.imageContainer}>
        {product.image_url ? (
          <Image 
            source={{ uri: product.image_url }} 
            style={styles.image}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.placeholderImage, { backgroundColor: getCategoryColor() + '20' }]}>
            <Ionicons 
              name={getCategoryIcon()} 
              size={40} 
              color={getCategoryColor()}
            />
          </View>
        )}
        
        {/* Category Badge */}
        <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor() }]}>
          <Text style={styles.categoryBadgeText}>
            {product.category === 'Fuel' ? 'FUEL' : 
             product.category === 'Motor Oil' ? 'MOTOR OIL' : 
             product.category === 'Engine Oil' ? 'ENGINE OIL' : 'LUBRICANT'}
          </Text>
        </View>
        
        {/* Stock Indicator */}
        {product.stock_quantity !== undefined && product.stock_quantity <= 10 && product.stock_quantity > 0 && (
          <View style={styles.stockIndicator}>
            <Text style={styles.stockIndicatorText}>
              {product.stock_quantity} left
            </Text>
          </View>
        )}
      </View>

      {/* Product Info */}
      <View style={styles.infoContainer}>
        <Text style={styles.productName} numberOfLines={2}>
          {product.name}
        </Text>
        
        {product.description && (
          <Text style={styles.productDescription} numberOfLines={2}>
            {product.description}
          </Text>
        )}
        
        <View style={styles.priceContainer}>
          <View style={styles.priceRow}>
            <Text style={styles.currency}>₱</Text>
            <Text style={styles.price}>
              {parseFloat(product.current_price).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })}
            </Text>
          </View>
          <Text style={styles.unit}>/{product.unit}</Text>
        </View>
        
        {/* Stock Status */}
        <View style={styles.stockContainer}>
          <View style={[
            styles.stockDot,
            { 
              backgroundColor: product.stock_quantity > 10 ? '#10B981' : 
                              product.stock_quantity > 0 ? '#F59E0B' : '#EF4444'
            }
          ]} />
          <Text style={[
            styles.stockText,
            { 
              color: product.stock_quantity > 10 ? '#10B981' : 
                     product.stock_quantity > 0 ? '#F59E0B' : '#EF4444'
            }
          ]}>
            {product.stock_quantity > 10 ? 'In Stock' : 
             product.stock_quantity > 0 ? 'Low Stock' : 'Out of Stock'}
          </Text>
        </View>
        
        {/* Action Button - NOW WORKING */}
        <TouchableOpacity 
          style={[
            styles.actionButton,
            { 
              backgroundColor: product.stock_quantity > 0 ? getCategoryColor() : '#ccc',
              opacity: product.stock_quantity > 0 ? 1 : 0.6
            }
          ]}
          onPress={handleAddToCart}
          disabled={product.stock_quantity <= 0}
          activeOpacity={0.7}
        >
          <Text style={styles.actionButtonText}>
            {product.stock_quantity > 0 ? 'Add to Cart' : 'Out of Stock'}
          </Text>
          <Ionicons 
            name="cart" 
            size={16} 
            color="#fff" 
            style={styles.actionButtonIcon}
          />
        </TouchableOpacity>
      </View>
      
      {/* Favorite Button */}
      <TouchableOpacity style={styles.favoriteButton}>
        <Ionicons name="heart-outline" size={20} color="#666" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    position: 'relative',
  },
  imageContainer: {
    height: 140,
    width: '100%',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    elevation: 2,
  },
  categoryBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  stockIndicator: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  stockIndicatorText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  infoContainer: {
    padding: 14,
  },
  productName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 6,
    height: 44,
  },
  productDescription: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
    marginBottom: 10,
    height: 32,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  currency: {
    fontSize: 14,
    color: '#ED2939',
    fontWeight: '600',
  },
  price: {
    fontSize: 20,
    color: '#ED2939',
    fontWeight: 'bold',
    marginLeft: 2,
  },
  unit: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  stockContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  stockDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  stockText: {
    fontSize: 11,
    fontWeight: '600',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  actionButtonIcon: {
    marginLeft: 6,
  },
  favoriteButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },
});