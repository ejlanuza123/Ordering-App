import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  Image,
  StatusBar,
  useWindowDimensions,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export default function IntroScreen({ onGetStarted }) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const [stage, setStage] = useState('hero');
  const [currentInfoIndex, setCurrentInfoIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const logoScaleAnim = useRef(new Animated.Value(0.35)).current;
  const logoMoveAnim = useRef(new Animated.Value(0)).current;
  const heroTextOpacity = useRef(new Animated.Value(0)).current;
  const heroButtonOpacity = useRef(new Animated.Value(0)).current;
  const heroExitOpacity = useRef(new Animated.Value(1)).current;
  const heroExitTranslate = useRef(new Animated.Value(0)).current;
  const infoEnterOpacity = useRef(new Animated.Value(0)).current;
  const infoEnterTranslate = useRef(new Animated.Value(20)).current;
  const infoExitOpacity = useRef(new Animated.Value(1)).current;
  const infoExitTranslate = useRef(new Animated.Value(0)).current;
  const infoPagerTranslateX = useRef(new Animated.Value(0)).current;
  const dotSlideTranslateX = useRef(new Animated.Value(0)).current;
  const slideWidth = screenWidth;

  const DOT_SLOT = 18;
  const DOT_GAP = 8;
  const DOT_STEP = DOT_SLOT + DOT_GAP;

  const infoSlides = useMemo(
    () => [
      {
        icon: 'bag-check-outline',
        title: 'What This App Can Do',
        description: 'You can place and manage delivery orders from your phone without calling or texting manually.',
        sections: [
          {
            heading: 'Order Fast',
            body: 'Browse products, add to cart, and complete checkout quickly with saved details.',
          },
          {
            heading: 'Track Deliveries Live',
            body: 'See order progress and rider updates in real time from preparation to completion.',
          },
          {
            heading: 'Get Important Alerts',
            body: 'Receive notifications for confirmation, rider assignment, status updates, and delivery completion.',
          },
        ],
      },
      {
        icon: 'people-outline',
        title: 'Built For Customer And Rider Workflow',
        description: 'The app supports both sides of delivery so updates stay accurate for everyone involved.',
        sections: [
          {
            heading: 'Customer Side',
            body: 'Manage account profile, check order history, and monitor active deliveries with clear status visibility.',
          },
          {
            heading: 'Rider Side',
            body: 'Accept assigned deliveries, navigate routes, and update delivery status directly in-app.',
          },
          {
            heading: 'Synchronized Updates',
            body: 'Status changes are reflected quickly so customers and riders stay aligned.',
          },
        ],
      },
      {
        icon: 'shield-checkmark-outline',
        title: 'Reliable, Clear, And Easy To Use',
        description: 'Everything is designed to make ordering and delivery tracking simple for daily use.',
        sections: [
          {
            heading: 'Simple Interface',
            body: 'Clean screens and guided actions reduce errors during ordering and delivery steps.',
          },
          {
            heading: 'Always Up To Date',
            body: 'Real-time notifications keep you informed without repeatedly checking multiple screens.',
          },
          {
            heading: 'Ready To Start',
            body: 'Continue to login and begin ordering or managing deliveries.',
          },
        ],
      },
    ],
    []
  );

  const isLastInfoSlide = currentInfoIndex === infoSlides.length - 1;

  useEffect(() => {
    infoPagerTranslateX.setValue(-currentInfoIndex * slideWidth);
    dotSlideTranslateX.setValue(currentInfoIndex * DOT_STEP);
  }, [currentInfoIndex, dotSlideTranslateX, infoPagerTranslateX, slideWidth, DOT_STEP]);

  useEffect(() => {
    Animated.sequence([
      Animated.timing(logoScaleAnim, {
        toValue: 1,
        duration: 900,
        easing: Easing.out(Easing.back(1.2)),
        useNativeDriver: true,
      }),
      Animated.timing(logoMoveAnim, {
        toValue: -18,
        duration: 800,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(heroTextOpacity, {
          toValue: 1,
          duration: 450,
          useNativeDriver: true,
        }),
        Animated.timing(heroButtonOpacity, {
          toValue: 1,
          duration: 450,
          delay: 180,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [heroButtonOpacity, heroTextOpacity, logoMoveAnim, logoScaleAnim]);

  const handleStartInfo = () => {
    if (isTransitioning) return;
    setIsTransitioning(true);

    Animated.parallel([
      Animated.timing(heroExitOpacity, {
        toValue: 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(heroExitTranslate, {
        toValue: -12,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setStage('info');
      Animated.parallel([
        Animated.timing(infoEnterOpacity, {
          toValue: 1,
          duration: 320,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(infoEnterTranslate, {
          toValue: 0,
          duration: 320,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => setIsTransitioning(false));
    });
  };

  const goToPrevInfoSlide = () => {
    if (currentInfoIndex === 0 || isTransitioning) return;
    setIsTransitioning(true);

    const targetIndex = currentInfoIndex - 1;

    Animated.parallel([
      Animated.timing(infoPagerTranslateX, {
        toValue: -targetIndex * slideWidth,
        duration: 420,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
        useNativeDriver: true,
      }),
      Animated.timing(dotSlideTranslateX, {
        toValue: targetIndex * DOT_STEP,
        duration: 420,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setCurrentInfoIndex(targetIndex);
      setIsTransitioning(false);
    });
  };

  const goToNextInfoSlide = () => {
    if (isLastInfoSlide) {
      if (isTransitioning) return;

      setIsTransitioning(true);
      Animated.parallel([
        Animated.timing(infoExitOpacity, {
          toValue: 0,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(infoExitTranslate, {
          toValue: -14,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => {
        onGetStarted();
      });
      return;
    }

    if (isTransitioning) return;
    setIsTransitioning(true);

    const targetIndex = currentInfoIndex + 1;

    Animated.parallel([
      Animated.timing(infoPagerTranslateX, {
        toValue: -targetIndex * slideWidth,
        duration: 420,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
        useNativeDriver: true,
      }),
      Animated.timing(dotSlideTranslateX, {
        toValue: targetIndex * DOT_STEP,
        duration: 420,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setCurrentInfoIndex(targetIndex);
      setIsTransitioning(false);
    });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 6, paddingBottom: Math.max(insets.bottom, 12) + 6 }]}>
      <StatusBar barStyle="light-content" backgroundColor="#0033A0" />

      <View style={styles.backgroundBlobTop} />
      <View style={styles.backgroundBlobBottom} />

      {stage === 'hero' ? (
        <Animated.View style={[styles.logoCard, { transform: [{ scale: logoScaleAnim }, { translateY: logoMoveAnim }] }]}>
          <Image source={require('../../../assets/petron-logo.jpg')} style={styles.logo} resizeMode="contain" />
        </Animated.View>
      ) : null}

      {stage === 'hero' ? (
        <Animated.View
          style={[
            styles.heroContent,
            {
              opacity: Animated.multiply(heroTextOpacity, heroExitOpacity),
              transform: [{ translateY: heroExitTranslate }],
            },
          ]}
        >
          <Text style={styles.title}>Welcome to Petron San Pedro</Text>
          <Text style={styles.subtitle}>Fast ordering, real-time tracking, and reliable updates in one app experience.</Text>

          <Animated.View style={{ opacity: heroButtonOpacity, width: '100%' }}>
            <TouchableOpacity style={[styles.ctaButton, styles.heroCtaButton]} activeOpacity={0.9} onPress={handleStartInfo}>
              <Text style={styles.ctaText}>Get Started</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      ) : (
        <Animated.View
          style={[
            styles.infoContent,
            {
              opacity: Animated.multiply(infoEnterOpacity, infoExitOpacity),
              transform: [{ translateY: Animated.add(infoEnterTranslate, infoExitTranslate) }],
              paddingTop: 8,
            },
          ]}
        >
          <ScrollView
            style={styles.infoScroll}
            contentContainerStyle={styles.infoScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.infoPagerViewport}>
              <Animated.View
                style={[
                  styles.infoPagerRow,
                  {
                    width: slideWidth * infoSlides.length,
                    transform: [{ translateX: infoPagerTranslateX }],
                  },
                ]}
              >
                {infoSlides.map((slide, index) => {
                  const center = -index * slideWidth;
                  const headerParallaxX = infoPagerTranslateX.interpolate({
                    inputRange: [center - slideWidth, center, center + slideWidth],
                    outputRange: [12, 0, -12],
                    extrapolate: 'clamp',
                  });
                  const cardParallaxX = infoPagerTranslateX.interpolate({
                    inputRange: [center - slideWidth, center, center + slideWidth],
                    outputRange: [18, 0, -18],
                    extrapolate: 'clamp',
                  });

                  return (
                    <View key={slide.title} style={[styles.infoSlideArea, { width: slideWidth }]}>
                    <View style={styles.infoSlideInner}>
                      <Animated.View style={[styles.infoHeaderArea, { transform: [{ translateX: headerParallaxX }] }]}>
                        <View style={styles.infoIconWrap}>
                          <Ionicons name={slide.icon} size={28} color="#0033A0" />
                        </View>
                        <Text style={styles.infoTitle}>{slide.title}</Text>
                        <Text style={styles.infoDescription}>{slide.description}</Text>
                      </Animated.View>

                      <Animated.View style={[styles.featuresCard, { transform: [{ translateX: cardParallaxX }] }]}>
                        {slide.sections.map((section) => (
                          <View key={section.heading} style={styles.featureRow}>
                            <Text style={styles.featureHeading}>{section.heading}</Text>
                            <Text style={styles.featureText}>{section.body}</Text>
                          </View>
                        ))}
                      </Animated.View>
                    </View>
                  </View>
                  );
                })}
              </Animated.View>
            </View>
          </ScrollView>

          <View style={[styles.infoFooter, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <View style={styles.paginationRow}>
              <View style={styles.paginationTrack}>
                {infoSlides.map((_, index) => (
                  <View key={`dot-${index}`} style={styles.paginationDotSlot}>
                    <View style={styles.paginationDot} />
                  </View>
                ))}
                <Animated.View
                  style={[
                    styles.paginationDotActive,
                    {
                      transform: [{ translateX: dotSlideTranslateX }],
                    },
                  ]}
                />
              </View>
            </View>

            <View style={styles.navButtonsRow}>
              <TouchableOpacity
                style={[styles.secondaryButton, currentInfoIndex === 0 && styles.secondaryButtonDisabled]}
                activeOpacity={1}
                onPress={goToPrevInfoSlide}
                disabled={currentInfoIndex === 0 || isTransitioning}
              >
                <Ionicons name="arrow-back" size={16} color={currentInfoIndex === 0 ? '#94A3B8' : '#0033A0'} />
                <Text style={[styles.secondaryButtonText, currentInfoIndex === 0 && styles.secondaryButtonTextDisabled]}>
                  Prev
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.ctaButton, styles.nextButton]}
                activeOpacity={1}
                onPress={goToNextInfoSlide}
                disabled={isTransitioning}
              >
                <Text style={styles.ctaText}>{isLastInfoSlide ? 'Login Now' : 'Next'}</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0033A0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backgroundBlobTop: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    top: -50,
    right: -40,
  },
  backgroundBlobBottom: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(237, 41, 57, 0.22)',
    bottom: -60,
    left: -40,
  },
  logoCard: {
    width: 120,
    height: 120,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 10,
  },
  logo: {
    width: 114,
    height: 114,
    borderRadius: 16,
  },
  heroContent: {
    width: '100%',
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  infoContent: {
    width: '100%',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'space-between',
  },
  infoScroll: {
    width: '100%',
    flex: 1,
  },
  infoScrollContent: {
    paddingTop: 4,
    paddingBottom: 10,
  },
  infoSlideArea: {
    alignItems: 'center',
  },
  infoSlideInner: {
    width: '100%',
    paddingHorizontal: 24,
  },
  infoPagerViewport: {
    width: '100%',
    overflow: 'hidden',
  },
  infoPagerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoHeaderArea: {
    width: '100%',
    alignItems: 'center',
  },
  infoFooter: {
    width: '100%',
  },
  title: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 38,
    marginTop: 4,
  },
  subtitle: {
    marginTop: 10,
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  infoIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 14,
  },
  infoTitle: {
    color: '#fff',
    fontSize: 25,
    fontWeight: '800',
    textAlign: 'center',
  },
  infoDescription: {
    marginTop: 10,
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  featuresCard: {
    marginTop: 22,
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 16,
    width: '100%',
    gap: 14,
  },
  featureRow: {
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 10,
  },
  featureHeading: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  featureText: {
    color: '#334155',
    fontSize: 13,
    lineHeight: 18,
  },
  paginationRow: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    marginBottom: 4,
  },
  paginationTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
    position: 'relative',
  },
  paginationDotSlot: {
    width: 18,
    alignItems: 'center',
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
  paginationDotActive: {
    width: 18,
    height: 8,
    position: 'absolute',
    left: 0,
    top: 0,
    borderRadius: 999,
    backgroundColor: '#fff',
  },
  navButtonsRow: {
    marginTop: 24,
    width: '100%',
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    height: 56,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  secondaryButtonDisabled: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  secondaryButtonText: {
    color: '#0033A0',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButtonTextDisabled: {
    color: '#94A3B8',
  },
  ctaButton: {
    marginTop: 24,
    backgroundColor: '#ED2939',
    borderRadius: 14,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  heroCtaButton: {
    width: '100%',
  },
  nextButton: {
    flex: 1,
    marginTop: 0,
  },
  ctaText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
});
