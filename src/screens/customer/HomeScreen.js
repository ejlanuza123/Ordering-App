// src/screens/customer/HomeScreen.js
import React from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Dimensions,
  ScrollView,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import NotificationIcon from '../../components/NotificationIcon';
import { useNotifications } from '../../context/NotificationContext';

const { width } = Dimensions.get('window');

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { unreadCount } = useNotifications();

  // Extract first name from email or full name
  const getUserFirstName = () => {
    if (user?.email) {
      return user.email.split('@')[0];
    }
    return 'Customer';
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Fixed Header - NOT SCROLLABLE */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.welcomeText}>Welcome back,</Text>
            <Text style={styles.userName}>{getUserFirstName()}!</Text>
          </View>
          
          <View style={styles.headerActions}>
            <NotificationIcon 
              onPress={() => navigation.navigate('Notifications')}
              color="#0033A0"
              size={22}
            />
            
            <TouchableOpacity 
              style={styles.profileButton}
              onPress={() => navigation.navigate('Profile')}
              activeOpacity={0.7}
            >
              <View style={styles.profileIcon}>
                <Ionicons name="person" size={22} color="#0033A0" />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Petron Branding - NOT A BUTTON */}
        <View style={styles.brandContainer}>
          <Image 
            source={require('../../../assets/petron-logo.png')} 
            style={styles.petronLogo}
            resizeMode="contain"
          />
          <View style={styles.brandTextContainer}>
            <Text style={styles.brandTitle}>Petron San Pedro</Text>
            <Text style={styles.brandSubtitle}>Fuel & Lubricants Delivery</Text>
          </View>
        </View>

        {/* Quick Actions - OBVIOUS BUTTONS with hover effect */}
        <View style={styles.quickActionsHeader}>
          <TouchableOpacity 
            style={styles.headerActionButton}
            onPress={() => navigation.navigate('Cart')}
            activeOpacity={0.7}
          >
            <View style={[styles.headerActionIcon, { backgroundColor: '#0033A020' }]}>
              <Ionicons name="cart" size={20} color="#0033A0" />
            </View>
            <Text style={styles.headerActionText}>Cart</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.headerActionButton}
            onPress={() => navigation.navigate('OrderHistory')}
            activeOpacity={0.7}
          >
            <View style={[styles.headerActionIcon, { backgroundColor: '#ED293920' }]}>
              <Ionicons name="time" size={20} color="#ED2939" />
            </View>
            <Text style={styles.headerActionText}>Orders</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.headerActionButton}
            onPress={() => navigation.navigate('Favorites')}
            activeOpacity={0.7}
          >
            <View style={[styles.headerActionIcon, { backgroundColor: '#ED293920' }]}>    
              <Ionicons name="heart" size={20} color="#ED2939" />
            </View>
            <Text style={styles.headerActionText}>Favorites</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.headerActionButton}
            onPress={() => navigation.navigate('Selection', { category: 'Fuel' })}
            activeOpacity={0.7}
          >
            <View style={[styles.headerActionIcon, { backgroundColor: '#10B98120' }]}>
              <Ionicons name="water" size={20} color="#10B981" />
            </View>
            <Text style={styles.headerActionText}>Fuel</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.headerActionButton}
            onPress={() => navigation.navigate('Selection', { category: 'Motor Oil' })}
            activeOpacity={0.7}
          >
            <View style={[styles.headerActionIcon, { backgroundColor: '#F59E0B20' }]}>
              <Ionicons name="water" size={20} color="#F59E0B" />
            </View>
            <Text style={styles.headerActionText}>Oil</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Scrollable Content - Everything below the header */}
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Main Action Section - Order Now is an OBVIOUS BUTTON */}
        <View style={styles.mainSection}>
          <Text style={styles.sectionTitle}>What would you like today?</Text>
          
          {/* Order Now Button - OBVIOUS BUTTON with prominent styling */}
          <TouchableOpacity 
            style={styles.orderNowButton}
            onPress={() => navigation.navigate('Selection', { category: 'Fuel' })}
            activeOpacity={0.7}
          >
            <View style={styles.orderNowContent}>
              <View style={styles.orderNowIconContainer}>
                <Ionicons name="flash" size={32} color="#0033A0" />
              </View>
              <View style={styles.orderNowTextContainer}>
                <Text style={styles.orderNowTitle}>Order Now</Text>
                <Text style={styles.orderNowSubtitle}>
                  Browse fuel & lubricants
                </Text>
              </View>
              <View style={styles.orderNowArrow}>
                <Ionicons name="arrow-forward" size={24} color="#fff" />
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Quick Stats - NOT BUTTONS (just information cards) */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <View style={[styles.statIcon, { backgroundColor: '#0033A020' }]}>
              <Ionicons name="flash" size={18} color="#0033A0" />
            </View>
            <Text style={styles.statValue}>15-30</Text>
            <Text style={styles.statLabel}>Minutes</Text>
          </View>
          
          <View style={styles.statDivider} />
          
          <View style={styles.statItem}>
            <View style={[styles.statIcon, { backgroundColor: '#ED293920' }]}>
              <Ionicons name="shield-checkmark" size={18} color="#ED2939" />
            </View>
            <Text style={styles.statValue}>100%</Text>
            <Text style={styles.statLabel}>Authentic</Text>
          </View>
          
          <View style={styles.statDivider} />
          
          <View style={styles.statItem}>
            <View style={[styles.statIcon, { backgroundColor: '#10B98120' }]}>
              <Ionicons name="location" size={18} color="#10B981" />
            </View>
            <Text style={styles.statValue}>San Pedro</Text>
            <Text style={styles.statLabel}>Area</Text>
          </View>
        </View>

        {/* Services Section - Cards are NOT BUTTONS (just information) */}
        <View style={styles.servicesSection}>
          <Text style={styles.sectionTitle}>Our Services</Text>
          
          <View style={styles.servicesGrid}>
            <View style={styles.serviceCard}>
              <View style={[styles.serviceIcon, { backgroundColor: '#0033A010' }]}>
                <Ionicons name="car" size={20} color="#0033A0" />
              </View>
              <Text style={styles.serviceText}>Vehicle Fuel</Text>
            </View>
            
            <View style={styles.serviceCard}>
              <View style={[styles.serviceIcon, { backgroundColor: '#ED293910' }]}>
                <Ionicons name="construct" size={20} color="#ED2939" />
              </View>
              <Text style={styles.serviceText}>Engine Oils</Text>
            </View>
            
            <View style={styles.serviceCard}>
              <View style={[styles.serviceIcon, { backgroundColor: '#10B98110' }]}>
                <Ionicons name="home" size={20} color="#10B981" />
              </View>
              <Text style={styles.serviceText}>Home Delivery</Text>
            </View>
            
            <View style={styles.serviceCard}>
              <View style={[styles.serviceIcon, { backgroundColor: '#F59E0B10' }]}>
                <Ionicons name="time" size={20} color="#F59E0B" />
              </View>
              <Text style={styles.serviceText}>24/7 Service</Text>
            </View>
          </View>
        </View>

        {/* Footer Info - NOT A BUTTON */}
        <View style={styles.footerCard}>
          <Text style={styles.footerTitle}>Petron San Pedro</Text>
          <Text style={styles.footerText}>
            Premium quality fuel and lubricants delivered to your doorstep in San Pedro area.
            Available 24/7 for your convenience.
          </Text>
          <View style={styles.footerContact}>
            <Ionicons name="call" size={14} color="#666" />
            <Text style={styles.footerContactText}> (02) 8888-9999</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  // Header Styles - FIXED, NOT SCROLLABLE
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 15,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  welcomeText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0033A0',
  },
  profileButton: {
    padding: 6,
  },
  profileIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f4ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Branding - NOT A BUTTON
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  petronLogo: {
    width: 45,
    height: 45,
    borderRadius: 8,
    backgroundColor: '#0033A0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  brandTextContainer: {
    flex: 1,
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0033A0',
    marginBottom: 2,
  },
  brandSubtitle: {
    fontSize: 13,
    color: '#666',
  },
  // Quick Actions - OBVIOUS BUTTONS
  quickActionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f4ff',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerActionButton: {
    alignItems: 'center',
    flex: 1,
    transform: [{ scale: 1 }],
  },
  headerActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  headerActionText: {
    fontSize: 11,
    color: '#666',
    fontWeight: '600',
  },
  // Main Section
  mainSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  // Order Now Button - OBVIOUS BUTTON
  orderNowButton: {
    backgroundColor: '#0033A0',
    borderRadius: 16,
    marginBottom: 20,
    elevation: 5,
    shadowColor: '#0033A0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  orderNowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  orderNowIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  orderNowTextContainer: {
    flex: 1,
  },
  orderNowTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  orderNowSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
  },
  orderNowArrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Stats - INFORMATION CARDS (NOT BUTTONS)
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  statValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    color: '#666',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#e9ecef',
  },
  // Services - INFORMATION CARDS (NOT BUTTONS)
  servicesSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  serviceCard: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  serviceIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  serviceText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#333',
  },
  // Footer - INFORMATION CARD (NOT A BUTTON)
  footerCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  footerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0033A0',
    marginBottom: 8,
  },
  footerText: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
    marginBottom: 12,
  },
  footerContact: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerContactText: {
    fontSize: 13,
    color: '#666',
    marginLeft: 6,
  },
});