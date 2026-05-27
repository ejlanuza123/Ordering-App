// mobile-app/src/context/ProductContext.js
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { AppState } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { Alert } from 'react-native';

const ProductContext = createContext(null);

export const ProductProvider = ({ children }) => {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [hasRealtimeUpdates, setHasRealtimeUpdates] = useState(false);

  // Fetch all products
  const fetchProducts = useCallback(async () => {
    const timeoutMs = 15000;
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('fetch timeout')), timeoutMs));

    try {
      setLoading(true);
      const fetchPromise = supabase
        .from('products')
        .select('*')
        .eq('is_active', true) // Only fetch active products
        .order('name');

      const { data, error } = await Promise.race([fetchPromise, timeoutPromise]);

      if (error) throw error;
      setProducts(data || []);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching products:', error.message);
      Alert.alert('Error', 'Failed to load products');
    } finally {
      setLoading(false);
      setHasRealtimeUpdates(false);
    }
  }, []);

  // Fetch single product by ID
  const getProductById = useCallback(async (productId) => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching product:', error.message);
      return null;
    }
  }, []);

  // Update local product state
  const updateProductInState = useCallback((updatedProduct) => {
    setProducts(prevProducts => 
      prevProducts.map(p => 
        p.id === updatedProduct.id ? { ...p, ...updatedProduct } : p
      )
    );
  }, []);

  // Add new product to state
  const addProductToState = useCallback((newProduct) => {
    setProducts(prev => [newProduct, ...prev]);
  }, []);

  // Remove product from state
  const removeProductFromState = useCallback((productId) => {
    setProducts(prev => prev.filter(p => p.id !== productId));
  }, []);

  // Check if product is low stock
  const isLowStock = useCallback((product) => {
    return product.stock_quantity <= (product.low_stock_threshold || 10);
  }, []);

  // Get products by category
  const getProductsByCategory = useCallback((category) => {
    if (category === 'All') return products;
    return products.filter(p => p.category === category);
  }, [products]);

  // Get low stock products
  const getLowStockProducts = useCallback(() => {
    return products.filter(p => isLowStock(p));
  }, [products, isLowStock]);

  // Get active products only
  const getActiveProducts = useCallback(() => {
    return products.filter(p => p.is_active);
  }, [products]);

  // Set up real-time subscription
  useEffect(() => {
    fetchProducts();

    // Subscribe to product changes
    const channel = supabase
      .channel('products-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'products'
        },
        (payload) => {
          console.log('Product change detected:', payload.eventType);
          
          switch (payload.eventType) {
            case 'INSERT':
              addProductToState(payload.new);
              setHasRealtimeUpdates(true);
              break;
              
            case 'UPDATE':
              updateProductInState(payload.new);
              setHasRealtimeUpdates(true);
              
              // Check if stock changed significantly
              const oldStock = payload.old?.stock_quantity;
              const newStock = payload.new?.stock_quantity;
              
              if (oldStock !== newStock) {
                console.log(`Stock updated for ${payload.new.name}: ${oldStock} → ${newStock}`);
              }
              break;
              
            case 'DELETE':
              removeProductFromState(payload.old.id);
              setHasRealtimeUpdates(true);
              break;
              
            default:
              break;
          }
          
          setLastUpdated(new Date());
        }
      )
      .subscribe();

    setSubscription(channel);

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [fetchProducts, user]);

  // Context value
  const value = {
    products,
    loading,
    lastUpdated,
    hasRealtimeUpdates,
    fetchProducts,
    getProductById,
    getProductsByCategory,
    getLowStockProducts,
    getActiveProducts,
    isLowStock,
    refreshProducts: async () => {
      await fetchProducts();
      setHasRealtimeUpdates(false);
    },
    clearRealtimeUpdates: () => setHasRealtimeUpdates(false),
  };

  // Auto-refresh when app comes to foreground if data is stale
  useEffect(() => {
    const REFRESH_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

    const handleAppStateChange = (nextAppState) => {
      if (nextAppState === 'active') {
        try {
          const age = lastUpdated ? (Date.now() - new Date(lastUpdated).getTime()) : Infinity;
          if (age > REFRESH_THRESHOLD_MS) {
            // reuse refresh logic
            (async () => {
              await fetchProducts();
              setHasRealtimeUpdates(false);
            })();
          }
        } catch (e) {
          console.warn('AppState refresh check failed', e.message);
        }
      }
    };

    const sub = AppState.addEventListener ? AppState.addEventListener('change', handleAppStateChange) : null;
    return () => {
      if (sub && sub.remove) sub.remove();
    };
  }, [lastUpdated, fetchProducts]);

  return (
    <ProductContext.Provider value={value}>
      {children}
    </ProductContext.Provider>
  );
};

// Custom hook to use product context
export const useProducts = () => {
  const context = useContext(ProductContext);
  if (!context) {
    throw new Error('useProducts must be used within a ProductProvider');
  }
  return context;
};