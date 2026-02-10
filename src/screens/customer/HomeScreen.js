import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  StyleSheet, 
  ActivityIndicator, 
  RefreshControl,
  TouchableOpacity // <--- Added this
} from 'react-native';
import { Ionicons } from '@expo/vector-icons'; // <--- Added this for the Icon
import { supabase } from '../../lib/supabase';
import ProductCard from '../../components/ProductCard';

export default function HomeScreen({ navigation }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { signOut } = useAuth();

  // 1. Fetch Data Function
  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('category', { ascending: true });

      if (error) throw error;
      setProducts(data);
    } catch (error) {
      console.error('Error fetching products:', error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchProducts();
  };

  const handleProductPress = (product) => {
    navigation.navigate('ProductDetails', { product });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0033A0" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* --- UPDATED HEADER START --- */}
      <View style={styles.header}>
            <View style={styles.headerRow}>
                <View>
                <Text style={styles.headerTitle}>Fuel & Oil</Text>
                <Text style={styles.headerSubtitle}>Select a product to order</Text>
                </View>

                <View style={{flexDirection: 'row', alignItems: 'center'}}>
                
                {/* Cart Button */}
                <TouchableOpacity 
                    onPress={() => navigation.navigate('Cart')}
                    style={{ marginRight: 15 }}
                >
                    <Ionicons name="cart" size={28} color="#0033A0" />
                </TouchableOpacity>

                {/* Profile Button (New) */}
                <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
                    <Ionicons name="person-circle-outline" size={32} color="#0033A0" />
                </TouchableOpacity>
                </View>
            </View>
        </View>
      {/* --- UPDATED HEADER END --- */}

      <FlatList
        data={products}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <ProductCard 
            product={item} 
            onPress={() => handleProductPress(item)} 
          />
        )}
        numColumns={2}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>No products available right now.</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    // Ensure header sits below status bar on some Androids
    paddingTop: 40, 
  },
  // New style for the row layout
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0033A0',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  cartButton: {
    padding: 5,
  },
  listContent: {
    padding: 10,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
    color: '#888',
  },
});