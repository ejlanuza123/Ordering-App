// src/context/CartContext.js
import React, { createContext, useState, useContext, useCallback, useMemo, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CartContext = createContext();
const CART_STORAGE_KEY = 'petron_cart_items';

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState([]);

  useEffect(() => {
    const loadCartItems = async () => {
      try {
        const raw = await AsyncStorage.getItem(CART_STORAGE_KEY);
        if (!raw) return;

        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setCartItems(parsed);
        }
      } catch (error) {
        console.warn('Failed to load cart items from storage:', error?.message || error);
      }
    };

    loadCartItems();
  }, []);

  useEffect(() => {
    const persistCartItems = async () => {
      try {
        await AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
      } catch (error) {
        console.warn('Failed to persist cart items:', error?.message || error);
      }
    };

    persistCartItems();
  }, [cartItems]);

  // Calculate total item price based on quantity and product price
  const calculateTotalItemPrice = useCallback((product, quantity) => {
    return parseFloat((product.current_price * quantity).toFixed(2));
  }, []);

  // Add Item to Cart with proper quantity calculation
  const addToCart = useCallback((product, quantity) => {
    // Validate quantity
    if (quantity <= 0) {
      console.warn('Cannot add item with quantity <= 0');
      return;
    }

    // Check stock availability
    if (product.stock_quantity !== undefined && quantity > product.stock_quantity) {
      console.warn('Insufficient stock');
      return;
    }

    setCartItems((prevItems) => {
      // Check if item already exists in cart
      const existingItemIndex = prevItems.findIndex((item) => item.id === product.id);

      if (existingItemIndex !== -1) {
        // If it exists, update the quantity and recalculate total price
        const existingItem = prevItems[existingItemIndex];
        const newQuantity = existingItem.quantity + quantity;
        
        // Check if new quantity exceeds stock
        if (product.stock_quantity !== undefined && newQuantity > product.stock_quantity) {
          console.warn('Cannot add more than available stock');
          return prevItems;
        }

        const newTotalPrice = calculateTotalItemPrice(product, newQuantity);

        return prevItems.map((item, index) =>
          index === existingItemIndex
            ? { 
                ...item, 
                quantity: newQuantity,
                totalItemPrice: newTotalPrice,
                // Store the unit price for reference
                unitPrice: product.current_price
              }
            : item
        );
      } else {
        // If new, add to array with calculated total price
        const newTotalPrice = calculateTotalItemPrice(product, quantity);
        return [...prevItems, { 
          ...product, 
          quantity, 
          totalItemPrice: newTotalPrice,
          unitPrice: product.current_price,
          addedAt: new Date().toISOString()
        }];
      }
    });
  }, [calculateTotalItemPrice]);

  // Update item quantity directly
  const updateQuantity = useCallback((productId, newQuantity) => {
    if (newQuantity <= 0) {
      // If quantity is 0 or negative, remove the item
      removeFromCart(productId);
      return;
    }

    setCartItems((prevItems) => {
      return prevItems.map((item) => {
        if (item.id === productId) {
          // Check if new quantity exceeds stock
          if (item.stock_quantity !== undefined && newQuantity > item.stock_quantity) {
            console.warn('Cannot set quantity above available stock');
            return item;
          }

          const newTotalPrice = calculateTotalItemPrice(item, newQuantity);
          return {
            ...item,
            quantity: newQuantity,
            totalItemPrice: newTotalPrice
          };
        }
        return item;
      });
    });
  }, [calculateTotalItemPrice]);

  // Remove Item from Cart
  const removeFromCart = useCallback((productId) => {
    setCartItems((prevItems) => prevItems.filter((item) => item.id !== productId));
  }, []);

  // Clear Cart (After checkout)
  const clearCart = useCallback(() => {
    setCartItems([]);
  }, []);

  // Reorder items from a past order
  const reorderItems = useCallback((orderItems) => {
    if (!Array.isArray(orderItems) || orderItems.length === 0) return 0;

    let addedCount = 0;
    setCartItems((prevItems) => {
      let updatedCart = [...prevItems];

      orderItems.forEach((orderItem) => {
        const product = orderItem.products || orderItem.product || orderItem;
        const productId = product?.id || orderItem.product_id || orderItem.id;
        const qty = Math.max(1, orderItem.quantity || 1);
        const price = product?.current_price || orderItem.price_at_order || orderItem.price || 0;

        if (!productId) return;

        const existingIndex = updatedCart.findIndex(item => item.id === productId);
        if (existingIndex !== -1) {
          const existing = updatedCart[existingIndex];
          const newQty = existing.quantity + qty;
          updatedCart[existingIndex] = {
            ...existing,
            quantity: newQty,
            totalItemPrice: parseFloat((price * newQty).toFixed(2)),
          };
        } else {
          updatedCart.push({
            id: productId,
            name: product?.name || orderItem.name || 'Product',
            category: product?.category || orderItem.category || 'General',
            image_url: product?.image_url || orderItem.image_url || null,
            current_price: price,
            unitPrice: price,
            unit: product?.unit || orderItem.unit || 'pc',
            quantity: qty,
            totalItemPrice: parseFloat((price * qty).toFixed(2)),
            addedAt: new Date().toISOString()
          });
        }
        addedCount += 1;
      });

      return updatedCart;
    });

    return addedCount;
  }, []);

  // Get item count in cart
  const getItemCount = useCallback(() => {
    return cartItems.reduce((count, item) => count + item.quantity, 0);
  }, [cartItems]);

  // Calculate Grand Total
  const getCartTotal = useCallback(() => {
    return cartItems.reduce((total, item) => total + item.totalItemPrice, 0);
  }, [cartItems]);

  // Check if item is in cart
  const isInCart = useCallback((productId) => {
    return cartItems.some(item => item.id === productId);
  }, [cartItems]);

  // Get quantity of specific item in cart
  const getItemQuantity = useCallback((productId) => {
    const item = cartItems.find(item => item.id === productId);
    return item ? item.quantity : 0;
  }, [cartItems]);

  // Memoized cart summary for performance
  const cartSummary = useMemo(() => ({
    totalItems: cartItems.length,
    totalQuantity: cartItems.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: cartItems.reduce((sum, item) => sum + item.totalItemPrice, 0),
    items: cartItems
  }), [cartItems]);

  return (
    <CartContext.Provider 
      value={{ 
        cartItems,
        cartSummary,
        addToCart, 
        updateQuantity,
        removeFromCart, 
        clearCart, 
        reorderItems,
        getCartTotal,
        getItemCount,
        isInCart,
        getItemQuantity
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};