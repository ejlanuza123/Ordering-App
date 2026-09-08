import React, { useEffect, useState } from 'react';
import { NavigationContainer, useNavigationContainerRef, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { ActivityIndicator, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import FloatingChatHead from '../components/FloatingChatHead';
import MaintenanceScreenLock from '../components/MaintenanceScreenLock';
import { riderPresenceService } from '../services/riderPresenceService';
import { mobileNotificationService } from '../services/mobileNotificationService';

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
  const [currentRouteName, setCurrentRouteName] = useState(null);
  const navigationRef = useNavigationContainerRef();

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

  // Initialize / cleanup rider presence tracking when auth state changes.
  // Customer logins do not need the heartbeat or AppState subscriptions.
  useEffect(() => {
    if (loading) return;

    if (user && role === 'rider') {
      riderPresenceService.initialize(user.id);
    } else {
      riderPresenceService.cleanup(user?.id);
    }

    return () => {
      riderPresenceService.cleanup(user?.id);
    };
  }, [user?.id, role, loading]);

  // Handle push notification tap navigation globally (e.g. chat messages -> ChatThread / ChatList)
  useEffect(() => {
    const handleNotificationResponse = (notification, actionType) => {
      if (actionType !== 'tapped') return;

      const data = notification?.request?.content?.data || {};
      const type = data?.type || notification?.request?.content?.categoryIdentifier || '';
      const conversationId = data?.conversation_id || data?.conversationId || null;
      const title = notification?.request?.content?.title || '';
      const body = notification?.request?.content?.body || '';

      const isChat = 
        ['chat', 'chat_message', 'message', 'order_chat'].includes(type) ||
        Boolean(conversationId) ||
        title.toLowerCase().includes('chat') ||
        title.toLowerCase().includes('message') ||
        body.toLowerCase().includes('chat') ||
        body.toLowerCase().includes('message');

      if (isChat && navigationRef.isReady()) {
        if (role === 'rider') {
          if (conversationId) {
            navigationRef.navigate('RiderStack', {
              screen: 'ChatThread',
              params: { conversationId }
            });
          } else {
            navigationRef.navigate('RiderStack', {
              screen: 'ChatList'
            });
          }
        } else {
          if (conversationId) {
            navigationRef.navigate('CustomerStack', {
              screen: 'ChatThread',
              params: { conversationId }
            });
          } else {
            navigationRef.navigate('CustomerStack', {
              screen: 'ChatList'
            });
          }
        }
      }
    };

    const cleanup = mobileNotificationService.setupNotificationListeners(handleNotificationResponse);
    return () => cleanup();
  }, [navigationRef, role]);

  const handleGetStarted = async () => {
    try {
      await AsyncStorage.setItem(INTRO_SEEN_KEY, '1');
      setIntroSeen(true);
    } catch (error) {
      console.warn('Failed to save intro state:', error?.message || error);
      setIntroSeen(true);
    }
  };

  const { isDarkMode, colors } = useTheme();

  if ((loading && !user) || introLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!introSeen && !user) {
    return <IntroScreen onGetStarted={handleGetStarted} />;
  }

  const handleOpenChat = () => {
    if (!navigationRef?.isReady()) return;

    if (role === 'rider') {
      navigationRef.navigate('RiderStack', { screen: 'ChatList' });
      return;
    }

    navigationRef.navigate('CustomerStack', { screen: 'ChatList' });
  };

  const hideRoutes = ['Login', 'Register', 'ChatList', 'ChatThread'];
  const isChatHeadVisible = Boolean(user) && ['customer', 'rider'].includes(role) && !hideRoutes.includes(currentRouteName);

  const navigationTheme = {
    dark: isDarkMode,
    colors: {
      ...(isDarkMode ? DarkTheme.colors : DefaultTheme.colors),
      primary: colors.primary,
      background: colors.background,
      card: colors.surface,
      text: colors.textPrimary,
      border: colors.border,
      notification: colors.secondary,
    },
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <NavigationContainer
        ref={navigationRef}
        theme={navigationTheme}
        onReady={() => setCurrentRouteName(navigationRef.getCurrentRoute()?.name || null)}
        onStateChange={() => setCurrentRouteName(navigationRef.getCurrentRoute()?.name || null)}
      >
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

      <FloatingChatHead
        userId={user?.id}
        visible={isChatHeadVisible}
        onPress={handleOpenChat}
      />

      <MaintenanceScreenLock userRole={role} />
    </View>
  );
}