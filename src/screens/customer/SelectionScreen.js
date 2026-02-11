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
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Header with Profile Button */}
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
            <View style={styles.petronLogo}>
              <Text style={styles.petronLogoText}>P</Text>
            </View>
            <View style={styles.brandTextContainer}>
              <Text style={styles.brandTitle}>Petron San Pedro</Text>
              <Text style={styles.brandSubtitle}>Fuel & Lubricants Delivery</Text>
            </View>
          </View>

          {/* Quick Stats */}
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

          {/* Quick Actions */}
          <View style={styles.quickActions}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            
            <View style={styles.actionGrid}>
              <TouchableOpacity 
                style={styles.actionCard}
                onPress={() => navigation.navigate('Cart')}
                activeOpacity={0.8}
              >
                <View style={[styles.actionIcon, { backgroundColor: '#0033A0' }]}>
                  <Ionicons name="cart" size={22} color="#fff" />
                </View>
                <Text style={styles.actionLabel}>My Cart</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.actionCard}
                onPress={() => navigation.navigate('OrderHistory')}
                activeOpacity={0.8}
              >
                <View style={[styles.actionIcon, { backgroundColor: '#ED2939' }]}>
                  <Ionicons name="time" size={22} color="#fff" />
                </View>
                <Text style={styles.actionLabel}>My Orders</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.actionCard}
                onPress={() => navigation.navigate('Home', { category: 'Fuel' })}
                activeOpacity={0.8}
              >
                <View style={[styles.actionIcon, { backgroundColor: '#10B981' }]}>
                  <Ionicons name="water" size={22} color="#fff" />
                </View>
                <Text style={styles.actionLabel}>Fuel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.actionCard}
                onPress={() => navigation.navigate('Home', { category: 'Motor Oil' })}
                activeOpacity={0.8}
              >
                <View style={[styles.actionIcon, { backgroundColor: '#F59E0B' }]}>
                  <Ionicons name="oil" size={22} color="#fff" />
                </View>
                <Text style={styles.actionLabel}>Lubricants</Text>
              </TouchableOpacity>
            </View>
          </View>

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
  // Header Styles
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 25,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    marginBottom: 20,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
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
    marginBottom: 20,
  },
  petronLogo: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#0033A0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  petronLogoText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  brandTextContainer: {
    flex: 1,
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0033A0',
    marginBottom: 2,
  },
  brandSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  // Stats
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    padding: 16,
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
    marginBottom: 8,
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
  // Quick Actions
  quickActions: {
    marginBottom: 25,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
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