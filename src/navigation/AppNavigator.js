// src/navigation/AppNavigator.js (updated)
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { ActivityIndicator, View } from 'react-native';

// --- IMPORT SCREENS ---
// Auth Screens
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';

// Customer Screens
import HomeScreen from '../screens/customer/HomeScreen';
import ProductDetailsScreen from '../screens/customer/ProductDetailsScreen';
import CartScreen from '../screens/customer/CartScreen';
import CheckoutScreen from '../screens/customer/CheckoutScreen';
import OrderHistoryScreen from '../screens/customer/OrderHistoryScreen';
import ProfileScreen from '../screens/customer/ProfileScreen';
import SelectionScreen from '../screens/customer/SelectionScreen';
import MyFavoritesScreen from '../screens/customer/MyFavoritesScreen';
import NotificationsScreen from '../screens/customer/NotificationsScreen';
import ReviewsChoiceScreen from '../screens/customer/ReviewsChoiceScreen';
import RiderReviewsScreen from '../screens/customer/RiderReviewsScreen';
import ProductReviewsScreen from '../screens/customer/ProductReviewsScreen';
import CustomerDeliveryTrackingScreen from '../screens/customer/CustomerDeliveryTrackingScreen';

// Rider Screens
import RiderDashboardScreen from '../screens/rider/RiderDashboardScreen';
import RiderDeliveriesScreen from '../screens/rider/RiderDeliveriesScreen';
import RiderDeliveryDetailsScreen from '../screens/rider/RiderDeliveryDetailsScreen';
import RiderProfileScreen from '../screens/rider/RiderProfileScreen';
import RiderMapScreen from '../screens/rider/RiderMapScreen';

const Stack = createNativeStackNavigator();

// Customer Stack
const CustomerStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Home" component={HomeScreen} />
    <Stack.Screen name="Selection" component={SelectionScreen} />
    <Stack.Screen name="ProductDetails" component={ProductDetailsScreen} />
    <Stack.Screen name="Favorites" component={MyFavoritesScreen} />
    <Stack.Screen name="Cart" component={CartScreen} />
    <Stack.Screen name="Checkout" component={CheckoutScreen} />
    <Stack.Screen name="OrderHistory" component={OrderHistoryScreen} />
    <Stack.Screen name="CustomerDeliveryTracking" component={CustomerDeliveryTrackingScreen} />
    <Stack.Screen name="ReviewsChoice" component={ReviewsChoiceScreen} />
    <Stack.Screen name="RiderReviews" component={RiderReviewsScreen} />
    <Stack.Screen name="ProductReviews" component={ProductReviewsScreen} />
    <Stack.Screen name="Profile" component={ProfileScreen} />
    <Stack.Screen name="Notifications" component={NotificationsScreen} />
  </Stack.Navigator>
);

// Rider Stack
const RiderStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="RiderDashboard" component={RiderDashboardScreen} />
    <Stack.Screen name="RiderDeliveries" component={RiderDeliveriesScreen} />
    <Stack.Screen name="RiderDeliveryDetails" component={RiderDeliveryDetailsScreen} />
    <Stack.Screen name="RiderMap" component={RiderMapScreen} />
    <Stack.Screen name="RiderProfile" component={RiderProfileScreen} />
    <Stack.Screen name="Notifications" component={NotificationsScreen} />
  </Stack.Navigator>
);

export default function AppNavigator() {
  const { user, loading, role } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#ED2939" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        
        {!user ? (
          // Auth Stack
          <Stack.Group>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </Stack.Group>
        ) : (
          // Role-based navigation
          <>
            {role === 'rider' ? (
              <Stack.Screen name="RiderStack" component={RiderStack} />
            ) : (
              <Stack.Screen name="CustomerStack" component={CustomerStack} />
            )}
          </>
        )}

      </Stack.Navigator>
    </NavigationContainer>
  );
}