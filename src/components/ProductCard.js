import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';

export default function ProductCard({ product, onPress }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      {/* Product Image */}
      <View style={styles.imageContainer}>
        {/* If no image, show a placeholder color */}
        {product.image_url ? (
            <Image source={{ uri: product.image_url }} style={styles.image} />
        ) : (
            <View style={[styles.image, { backgroundColor: '#ccc' }]} /> 
        )}
      </View>

      {/* Product Details */}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{product.name}</Text>
        <Text style={styles.category}>{product.category}</Text>
        
        <View style={styles.priceRow}>
          <Text style={styles.currency}>₱</Text>
          <Text style={styles.price}>{product.current_price.toFixed(2)}</Text>
          <Text style={styles.unit}>/{product.unit}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    margin: 6,
    padding: 10,
    elevation: 3, // Shadow for Android
    shadowColor: '#000', // Shadow for iOS
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  imageContainer: {
    height: 100,
    width: '100%',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 8,
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  info: {
    alignItems: 'flex-start',
  },
  name: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  category: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  currency: {
    fontSize: 12,
    color: '#ED2939', // Petron Red
    fontWeight: '600',
  },
  price: {
    fontSize: 18,
    color: '#ED2939',
    fontWeight: 'bold',
  },
  unit: {
    fontSize: 12,
    color: '#666',
    marginLeft: 2,
  },
});