// mobile-app/src/App.js - UPDATE THIS FILE
import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import { CartProvider } from './src/context/CartContext';
import { FavoritesProvider } from './src/context/FavoritesContext';
import { NotificationProvider } from './src/context/NotificationContext';
import { ProductProvider } from './src/context/ProductContext';
import { AddressProvider } from './src/context/AddressContext';
import { DeliveryProofProvider } from './src/context/DeliveryProofContext';
import { ReviewProvider } from './src/context/ReviewContext';
import { RiderRatingProvider } from './src/context/RiderRatingContext';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar 
        barStyle="light-content" 
        backgroundColor="#0033A0" 
        translucent={false}
      />
      <AuthProvider>
        <FavoritesProvider>
          <CartProvider>
            <NotificationProvider>
              <ProductProvider>
                <AddressProvider>
                  <DeliveryProofProvider>
                    <ReviewProvider>
                      <RiderRatingProvider>
                        <AppNavigator />
                      </RiderRatingProvider>
                    </ReviewProvider>
                  </DeliveryProofProvider>
                </AddressProvider>
              </ProductProvider>
            </NotificationProvider>
          </CartProvider>
        </FavoritesProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

