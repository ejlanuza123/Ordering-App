// src/screens/customer/HomeScreen.js
import React, { useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Dimensions,
  ScrollView,
  Image,
  StatusBar,
  Modal,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import NotificationIcon from '../../components/NotificationIcon';
import { useNotifications } from '../../context/NotificationContext';
import { useCart } from '../../context/CartContext';
import Avatar from '../../components/Avatar';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');
const HOME_WELCOME_VERSION = 'v1';
const getHomeWelcomeStorageKey = (userId) => `home_welcome_seen_${userId}_${HOME_WELCOME_VERSION}`;
const getHomeWelcomeReplayStorageKey = (userId) => `home_welcome_replay_${userId}_${HOME_WELCOME_VERSION}`;
const WELCOME_DOT_SLOT = 18;
const WELCOME_DOT_GAP = 8;
const WELCOME_DOT_STEP = WELCOME_DOT_SLOT + WELCOME_DOT_GAP;
const HOME_WELCOME_STEPS = [
  {
    icon: 'sparkles',
    color: '#0033A0',
    title: 'Welcome to Petron San Pedro',
    description: 'Order fuel and lubricants quickly, monitor your notifications, and manage your account in one place.',
  },
  {
    icon: 'flash',
    color: '#ED2939',
    title: 'Fast Ordering Flow',
    description: 'Tap Quick Order to choose products, checkout, and get your delivery in as fast as 15-30 minutes.',
  },
  {
    icon: 'calendar',
    color: '#10B981',
    title: 'Reserve Your Station Slot',
    description: 'Use Reserve to schedule walk-in or drive-in station refuel times and manage your reservations easily.',
  },
];

export default function HomeScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  const { cartItems } = useCart();
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [welcomeStepIndex, setWelcomeStepIndex] = useState(0);
  const lastReplayTokenRef = React.useRef(null);
  const isWelcomeAnimatingRef = React.useRef(false);
  const welcomeStepTransition = React.useRef(new Animated.Value(1)).current;
  const welcomeDotSlideTranslateX = React.useRef(new Animated.Value(0)).current;

  const welcomeStepTranslateX = welcomeStepTransition.interpolate({
    inputRange: [0, 1],
    outputRange: [28, 0],
  });

  React.useEffect(() => {
    Animated.timing(welcomeDotSlideTranslateX, {
      toValue: welcomeStepIndex * WELCOME_DOT_STEP,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [welcomeStepIndex, welcomeDotSlideTranslateX]);

  React.useEffect(() => {
    const maybeShowWelcomeModal = async () => {
      if (!user?.id) {
        setShowWelcomeModal(false);
        setWelcomeStepIndex(0);
        return;
      }

      try {
        const storageKey = getHomeWelcomeStorageKey(user.id);
        const seen = await AsyncStorage.getItem(storageKey);
        if (seen === '1') {
          setShowWelcomeModal(false);
          return;
        }

        setWelcomeStepIndex(0);
        setShowWelcomeModal(true);
      } catch (error) {
        console.warn('Failed to load home welcome state:', error?.message || error);
      }
    };

    maybeShowWelcomeModal();
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const openReplayGuideIfRequested = async () => {
        const routeToken = route?.params?.replayWelcomeGuideAt;
        let storageToken = null;

        if (user?.id) {
          try {
            storageToken = await AsyncStorage.getItem(getHomeWelcomeReplayStorageKey(user.id));
          } catch (error) {
            console.warn('Failed to read replay welcome state:', error?.message || error);
          }
        }

        const replayToken = routeToken || storageToken;
        if (!isActive || !replayToken) {
          return;
        }

        if (replayToken !== lastReplayTokenRef.current) {
          lastReplayTokenRef.current = replayToken;
          setWelcomeStepIndex(0);
          setShowWelcomeModal(true);
        }

        if (storageToken && user?.id) {
          try {
            await AsyncStorage.removeItem(getHomeWelcomeReplayStorageKey(user.id));
          } catch (error) {
            console.warn('Failed to clear replay welcome state:', error?.message || error);
          }
        }
      };

      openReplayGuideIfRequested();

      return () => {
        isActive = false;
      };
    }, [route?.params?.replayWelcomeGuideAt, user?.id])
  );

  const completeWelcomeFlow = useCallback(async () => {
    if (!user?.id) {
      setShowWelcomeModal(false);
      return;
    }

    try {
      await AsyncStorage.setItem(getHomeWelcomeStorageKey(user.id), '1');
    } catch (error) {
      console.warn('Failed to save home welcome state:', error?.message || error);
    } finally {
      setShowWelcomeModal(false);
      setWelcomeStepIndex(0);
    }
  }, [user?.id]);

  const goToNextWelcomeStep = useCallback(() => {
    if (isWelcomeAnimatingRef.current) {
      return;
    }

    if (welcomeStepIndex >= HOME_WELCOME_STEPS.length - 1) {
      completeWelcomeFlow();
      return;
    }

    const nextStepIndex = welcomeStepIndex + 1;
    isWelcomeAnimatingRef.current = true;
    setWelcomeStepIndex(nextStepIndex);
    welcomeStepTransition.setValue(0);

    Animated.timing(welcomeStepTransition, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      isWelcomeAnimatingRef.current = false;
    });
  }, [welcomeStepIndex, completeWelcomeFlow, welcomeStepTransition]);

  const currentWelcomeStep = HOME_WELCOME_STEPS[welcomeStepIndex] || HOME_WELCOME_STEPS[0];

  useFocusEffect(
    useCallback(() => {
      const fetchLatestAvatar = async () => {
        if (!user) return;
        
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('avatar_url')
            .eq('id', user.id)
            .single();
            
          if (!error && data?.avatar_url) {
            setCurrentAvatarUrl(data.avatar_url);
          }
        } catch (error) {
          console.error('Error fetching latest avatar:', error);
        }
      };

      fetchLatestAvatar();
    }, [user])
  );

  // Extract first name from email or full name
  const getUserFirstName = () => {
    if (user?.email) {
      return user.email.split('@')[0];
    }
    return 'Customer';
  };

  // Get greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {/* Fixed Header - Modern Design */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.brandContainerHeader}>
            <View style={styles.logoWrapperHeader}>
              <Image
                source={require('../../../assets/petron-logo.jpg')}
                style={styles.petronLogoHeader}
                resizeMode="contain"
              />
            </View>
            <View style={styles.brandTextContainer}>
              <Text style={styles.brandTitleHeader}>Petron San Pedro</Text>
              <Text style={styles.brandSubtitleHeader}>Fuel & Lubricants Delivery</Text>
            </View>
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
            >
              <Avatar 
                size={40} 
                avatarUrl={currentAvatarUrl}
                editable={false}
                showEditButton={false}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.greetingSection}>
          <Text style={styles.greeting}>{getGreeting()},</Text>
          <View style={styles.userNameContainer}>
            <Text style={styles.userName}>{getUserFirstName()}</Text>
            <View style={styles.greetingEmoji}>
              <Text style={styles.greetingEmojiText}>👋</Text>
            </View>
          </View>
        </View>

        {/* Quick Actions - Enhanced Buttons */}
        <View style={styles.quickActionsHeader}>
          <TouchableOpacity 
            style={styles.headerActionButton}
            onPress={() => navigation.navigate('Cart')}
            activeOpacity={0.7}
          >
            <View style={[styles.headerActionIcon, { backgroundColor: '#0033A0' }]}>
              <Ionicons name="cart" size={20} color="#fff" />
              {cartItems.length > 0 && (
                <View style={styles.headerActionBadge}>
                  <Text style={styles.headerActionBadgeText}>
                    {cartItems.length > 9 ? '9+' : cartItems.length}
                  </Text>
                </View>
              )}
            </View>
            <Text
              style={styles.headerActionText}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              Cart
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.headerActionButton}
            onPress={() => navigation.navigate('OrderHistory')}
            activeOpacity={0.7}
          >
            <View style={[styles.headerActionIcon, { backgroundColor: '#ED2939' }]}>
              <Ionicons name="time" size={20} color="#fff" />
            </View>
            <Text
              style={styles.headerActionText}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              Orders
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.headerActionButton}
            onPress={() => navigation.navigate('Favorites')}
            activeOpacity={0.7}
          >
            <View style={[styles.headerActionIcon, { backgroundColor: '#ED2939' }]}>    
              <Ionicons name="heart" size={20} color="#fff" />
            </View>
            <Text
              style={styles.headerActionText}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              Favorites
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerActionButton}
            onPress={() => navigation.navigate('Reservation', { openNotice: true })}
            activeOpacity={0.7}
          >
            <View style={[styles.headerActionIcon, { backgroundColor: '#10B981' }]}>
              <Ionicons name="calendar" size={20} color="#fff" />
            </View>
            <Text
              style={styles.headerActionText}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              Reserve
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.headerActionButton}
            onPress={() => setShowReviewModal(true)}
            activeOpacity={0.7}
          >
            <View style={[styles.headerActionIcon, { backgroundColor: '#F59E0B' }]}>
              <Ionicons name="star" size={20} color="#fff" />
            </View>
            <Text
              style={styles.headerActionText}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              Reviews
            </Text>
          </TouchableOpacity>
          
        </View>
      </View>

      {/* Scrollable Content */}
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        bounces={true}
      >
        {/* Main Action Section - Enhanced Order Now Button */}
        <View style={styles.mainSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>What would you like today?</Text>
          </View>
          
          <TouchableOpacity 
            style={styles.orderNowButton}
            onPress={() => navigation.navigate('Selection', { category: 'Fuel' })}
            activeOpacity={0.7}
          >
            <View style={styles.orderNowGradient}>
              <View style={styles.orderNowIconContainer}>
                <Ionicons name="flash" size={32} color="#0033A0" />
              </View>
              <View style={styles.orderNowTextContainer}>
                <Text style={styles.orderNowTitle}>Quick Order</Text>
                <Text style={styles.orderNowSubtitle}>
                  Get fuel delivered in 15-30 mins
                </Text>
              </View>
              <View style={styles.orderNowArrow}>
                <Ionicons name="arrow-forward-circle" size={32} color="#fff" />
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Quick Stats - Enhanced Design */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <View style={[styles.statIcon, { backgroundColor: '#0033A0' }]}>
              <Ionicons name="flash" size={20} color="#fff" />
            </View>
            <View style={styles.statInfo}>
              <Text style={styles.statValue}>15-30</Text>
              <Text style={styles.statLabel}>Minutes</Text>
            </View>
          </View>
          
          <View style={styles.statDivider} />
          
          <View style={styles.statItem}>
            <View style={[styles.statIcon, { backgroundColor: '#ED2939' }]}>
              <Ionicons name="shield-checkmark" size={20} color="#fff" />
            </View>
            <View style={styles.statInfo}>
              <Text style={styles.statValue}>100%</Text>
              <Text style={styles.statLabel}>Authentic</Text>
            </View>
          </View>
          
          <View style={styles.statDivider} />
          
          <View style={styles.statItem}>
            <View style={[styles.statIcon, { backgroundColor: '#10B981' }]}>
              <Ionicons name="location" size={20} color="#fff" />
            </View>
            <View style={styles.statInfo}>
              <Text style={styles.statValue}>San Pedro</Text>
              <Text style={styles.statLabel}>Coverage</Text>
            </View>
          </View>
        </View>

        {/* Why Choose Us Section */}
        <View style={styles.whyChooseSection}>
          <Text style={styles.sectionTitle}>Why Choose Us</Text>
          
          <View style={styles.featuresGrid}>
            <View style={styles.featureCard}>
              <View style={styles.featureIconContainer}>
                <Ionicons name="rocket" size={24} color="#0033A0" />
              </View>
              <Text style={styles.featureTitle}>Lightning Fast</Text>
              <Text style={styles.featureDescription}>15-30 min delivery</Text>
            </View>

            <View style={styles.featureCard}>
              <View style={styles.featureIconContainer}>
                <Ionicons name="shield" size={24} color="#ED2939" />
              </View>
              <Text style={styles.featureTitle}>100% Authentic</Text>
              <Text style={styles.featureDescription}>Petron quality assured</Text>
            </View>

            <View style={styles.featureCard}>
              <View style={styles.featureIconContainer}>
                <Ionicons name="headset" size={24} color="#10B981" />
              </View>
              <Text style={styles.featureTitle}>24/7 Support</Text>
              <Text style={styles.featureDescription}>Always here to help</Text>
            </View>

            <View style={styles.featureCard}>
              <View style={styles.featureIconContainer}>
                <Ionicons name="wallet" size={24} color="#F59E0B" />
              </View>
              <Text style={styles.featureTitle}>Best Prices</Text>
              <Text style={styles.featureDescription}>Competitive rates</Text>
            </View>
          </View>
        </View>


        {/* Footer Info */}
        <View style={styles.footerCard}>
          <View style={styles.footerHeader}>
            <Image 
              source={require('../../../assets/petron-logo.jpg')} 
              style={styles.footerLogo}
              resizeMode="contain"
            />
            <View>
              <Text style={styles.footerTitle}>Petron San Pedro</Text>
              <Text style={styles.footerSubtitle}>Since 1980</Text>
            </View>
          </View>
          <Text style={styles.footerText}>
            Premium quality fuel and lubricants delivered to your doorstep in San Pedro area. 
            Available 24/7 for your convenience.
          </Text>
          <View style={styles.footerContact}>
            <View style={styles.footerContactItem}>
              <Ionicons name="call" size={16} color="#0033A0" />
              <Text style={styles.footerContactText}> (02) 8888-9999</Text>
            </View>
            <View style={styles.footerContactItem}>
              <Ionicons name="mail" size={16} color="#0033A0" />
              <Text style={styles.footerContactText}> support@petronsanpedro.com</Text>
            </View>
          </View>
          <View style={styles.footerSocial}>
            <TouchableOpacity style={styles.socialIcon}>
              <Ionicons name="logo-facebook" size={20} color="#0033A0" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.socialIcon}>
              <Ionicons name="logo-instagram" size={20} color="#0033A0" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.socialIcon}>
              <Ionicons name="logo-twitter" size={20} color="#0033A0" />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Review Choice Modal */}
      <Modal
        visible={showReviewModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowReviewModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>What would you like to review?</Text>
              <TouchableOpacity 
                onPress={() => setShowReviewModal(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={28} color="#1F2937" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalChoices}>
              {/* Rate Rider Option */}
              <TouchableOpacity
                style={styles.choiceCard}
                onPress={() => {
                  setShowReviewModal(false);
                  navigation.navigate('RiderReviews');
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.choiceIcon, { backgroundColor: '#FEE2E2' }]}>
                  <Ionicons name="person" size={32} color="#DC2626" />
                </View>
                <View style={styles.choiceTextContainer}>
                  <Text style={styles.choiceTitle}>Rate a Rider</Text>
                  <Text style={styles.choiceSubtitle}>
                    Share your experience with the delivery rider
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color="#9CA3AF" />
              </TouchableOpacity>

              {/* Rate Product Option */}
              <TouchableOpacity
                style={styles.choiceCard}
                onPress={() => {
                  setShowReviewModal(false);
                  navigation.navigate('ProductReviews');
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.choiceIcon, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="cube" size={32} color="#D97706" />
                </View>
                <View style={styles.choiceTextContainer}>
                  <Text style={styles.choiceTitle}>Rate a Product</Text>
                  <Text style={styles.choiceSubtitle}>
                    Share your feedback about the fuel or lubricants
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showWelcomeModal}
        transparent
        animationType="fade"
        onRequestClose={completeWelcomeFlow}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.welcomeModalContent}>
            <View style={styles.welcomeModalHeader}>
              <Text style={styles.welcomeModalLabel}>Getting Started</Text>
              <TouchableOpacity
                onPress={completeWelcomeFlow}
                style={styles.modalCloseButton}
                accessibilityRole="button"
                accessibilityLabel="Close welcome guide"
              >
                <Ionicons name="close" size={24} color="#1F2937" />
              </TouchableOpacity>
            </View>

            <View style={styles.welcomeStepIconWrap}>
              <Animated.View
                style={{
                  opacity: welcomeStepTransition,
                  transform: [{ translateX: welcomeStepTranslateX }],
                }}
              >
                <View style={[styles.welcomeStepIconCircle, { backgroundColor: currentWelcomeStep.color }]}>
                  <Ionicons name={currentWelcomeStep.icon} size={30} color="#fff" />
                </View>
              </Animated.View>
            </View>

            <Animated.View
              style={[
                styles.welcomeStepContent,
                {
                  opacity: welcomeStepTransition,
                  transform: [{ translateX: welcomeStepTranslateX }],
                },
              ]}
            >
              <Text style={styles.welcomeStepTitle}>{currentWelcomeStep.title}</Text>
              <Text style={styles.welcomeStepDescription}>{currentWelcomeStep.description}</Text>
            </Animated.View>

            <View style={styles.welcomeProgressRow}>
              <View style={styles.welcomeProgressTrack}>
                {HOME_WELCOME_STEPS.map((_, index) => (
                  <View
                    key={`welcome-step-${index + 1}`}
                    style={styles.welcomeProgressDotSlot}
                  >
                    <View style={styles.welcomeProgressDot} />
                  </View>
                ))}
                <Animated.View
                  style={[
                    styles.welcomeProgressDotActive,
                    {
                      transform: [{ translateX: welcomeDotSlideTranslateX }],
                    },
                  ]}
                />
              </View>
            </View>

            <TouchableOpacity style={styles.welcomeNextButton} onPress={goToNextWelcomeStep}>
              <Text style={styles.welcomeNextButtonText}>
                {welcomeStepIndex === HOME_WELCOME_STEPS.length - 1 ? 'Start Exploring' : 'Next'}
              </Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    zIndex: 0,
  },
  scrollContent: {
    flexGrow: 1,
  },
  // Header Styles - Modern Design
  header: {
    position: 'relative',
    zIndex: 10,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 5,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    elevation: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  brandContainerHeader: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  logoWrapperHeader: {
    backgroundColor: '#0033A0',
    borderRadius: 10,
    padding: 4,
    marginRight: 10,
  },
  petronLogoHeader: {
    width: 36,
    height: 36,
    borderRadius: 6,
  },
  brandTitleHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0033A0',
    marginBottom: 1,
  },
  brandSubtitleHeader: {
    fontSize: 11,
    color: '#666',
  },
  greetingSection: {
    marginBottom: 14,
  },
  greeting: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  userNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0033A0',
  },
  greetingEmoji: {
    backgroundColor: '#f0f4ff',
    borderRadius: 15,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  greetingEmojiText: {
    fontSize: 16,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profileButton: {
    padding: 0,
  },
  profileIcon: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: '#0033A0',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#0033A0',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  profileInitial: {
    fontSize: 18,
    color: '#fff',
    fontWeight: 'bold',
  },
  // Branding - Enhanced
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    padding: 12,
  },
  logoWrapper: {
    backgroundColor: '#0033A0',
    borderRadius: 12,
    padding: 5,
    marginRight: 12,
  },
  petronLogo: {
    width: 45,
    height: 45,
    borderRadius: 8,
  },
  brandTextContainer: {
    flex: 1,
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0033A0',
    marginBottom: 2,
  },
  brandSubtitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  brandBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  brandBadgeText: {
    fontSize: 10,
    color: '#999',
  },
  // Promo Banner
  promoBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#10B98110',
    borderRadius: 12,
    padding: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#10B98120',
  },
  promoContent: {
    flex: 1,
  },
  promoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#10B981',
    marginBottom: 2,
  },
  promoSubtitle: {
    fontSize: 12,
    color: '#666',
  },
  promoBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Quick Actions - Enhanced
  quickActionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  headerActionButton: {
    marginHorizontal: 2,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(0, 51, 160, 0.10)',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    elevation: 7,
    shadowColor: '#0B2E6B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
  },
  headerActionIcon: {
    width: 46,
    height: 46,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 6,
  },
  headerActionBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ED2939',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: '#fff',
  },
  headerActionBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  headerActionText: {
    fontSize: 10,
    color: '#24324A',
    fontWeight: '700',
    letterSpacing: 0.2,
    textAlign: 'center',
    width: '100%',
  },
  // Main Section
  mainSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  viewAllText: {
    fontSize: 14,
    color: '#0033A0',
    fontWeight: '600',
  },
  // Order Now Button - Enhanced
  orderNowButton: {
    borderRadius: 20,
    marginBottom: 20,
    elevation: 20,
    shadowColor: '#0033A0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    overflow: 'hidden',
  },
  orderNowGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#0033A0',
  },
  orderNowIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
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
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
  },
  orderNowArrow: {
    marginLeft: 8,
  },
  // Stats - Enhanced
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  statItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statInfo: {
    flex: 1,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 11,
    color: '#666',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#e9ecef',
    marginHorizontal: 8,
  },
  // Categories Section
  categoriesSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  categoryCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  categoryIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  categoryCount: {
    fontSize: 12,
    color: '#666',
  },
  // Why Choose Us Section
  whyChooseSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  featureCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  featureIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f0f4ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
    textAlign: 'center',
  },
  featureDescription: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
  },
  // Promo Section
  promoSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  promoCard: {
    backgroundColor: '#0033A0',
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#0033A0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  promoCardContent: {
    flex: 1,
  },
  promoCardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  promoCardSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 12,
  },
  promoCardButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  promoCardButtonText: {
    color: '#0033A0',
    fontWeight: 'bold',
    fontSize: 12,
  },
  promoCardImage: {
    marginLeft: 16,
  },
  // Footer - Enhanced
  footerCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e9ecef',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  footerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    gap: 12,
  },
  footerLogo: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  footerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0033A0',
  },
  footerSubtitle: {
    fontSize: 11,
    color: '#999',
  },
  footerText: {
    fontSize: 13,
    color: '#666',
    lineHeight: 20,
    marginBottom: 15,
  },
  footerContact: {
    marginBottom: 15,
    gap: 8,
  },
  footerContactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  footerContactText: {
    fontSize: 12,
    color: '#666',
  },
  footerSocial: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  socialIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f4ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Review Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingTop: 20,
    width: '100%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
  },
  modalCloseButton: {
    padding: 8,
  },
  modalChoices: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  choiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  choiceIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  choiceTextContainer: {
    flex: 1,
  },
  choiceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  choiceSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  welcomeModalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '100%',
    maxWidth: 400,
    minHeight: 430,
    padding: 20,
    alignItems: 'center',
  },
  welcomeModalHeader: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  welcomeModalLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  welcomeStepIconWrap: {
    marginTop: 10,
    marginBottom: 12,
  },
  welcomeStepContent: {
    width: '100%',
    minHeight: 132,
  },
  welcomeStepIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  welcomeStepTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },
  welcomeStepDescription: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 6,
    minHeight: 70,
  },
  welcomeProgressRow: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 18,
  },
  welcomeProgressTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: WELCOME_DOT_GAP,
    position: 'relative',
  },
  welcomeProgressDotSlot: {
    width: WELCOME_DOT_SLOT,
    alignItems: 'center',
  },
  welcomeProgressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(0, 51, 160, 0.28)',
  },
  welcomeProgressDotActive: {
    position: 'absolute',
    left: 0,
    width: WELCOME_DOT_SLOT,
    height: 8,
    top: 0,
    borderRadius: 999,
    backgroundColor: '#0033A0',
  },
  welcomeNextButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0033A0',
    borderRadius: 12,
    paddingVertical: 13,
  },
  welcomeNextButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});