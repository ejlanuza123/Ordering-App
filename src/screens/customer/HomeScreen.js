import React, { useEffect, useState, useRef, useCallback } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  StyleSheet, 
  ActivityIndicator, 
  RefreshControl,
  TouchableOpacity,
  Dimensions,
  Platform,
  TextInput,
  Modal,
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import ProductCard from '../../components/ProductCard';
import { useCart } from '../../context/CartContext';
import SafeAreaWrapper from '../../components/SafeAreaWrapper';

const { width } = Dimensions.get('window');

// Custom debounce function
const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

export default function HomeScreen({ navigation, route }) {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortModalVisible, setSortModalVisible] = useState(false);
  const [sortBy, setSortBy] = useState('name_asc');
  const { cartItems, addToCart } = useCart();
  
  const selectedCategory = route.params?.category || 'Fuel';
  
  // Create a ref for the debounced function
  const debouncedSearchRef = useRef(null);

  const handleAddToCart = (product) => {
    // For fuel products, default to 1 liter
    // For lubricants, default to 1 unit
    const defaultQuantity = product.category === 'Fuel' ? 1 : 1;
    const totalItemPrice = product.current_price * defaultQuantity;
    
    addToCart(product, defaultQuantity, totalItemPrice);
  };

  // Fetch products
  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;
      setProducts(data);
      applyFilters(data, searchQuery, sortBy, selectedCategory);
    } catch (error) {
      console.error('Error fetching products:', error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Apply all filters and sorting
  const applyFilters = useCallback((productsList, query, sortMethod, category) => {
    let filtered = [...productsList];
    
    // Filter by category
    if (category === 'Fuel') {
      filtered = filtered.filter(product => product.category === 'Fuel');
    } else {
      filtered = filtered.filter(product => product.category !== 'Fuel');
    }
    
    // Filter by search query
    if (query.trim() !== '') {
      const lowerQuery = query.toLowerCase();
      filtered = filtered.filter(product => 
        product.name.toLowerCase().includes(lowerQuery) ||
        (product.description && product.description.toLowerCase().includes(lowerQuery)) ||
        product.category.toLowerCase().includes(lowerQuery)
      );
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortMethod) {
        case 'name_asc':
          return a.name.localeCompare(b.name);
        case 'name_desc':
          return b.name.localeCompare(a.name);
        case 'price_asc':
          return parseFloat(a.current_price) - parseFloat(b.current_price);
        case 'price_desc':
          return parseFloat(b.current_price) - parseFloat(a.current_price);
        default:
          return a.name.localeCompare(b.name);
      }
    });
    
    setFilteredProducts(filtered);
  }, []);

  // Initialize debounced search function
  useEffect(() => {
    debouncedSearchRef.current = debounce((query) => {
      applyFilters(products, query, sortBy, selectedCategory);
    }, 300);
  }, [products, sortBy, selectedCategory, applyFilters]);

  // Handle search input change
  const handleSearchChange = (text) => {
    setSearchQuery(text);
    if (debouncedSearchRef.current) {
      debouncedSearchRef.current(text);
    }
  };

  // Handle sort selection
  const handleSortSelect = (sortMethod) => {
    setSortBy(sortMethod);
    applyFilters(products, searchQuery, sortMethod, selectedCategory);
    setSortModalVisible(false);
  };

  useEffect(() => {
    fetchProducts();
  }, [selectedCategory]);

  useEffect(() => {
    if (products.length > 0) {
      applyFilters(products, searchQuery, sortBy, selectedCategory);
    }
  }, [products, sortBy, applyFilters]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchProducts();
  };

  const handleProductPress = (product) => {
    navigation.navigate('ProductDetails', { product });
  };

  const handleCategoryChange = (category) => {
    setSearchQuery('');
    if (category === 'Fuel') {
      navigation.setParams({ category: 'Fuel' });
      applyFilters(products, '', sortBy, 'Fuel');
    } else {
      navigation.setParams({ category: 'Motor Oil' });
      applyFilters(products, '', sortBy, 'Motor Oil');
    }
  };

  // Get sort label text
  const getSortLabel = () => {
    switch (sortBy) {
      case 'name_asc': return 'Name: A-Z';
      case 'name_desc': return 'Name: Z-A';
      case 'price_asc': return 'Price: Low to High';
      case 'price_desc': return 'Price: High to Low';
      default: return 'Sort by';
    }
  };

  return (
    <SafeAreaWrapper backgroundColor="#f8f9fa" barStyle="dark-content">
      <View style={styles.container}>
        {/* Custom Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity 
              onPress={() => navigation.navigate('Selection')}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={24} color="#0033A0" />
            </TouchableOpacity>
            
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle}>
                {selectedCategory === 'Fuel' ? 'Fuel Products' : 'Lubricants'}
              </Text>
              <Text style={styles.headerSubtitle}>
                {selectedCategory === 'Fuel' 
                  ? 'Premium fuels delivered to you' 
                  : 'High-quality lubricants'
                }
              </Text>
            </View>
            
            <TouchableOpacity 
              onPress={() => navigation.navigate('Cart')}
              style={styles.cartButton}
            >
              <Ionicons name="cart" size={24} color="#0033A0" />
              {cartItems.length > 0 && (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>
                    {cartItems.length > 9 ? '9+' : cartItems.length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Category Tabs */}
          <View style={styles.categoryTabs}>
            <TouchableOpacity 
              style={[
                styles.categoryTab,
                selectedCategory === 'Fuel' && styles.activeCategoryTab
              ]}
              onPress={() => handleCategoryChange('Fuel')}
            >
              <Ionicons 
                name="water" 
                size={20} 
                color={selectedCategory === 'Fuel' ? '#fff' : '#0033A0'} 
              />
              <Text style={[
                styles.categoryTabText,
                selectedCategory === 'Fuel' && styles.activeCategoryTabText
              ]}>
                Fuel
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[
                styles.categoryTab,
                selectedCategory !== 'Fuel' && styles.activeCategoryTab
              ]}
              onPress={() => handleCategoryChange('Motor Oil')}
            >
              <Ionicons 
                name="oil" 
                size={20} 
                color={selectedCategory !== 'Fuel' ? '#fff' : '#ED2939'} 
              />
              <Text style={[
                styles.categoryTabText,
                selectedCategory !== 'Fuel' && styles.activeCategoryTabText
              ]}>
                Lubricants
              </Text>
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={styles.searchBar}>
            <Ionicons name="search" size={20} color="#999" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search products by name or description..."
              value={searchQuery}
              onChangeText={handleSearchChange}
              placeholderTextColor="#999"
              clearButtonMode="while-editing"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity 
                onPress={() => handleSearchChange('')}
                style={styles.clearButton}
              >
                <Ionicons name="close-circle" size={20} color="#999" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Products Section */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0033A0" />
            <Text style={styles.loadingText}>Loading products...</Text>
          </View>
        ) : (
          <View style={styles.productsContainer}>
            <View style={styles.productsHeader}>
              <Text style={styles.productsCount}>
                {filteredProducts.length} {filteredProducts.length === 1 ? 'Product' : 'Products'} Found
              </Text>
              <TouchableOpacity 
                style={styles.filterButton}
                onPress={() => setSortModalVisible(true)}
              >
                <Text style={styles.filterText}>{getSortLabel()}</Text>
                <Ionicons name="chevron-down" size={16} color="#0033A0" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={filteredProducts}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item, index }) => (
                <View style={[
                  styles.productWrapper,
                  index % 2 === 0 ? styles.productWrapperLeft : styles.productWrapperRight
                ]}>
                  <ProductCard 
                    product={item} 
                    onPress={() => handleProductPress(item)} 
                    onAddToCart={() => handleAddToCart(item)}
                  />
                </View>
              )}
              numColumns={2}
              columnWrapperStyle={styles.columnWrapper}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl 
                  refreshing={refreshing} 
                  onRefresh={onRefresh}
                  colors={['#0033A0']}
                  tintColor="#0033A0"
                />
              }
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons 
                    name={selectedCategory === 'Fuel' ? "water-outline" : "oil-outline"} 
                    size={80} 
                    color="#ccc" 
                  />
                  <Text style={styles.emptyTitle}>
                    {searchQuery ? 'No matching products found' : `No ${selectedCategory === 'Fuel' ? 'fuel' : 'lubricant'} products available`}
                  </Text>
                  <Text style={styles.emptySubtitle}>
                    {searchQuery 
                      ? 'Try searching with different keywords' 
                      : 'Check back soon for new products'
                    }
                  </Text>
                  {searchQuery && (
                    <TouchableOpacity 
                      style={styles.emptyButton}
                      onPress={() => handleSearchChange('')}
                    >
                      <Text style={styles.emptyButtonText}>Clear Search</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity 
                    style={styles.emptyButton}
                    onPress={() => navigation.navigate('Selection')}
                  >
                    <Text style={styles.emptyButtonText}>Browse Categories</Text>
                  </TouchableOpacity>
                </View>
              }
            />
          </View>
        )}

        {/* Sort Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={sortModalVisible}
          onRequestClose={() => setSortModalVisible(false)}
        >
          <TouchableOpacity 
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setSortModalVisible(false)}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Sort Products</Text>
                <TouchableOpacity 
                  onPress={() => setSortModalVisible(false)}
                  style={styles.modalCloseButton}
                >
                  <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>
              
              <ScrollView style={styles.sortOptions}>
                <TouchableOpacity 
                  style={[
                    styles.sortOption,
                    sortBy === 'name_asc' && styles.sortOptionSelected
                  ]}
                  onPress={() => handleSortSelect('name_asc')}
                >
                  <Ionicons 
                    name="text" 
                    size={20} 
                    color={sortBy === 'name_asc' ? '#0033A0' : '#666'} 
                  />
                  <Text style={[
                    styles.sortOptionText,
                    sortBy === 'name_asc' && styles.sortOptionTextSelected
                  ]}>
                    Name: A to Z
                  </Text>
                  {sortBy === 'name_asc' && (
                    <Ionicons name="checkmark" size={20} color="#0033A0" />
                  )}
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[
                    styles.sortOption,
                    sortBy === 'name_desc' && styles.sortOptionSelected
                  ]}
                  onPress={() => handleSortSelect('name_desc')}
                >
                  <Ionicons 
                    name="text" 
                    size={20} 
                    color={sortBy === 'name_desc' ? '#0033A0' : '#666'} 
                  />
                  <Text style={[
                    styles.sortOptionText,
                    sortBy === 'name_desc' && styles.sortOptionTextSelected
                  ]}>
                    Name: Z to A
                  </Text>
                  {sortBy === 'name_desc' && (
                    <Ionicons name="checkmark" size={20} color="#0033A0" />
                  )}
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[
                    styles.sortOption,
                    sortBy === 'price_asc' && styles.sortOptionSelected
                  ]}
                  onPress={() => handleSortSelect('price_asc')}
                >
                  <Ionicons 
                    name="arrow-up" 
                    size={20} 
                    color={sortBy === 'price_asc' ? '#0033A0' : '#666'} 
                  />
                  <Text style={[
                    styles.sortOptionText,
                    sortBy === 'price_asc' && styles.sortOptionTextSelected
                  ]}>
                    Price: Low to High
                  </Text>
                  {sortBy === 'price_asc' && (
                    <Ionicons name="checkmark" size={20} color="#0033A0" />
                  )}
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[
                    styles.sortOption,
                    sortBy === 'price_desc' && styles.sortOptionSelected
                  ]}
                  onPress={() => handleSortSelect('price_desc')}
                >
                  <Ionicons 
                    name="arrow-down" 
                    size={20} 
                    color={sortBy === 'price_desc' ? '#0033A0' : '#666'} 
                  />
                  <Text style={[
                    styles.sortOptionText,
                    sortBy === 'price_desc' && styles.sortOptionTextSelected
                  ]}>
                    Price: High to Low
                  </Text>
                  {sortBy === 'price_desc' && (
                    <Ionicons name="checkmark" size={20} color="#0033A0" />
                  )}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>
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
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    marginBottom: 10,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f4ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0033A0',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  cartButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f4ff',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  cartBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#ED2939',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  cartBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  categoryTabs: {
    flexDirection: 'row',
    backgroundColor: '#f0f4ff',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  categoryTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  activeCategoryTab: {
    backgroundColor: '#0033A0',
  },
  categoryTabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginLeft: 8,
  },
  activeCategoryTabText: {
    color: '#fff',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    color: '#333',
    fontSize: 16,
    padding: 0,
  },
  clearButton: {
    padding: 4,
    marginLeft: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
    fontSize: 16,
  },
  productsContainer: {
    flex: 1,
    paddingHorizontal: 15,
  },
  productsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    marginTop: 10,
  },
  productsCount: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f4ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  filterText: {
    color: '#0033A0',
    fontSize: 14,
    fontWeight: '500',
    marginRight: 4,
  },
  columnWrapper: {
    justifyContent: 'space-between',
  },
  productWrapper: {
    width: '48%',
    marginBottom: 15,
  },
  productWrapperLeft: {
    marginRight: '2%',
  },
  productWrapperRight: {
    marginLeft: '2%',
  },
  listContent: {
    paddingBottom: 100,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    marginTop: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 20,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 25,
  },
  emptyButton: {
    backgroundColor: '#0033A0',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    marginBottom: 10,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 30,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalCloseButton: {
    padding: 4,
  },
  sortOptions: {
    paddingHorizontal: 20,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  sortOptionSelected: {
    backgroundColor: '#f0f4ff',
  },
  sortOptionText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#666',
  },
  sortOptionTextSelected: {
    color: '#0033A0',
    fontWeight: '600',
  },
});