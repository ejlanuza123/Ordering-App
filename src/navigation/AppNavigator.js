// src/navigation/AppNavigator.js (updated)
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { ActivityIndicator, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// --- IMPORT SCREENS ---
// Auth Screens
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import IntroScreen from '../screens/auth/IntroScreen';

// Customer Screens
import HomeScreen from '../screens/customer/HomeScreen';
import ProductDetailsScreen from '../screens/customer/ProductDetailsScreen';
import CartScreen from '../screens/customer/CartScreen';
import CheckoutScreen from '../screens/customer/CheckoutScreen';
import OrderHistoryScreen from '../screens/customer/OrderHistoryScreen';
import ReservationScreen from '../screens/customer/ReservationScreen';
import ProfileScreen from '../screens/customer/ProfileScreen';
import SelectionScreen from '../screens/customer/SelectionScreen';
import MyFavoritesScreen from '../screens/customer/MyFavoritesScreen';
import NotificationsScreen from '../screens/customer/NotificationsScreen';
import ReviewsChoiceScreen from '../screens/customer/ReviewsChoiceScreen';
import RiderReviewsScreen from '../screens/customer/RiderReviewsScreen';
import ProductReviewsScreen from '../screens/customer/ProductReviewsScreen';
import CustomerDeliveryTrackingScreen from '../screens/customer/CustomerDeliveryTrackingScreen';
import ChatListScreen from '../screens/customer/ChatListScreen';
import ChatThreadScreen from '../screens/customer/ChatThreadScreen';
import HelpCenterScreen from '../screens/common/HelpCenterScreen';
import ManualViewerScreen from '../screens/common/ManualViewerScreen';
import TermsPrivacyScreen from '../screens/common/TermsPrivacyScreen';

// Rider Screens
import RiderDashboardScreen from '../screens/rider/RiderDashboardScreen';
import RiderDeliveriesScreen from '../screens/rider/RiderDeliveriesScreen';
import RiderDeliveryDetailsScreen from '../screens/rider/RiderDeliveryDetailsScreen';
import RiderProfileScreen from '../screens/rider/RiderProfileScreen';
import RiderMapScreen from '../screens/rider/RiderMapScreen';
import RiderChatListScreen from '../screens/rider/ChatListScreen';
import RiderChatThreadScreen from '../screens/rider/ChatThreadScreen';

const Stack = createNativeStackNavigator();
const INTRO_SEEN_KEY = 'mobile_intro_seen_v1';

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
    <Stack.Screen name="Reservation" component={ReservationScreen} />
    <Stack.Screen name="CustomerDeliveryTracking" component={CustomerDeliveryTrackingScreen} />
    <Stack.Screen name="ReviewsChoice" component={ReviewsChoiceScreen} />
    <Stack.Screen name="RiderReviews" component={RiderReviewsScreen} />
    <Stack.Screen name="ProductReviews" component={ProductReviewsScreen} />
    <Stack.Screen name="Profile" component={ProfileScreen} />
    <Stack.Screen name="Notifications" component={NotificationsScreen} />
    <Stack.Screen name="ChatList" component={ChatListScreen} />
    <Stack.Screen name="ChatThread" component={ChatThreadScreen} />
    <Stack.Screen name="HelpCenter" component={HelpCenterScreen} />
    <Stack.Screen name="ManualViewer" component={ManualViewerScreen} />
    <Stack.Screen name="TermsPrivacy" component={TermsPrivacyScreen} />
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
    <Stack.Screen name="ChatList" component={RiderChatListScreen} />
    <Stack.Screen name="ChatThread" component={RiderChatThreadScreen} />
    <Stack.Screen name="HelpCenter" component={HelpCenterScreen} />
    <Stack.Screen name="ManualViewer" component={ManualViewerScreen} />
    <Stack.Screen name="TermsPrivacy" component={TermsPrivacyScreen} />
  </Stack.Navigator>
);

export default function AppNavigator() {
  const { user, loading, role } = useAuth();
  const [introSeen, setIntroSeen] = useState(true);
  const [introLoading, setIntroLoading] = useState(true);

  useEffect(() => {
    const loadIntroState = async () => {
      try {
        const seen = await AsyncStorage.getItem(INTRO_SEEN_KEY);
        setIntroSeen(seen === '1');
      } catch (error) {
        console.warn('Failed to load intro state:', error?.message || error);
        setIntroSeen(false);
      } finally {
        setIntroLoading(false);
      }
    };

    loadIntroState();
  }, []);

  const handleGetStarted = async () => {
    try {
      await AsyncStorage.setItem(INTRO_SEEN_KEY, '1');
      setIntroSeen(true);
    } catch (error) {
      console.warn('Failed to save intro state:', error?.message || error);
      setIntroSeen(true);
    }
  };

  if (loading || introLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#ED2939" />
      </View>
    );
  }

  if (!introSeen) {
    return <IntroScreen onGetStarted={handleGetStarted} />;
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