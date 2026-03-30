// mobile-app/src/App.js - UPDATED WITH ERROR HANDLER
import React, { useEffect } from 'react';
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
import { networkStateService } from './src/services/networkStateService';
import { setupGlobalErrorHandlers } from './src/services/errorHandlerService';
import ErrorBoundary from './src/components/ErrorBoundary';

function AppContent() {
  // Initialize error handling and network monitoring on app launch
  useEffect(() => {
    setupGlobalErrorHandlers();
    networkStateService.startMonitoring();
    
    return () => networkStateService.stopMonitoring();
  }, []);

  return (
    <ErrorBoundary>
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
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar 
        barStyle="light-content" 
        backgroundColor="#0033A0" 
        translucent={false}
      />
      <AppContent />
    </SafeAreaProvider>
  );
}

