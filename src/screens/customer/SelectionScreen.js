// src/screens/customer/SelectionScreen.js
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

const { width } = Dimensions.get('window');

export default function SelectionScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

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
          
          <TouchableOpacity 
            style={styles.profileButton}
            onPress={() => navigation.navigate('Profile')}
          >
            <View style={styles.profileIcon}>
              <Ionicons name="person" size={22} color="#0033A0" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Petron Branding */}
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

        {/* Quick Actions - MOVED TO HEADER WITH COLOR INDICATORS */}
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
            onPress={() => navigation.navigate('Home', { category: 'Fuel' })}
            activeOpacity={0.7}
          >
            <View style={[styles.headerActionIcon, { backgroundColor: '#10B98120' }]}>
              <Ionicons name="water" size={20} color="#10B981" />
            </View>
            <Text style={styles.headerActionText}>Fuel</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.headerActionButton}
            onPress={() => navigation.navigate('Home', { category: 'Motor Oil' })}
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
        {/* Quick Stats - MOVED TO SCROLLABLE AREA */}
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

        {/* Main Action Section */}
        <View style={styles.mainSection}>
          <Text style={styles.sectionTitle}>What would you like today?</Text>
          
          {/* Order Now Card */}
          <TouchableOpacity 
            style={styles.orderCard}
            onPress={() => navigation.navigate('Home', { category: 'Fuel' })}
            activeOpacity={0.9}
          >
            <View style={styles.orderCardContent}>
              <View style={styles.orderCardIcon}>
                <Ionicons name="flash" size={32} color="#0033A0" />
              </View>
              <View style={styles.orderCardText}>
                <Text style={styles.orderCardTitle}>Order Now</Text>
                <Text style={styles.orderCardSubtitle}>
                  Browse fuel & lubricants
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#666" />
            </View>
          </TouchableOpacity>

          {/* Services Section */}
          <View style={styles.servicesSection}>
            <Text style={styles.sectionTitle}>Our Services</Text>
            
            <View style={styles.servicesGrid}>
              <View style={styles.serviceItem}>
                <View style={[styles.serviceIcon, { backgroundColor: '#0033A010' }]}>
                  <Ionicons name="car" size={20} color="#0033A0" />
                </View>
                <Text style={styles.serviceText}>Vehicle Fuel</Text>
              </View>
              
              <View style={styles.serviceItem}>
                <View style={[styles.serviceIcon, { backgroundColor: '#ED293910' }]}>
                  <Ionicons name="construct" size={20} color="#ED2939" />
                </View>
                <Text style={styles.serviceText}>Engine Oils</Text>
              </View>
              
              <View style={styles.serviceItem}>
                <View style={[styles.serviceIcon, { backgroundColor: '#10B98110' }]}>
                  <Ionicons name="home" size={20} color="#10B981" />
                </View>
                <Text style={styles.serviceText}>Home Delivery</Text>
              </View>
              
              <View style={styles.serviceItem}>
                <View style={[styles.serviceIcon, { backgroundColor: '#F59E0B10' }]}>
                  <Ionicons name="time" size={20} color="#F59E0B" />
                </View>
                <Text style={styles.serviceText}>24/7 Service</Text>
              </View>
            </View>
          </View>

          {/* Footer Info */}
          <View style={styles.footer}>
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
  // Branding
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
  // Quick Actions in Header WITH COLOR INDICATORS
  quickActionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f4ff',
  },
  headerActionButton: {
    alignItems: 'center',
    flex: 1,
  },
  headerActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  headerActionText: {
    fontSize: 11,
    color: '#666',
    fontWeight: '500',
  },
  // Stats - Now in scrollable area
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
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
  // Main Section
  mainSection: {
    paddingHorizontal: 20,
    paddingTop: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  // Order Card
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 25,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  orderCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  orderCardIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f0f4ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  orderCardText: {
    flex: 1,
  },
  orderCardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0033A0',
    marginBottom: 4,
  },
  orderCardSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  // Services
  servicesSection: {
    marginBottom: 25,
  },
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  serviceItem: {
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
  // Footer
  footer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
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