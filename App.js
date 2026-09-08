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
import OfflineBanner from './src/components/OfflineBanner';
import SyncStatusToast from './src/components/SyncStatusToast';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';

function ThemedStatusBar() {
  const { colors } = useTheme();
  return (
    <StatusBar 
      barStyle={colors.statusBarStyle} 
      backgroundColor={colors.statusBarBg} 
      translucent={false}
    />
  );
}

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
                        <OfflineBanner />
                        <SyncStatusToast />
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
      <ThemeProvider>
        <ThemedStatusBar />
        <AppContent />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

