import React, { useEffect, useState, useCallback } from 'react';
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

import { createNavigationTheme } from './navigationTheme';
export { createNavigationTheme };

export default function AppNavigator() {
  const { user, loading, role } = useAuth();
  const [introSeen, setIntroSeen] = useState(true);
  const [introLoading, setIntroLoading] = useState(true);
  const [currentRouteName, setCurrentRouteName] = useState(null);
  const [navIsReady, setNavIsReady] = useState(false);
  const [pendingNotification, setPendingNotification] = useState(null);
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

  const dispatchNotificationNavigation = useCallback((item) => {
    if (!item || !navigationRef?.isReady()) return false;

    const { isBroadcast, broadcastPayload, isChat, conversationId } = item;

    if (isBroadcast && broadcastPayload) {
      if (role === 'rider') {
        navigationRef.navigate('RiderStack', {
          screen: 'Notifications',
          params: { selectedBroadcast: broadcastPayload }
        });
      } else {
        navigationRef.navigate('CustomerStack', {
          screen: 'Notifications',
          params: { selectedBroadcast: broadcastPayload }
        });
      }
      return true;
    }

    if (isChat) {
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
      return true;
    }

    return false;
  }, [navigationRef, role]);

  // Process pending notification once NavigationContainer is ready and user auth is resolved
  useEffect(() => {
    if (!pendingNotification || !navIsReady || !navigationRef?.isReady()) {
      return;
    }

    if (loading) return;

    if (user) {
      const handled = dispatchNotificationNavigation(pendingNotification);
      if (handled) {
        setPendingNotification(null);
      }
    }
  }, [pendingNotification, navIsReady, user, loading, role, dispatchNotificationNavigation]);

  const handleNotificationResponse = useCallback((notification, actionType) => {
    if (actionType !== 'tapped') return;

    const content = notification?.request?.content || {};
    const data = content?.data || notification?.data || {};
    const type = String(data?.type || data?.category || data?.broadcast_category || content?.categoryIdentifier || '').toLowerCase();
    const conversationId = data?.conversation_id || data?.conversationId || null;
    const title = content?.title || notification?.title || '';
    const body = content?.body || notification?.message || notification?.body || '';

    const isBroadcast =
      ['broadcast', 'announcement', 'weather_advisory', 'emergency'].includes(type) ||
      Boolean(data?.broadcast_id) ||
      Boolean(data?.broadcast_category) ||
      (type === 'promo' && !data?.order_id && !data?.orderId);

    if (isBroadcast) {
      const broadcastPayload = {
        id: data?.broadcast_id || data?.notificationId || data?.id || Date.now(),
        title: title || 'Broadcast Announcement',
        message: body || '',
        type: type || data?.category || data?.broadcast_category || 'broadcast',
        data,
        created_at: data?.created_at || new Date().toISOString(),
        is_read: false
      };

      const item = { isBroadcast: true, broadcastPayload };
      if (navIsReady && navigationRef?.isReady() && user && !loading) {
        dispatchNotificationNavigation(item);
      } else {
        setPendingNotification(item);
      }
      return;
    }

    const isChat = 
      ['chat', 'chat_message', 'message', 'order_chat'].includes(type) ||
      Boolean(conversationId) ||
      title.toLowerCase().includes('chat') ||
      title.toLowerCase().includes('message') ||
      body.toLowerCase().includes('chat') ||
      body.toLowerCase().includes('message');

    if (isChat) {
      const item = { isChat: true, conversationId };
      if (navIsReady && navigationRef?.isReady() && user && !loading) {
        dispatchNotificationNavigation(item);
      } else {
        setPendingNotification(item);
      }
    }
  }, [navIsReady, navigationRef, user, loading, dispatchNotificationNavigation]);

  // Set up listeners and check cold start (notification tapped while app was closed)
  useEffect(() => {
    const cleanup = mobileNotificationService.setupNotificationListeners(handleNotificationResponse);

    let isMounted = true;
    const checkColdStartNotification = async () => {
      try {
        const lastResponse = await mobileNotificationService.getLastNotificationResponse();
        if (lastResponse && isMounted) {
          const { notification } = lastResponse;
          handleNotificationResponse(notification, 'tapped');
        }
      } catch (err) {
        console.warn('Failed to check cold start notification:', err);
      }
    };

    checkColdStartNotification();

    return () => {
      isMounted = false;
      cleanup();
    };
  }, [handleNotificationResponse]);

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

  const navigationTheme = createNavigationTheme(isDarkMode, colors);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <NavigationContainer
        ref={navigationRef}
        theme={navigationTheme}
        onReady={() => {
          setNavIsReady(true);
          setCurrentRouteName(navigationRef.getCurrentRoute()?.name || null);
        }}
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