// src/context/CartContext.js
import React, { createContext, useState, useContext, useCallback, useMemo } from 'react';

const CartContext = createContext();

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState([]);

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