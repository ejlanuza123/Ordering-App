import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import { CartProvider } from './src/context/CartContext';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar 
        barStyle="light-content" 
        backgroundColor="#0033A0" 
        translucent={false}
      />
      <AuthProvider>
        <CartProvider>
          <AppNavigator />
        </CartProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}