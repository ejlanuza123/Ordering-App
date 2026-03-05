import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
  RefreshControl
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useFavorites } from '../../context/FavoritesContext';
import ProductCard from '../../components/ProductCard';
import { useCart } from '../../context/CartContext';
import SafeAreaWrapper from '../../components/SafeAreaWrapper';
import CustomAlertModal from '../../components/CustomAlertModal';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 45) / 2;

export default function MyFavoritesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { favorites, isFavorite, toggleFavorite } = useFavorites();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { cartItems, addToCart } = useCart();
  const [showAlert, setShowAlert] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ type: 'warning', title: '', message: '' });

  const fetchFavoritesProducts = async () => {
    setLoading(true);
    try {
      if (favorites.size === 0) {
        setProducts([]);
      } else {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .in('id', Array.from(favorites))
          .eq('is_active', true);
        if (error) throw error;
        setProducts(data);
      }
    } catch (e) {
      console.error('Error fetching favorite products:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchFavoritesProducts();
  }, [favorites]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchFavoritesProducts();
  };

  const handleAddToCart = (product) => {
    if (product.stock_quantity <= 0) {
      setAlertConfig({
        type: 'warning',
        title: 'Out of Stock',
        message: `${product.name} is currently out of stock.`
      });
      setShowAlert(true);
      return;
    }
    const defaultQuantity = product.category === 'Fuel' ? 1 : 1;
    const totalItemPrice = product.current_price * defaultQuantity;
    addToCart(product, defaultQuantity, totalItemPrice);
    setAlertConfig({
      type: 'success',
      title: 'Added to Cart',
      message: `${product.name} has been added to your cart.`
    });
    setShowAlert(true);
  };

  return (
    <SafeAreaWrapper backgroundColor="#f8f9fa" barStyle="dark-content">
      <View style={[styles.container, { paddingTop: insets.top }] }>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#0033A0" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Favorites</Text>
          <View style={{ width: 40 }} />
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#0033A0" />
          </View>
        ) : (
          <FlatList
            data={products}
            keyExtractor={item => item.id.toString()}
            numColumns={2}
            columnWrapperStyle={styles.columnWrapper}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0033A0']} />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="heart-outline" size={80} color="#ccc" />
                <Text style={styles.emptyTitle}>No favorites yet</Text>
                <Text style={styles.emptySubtitle}>Tap the heart button on a product to save it here.</Text>
              </View>
            }
            renderItem={({ item, index }) => (
              <View style={[
                styles.productWrapper,
                index % 2 === 0 ? styles.productWrapperLeft : styles.productWrapperRight
              ]}>
                <ProductCard
                  product={item}
                  onPress={() => navigation.navigate('ProductDetails', { product: item })}
                  onAddToCart={() => handleAddToCart(item)}
                  isFavorite={isFavorite(item.id)}
                  onToggleFavorite={async p => {
                    const added = await toggleFavorite(p.id);
                    setAlertConfig({
                      type: 'success',
                      title: added ? 'Added to Favorites' : 'Removed from Favorites',
                      message: added ? `${p.name} has been added to your favorites.`
                                     : `${p.name} has been removed from your favorites.`
                    });
                    setShowAlert(true);
                  }}
                />
              </View>
            )}
            showsVerticalScrollIndicator={false}
          />
        )}

        <CustomAlertModal
          visible={showAlert}
          onClose={() => setShowAlert(false)}
          type={alertConfig.type}
          title={alertConfig.title}
          message={alertConfig.message}
          confirmText="OK"
        />
      </View>
    </SafeAreaWrapper>
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
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0033A0',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  productWrapper: {
    width: CARD_WIDTH,
  },
  productWrapperLeft: {
    marginRight: 5,
  },
  productWrapperRight: {
    marginLeft: 5,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});