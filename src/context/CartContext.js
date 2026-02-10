import React, { createContext, useState, useContext } from 'react';
import { Alert } from 'react-native';

const CartContext = createContext();

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState([]);

  // 1. Add Item to Cart
  const addToCart = (product, quantity, totalItemPrice) => {
    setCartItems((prevItems) => {
      // Check if item already exists in cart
      const existingItem = prevItems.find((item) => item.id === product.id);

      if (existingItem) {
        // If it exists, update the quantity and total price
        return prevItems.map((item) =>
          item.id === product.id
            ? { 
                ...item, 
                quantity: item.quantity + quantity,
                totalItemPrice: item.totalItemPrice + totalItemPrice
              }
            : item
        );
      } else {
        // If new, add to array
        return [...prevItems, { ...product, quantity, totalItemPrice }];
      }
    });
    
    Alert.alert('Success', 'Item added to cart!');
  };

  // 2. Remove Item
  const removeFromCart = (productId) => {
    setCartItems((prevItems) => prevItems.filter((item) => item.id !== productId));
  };

  // 3. Clear Cart (After checkout)
  const clearCart = () => {
    setCartItems([]);
  };

  // 4. Calculate Grand Total
  const getCartTotal = () => {
    return cartItems.reduce((total, item) => total + item.totalItemPrice, 0);
  };

  return (
    <CartContext.Provider 
      value={{ 
        cartItems, 
        addToCart, 
        removeFromCart, 
        clearCart, 
        getCartTotal 
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);