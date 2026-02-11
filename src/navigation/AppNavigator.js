import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { ActivityIndicator, View } from 'react-native';

// --- IMPORT SCREENS ---
// 1. Auth Screens
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';

// 2. Customer Screens
import HomeScreen from '../screens/customer/HomeScreen';
import ProductDetailsScreen from '../screens/customer/ProductDetailsScreen';
import CartScreen from '../screens/customer/CartScreen';     
import CheckoutScreen from '../screens/customer/CheckoutScreen'; 
import OrderHistoryScreen from '../screens/customer/OrderHistoryScreen';
import ProfileScreen from '../screens/customer/ProfileScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const { user, loading } = useAuth();

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
        
        {user == null ? (
          // --- AUTH STACK (No User Logged In) ---
          <Stack.Group>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </Stack.Group>
        ) : (
          // --- CUSTOMER STACK (User Logged In) ---
          <Stack.Group>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen 
              name="ProductDetails" 
              component={ProductDetailsScreen} 
            />
            <Stack.Screen name="Cart" component={CartScreen} /> 
            <Stack.Screen name="Checkout" component={CheckoutScreen} />
            <Stack.Screen name="OrderHistory" component={OrderHistoryScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
          </Stack.Group>
        )}

      </Stack.Navigator>
    </NavigationContainer>
  );
}

console.log(OrderHistoryScreen);