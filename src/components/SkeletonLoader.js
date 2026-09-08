import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';

/**
 * Reusable shimmer skeleton placeholder component.
 * Renders animated pulsing placeholder shapes that mimic content layout
 * for a premium loading experience.
 *
 * Usage:
 *   <SkeletonLoader variant="product-card" count={6} />
 *   <SkeletonLoader variant="order-card" count={4} />
 *   <SkeletonLoader variant="dashboard-stats" />
 *   <SkeletonLoader variant="delivery-card" count={3} />
 */

import { useTheme } from '../context/ThemeContext';

const SHIMMER_DURATION = 1200;

function ShimmerBlock({ style }) {
  const opacity = useRef(new Animated.Value(0.3)).current;
  const { isDarkMode } = useTheme();

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: SHIMMER_DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: SHIMMER_DURATION,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return <Animated.View style={[styles.shimmerBase, isDarkMode && { backgroundColor: '#374151' }, style, { opacity }]} />;
}

function ProductCardSkeleton() {
  const { colors } = useTheme();
  return (
    <View style={[styles.productCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <ShimmerBlock style={styles.productImage} />
      <View style={styles.productInfo}>
        <ShimmerBlock style={styles.productTitle} />
        <ShimmerBlock style={styles.productSubtitle} />
        <View style={styles.productFooter}>
          <ShimmerBlock style={styles.productPrice} />
          <ShimmerBlock style={styles.productButton} />
        </View>
      </View>
    </View>
  );
}

function OrderCardSkeleton() {
  const { colors } = useTheme();
  return (
    <View style={[styles.orderCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.orderHeader}>
        <View style={{ flex: 1 }}>
          <ShimmerBlock style={styles.orderNumber} />
          <ShimmerBlock style={styles.orderDate} />
        </View>
        <ShimmerBlock style={styles.statusBadge} />
      </View>
      <ShimmerBlock style={styles.orderItemLine} />
      <ShimmerBlock style={[styles.orderItemLine, { width: '60%' }]} />
      <View style={styles.orderFooterSkel}>
        <ShimmerBlock style={styles.orderTotal} />
        <ShimmerBlock style={styles.orderChevron} />
      </View>
    </View>
  );
}

function DashboardStatsSkeleton() {
  const { colors } = useTheme();
  return (
    <View>
      {/* KPI Cards Row */}
      <View style={styles.statsRow}>
        {[1, 2, 3].map((i) => (
          <View key={i} style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <ShimmerBlock style={styles.statIcon} />
            <ShimmerBlock style={styles.statValue} />
            <ShimmerBlock style={styles.statLabel} />
          </View>
        ))}
      </View>
      {/* Earnings Card */}
      <View style={[styles.earningsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <ShimmerBlock style={{ width: 120, height: 14, borderRadius: 4 }} />
        <ShimmerBlock style={{ width: 180, height: 28, borderRadius: 6, marginTop: 8 }} />
        <ShimmerBlock style={{ width: '100%', height: 8, borderRadius: 4, marginTop: 16 }} />
      </View>
      {/* Activity List */}
      {[1, 2, 3].map((i) => (
        <View key={i} style={[styles.activityItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ShimmerBlock style={styles.activityIcon} />
          <View style={{ flex: 1 }}>
            <ShimmerBlock style={{ width: '70%', height: 14, borderRadius: 4 }} />
            <ShimmerBlock style={{ width: '40%', height: 12, borderRadius: 4, marginTop: 6 }} />
          </View>
        </View>
      ))}
    </View>
  );
}

function DeliveryCardSkeleton() {
  const { colors } = useTheme();
  return (
    <View style={[styles.deliveryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.deliveryHeader}>
        <ShimmerBlock style={{ width: 120, height: 16, borderRadius: 4 }} />
        <ShimmerBlock style={{ width: 80, height: 22, borderRadius: 12 }} />
      </View>
      <ShimmerBlock style={{ width: '85%', height: 14, borderRadius: 4, marginTop: 10 }} />
      <ShimmerBlock style={{ width: '60%', height: 12, borderRadius: 4, marginTop: 6 }} />
      <View style={styles.deliveryFooter}>
        <ShimmerBlock style={{ width: 100, height: 36, borderRadius: 8 }} />
        <ShimmerBlock style={{ width: 100, height: 36, borderRadius: 8 }} />
      </View>
    </View>
  );
}

export default function SkeletonLoader({ variant = 'product-card', count = 4, containerStyle }) {
  const renderItem = (index) => {
    switch (variant) {
      case 'product-card':
        return <ProductCardSkeleton key={index} />;
      case 'order-card':
        return <OrderCardSkeleton key={index} />;
      case 'dashboard-stats':
        return <DashboardStatsSkeleton key={index} />;
      case 'delivery-card':
        return <DeliveryCardSkeleton key={index} />;
      default:
        return <ProductCardSkeleton key={index} />;
    }
  };

  if (variant === 'dashboard-stats') {
    return <View style={[styles.container, containerStyle]}>{renderItem(0)}</View>;
  }

  const items = Array.from({ length: count }, (_, i) => i);

  if (variant === 'product-card') {
    return (
      <View style={[styles.gridContainer, containerStyle]}>
        {items.map((i) => renderItem(i))}
      </View>
    );
  }

  return (
    <View style={[styles.container, containerStyle]}>
      {items.map((i) => renderItem(i))}
    </View>
  );
}

const styles = StyleSheet.create({
  shimmerBase: {
    backgroundColor: '#E5E7EB',
  },
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  // Product Card Skeleton
  productCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  productImage: {
    width: '100%',
    height: 120,
  },
  productInfo: {
    padding: 10,
  },
  productTitle: {
    width: '85%',
    height: 14,
    borderRadius: 4,
    marginBottom: 6,
  },
  productSubtitle: {
    width: '50%',
    height: 12,
    borderRadius: 4,
    marginBottom: 12,
  },
  productFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  productPrice: {
    width: 50,
    height: 16,
    borderRadius: 4,
  },
  productButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  // Order Card Skeleton
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderNumber: {
    width: 120,
    height: 16,
    borderRadius: 4,
    marginBottom: 4,
  },
  orderDate: {
    width: 80,
    height: 12,
    borderRadius: 4,
  },
  statusBadge: {
    width: 75,
    height: 24,
    borderRadius: 12,
  },
  orderItemLine: {
    height: 12,
    borderRadius: 4,
    marginBottom: 6,
  },
  orderFooterSkel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F9FAFB',
  },
  orderTotal: {
    width: 90,
    height: 18,
    borderRadius: 4,
  },
  orderChevron: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  // Dashboard Stats Skeleton
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginBottom: 8,
  },
  statValue: {
    width: 40,
    height: 18,
    borderRadius: 4,
    marginBottom: 4,
  },
  statLabel: {
    width: 50,
    height: 10,
    borderRadius: 4,
  },
  earningsCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
  },
  // Delivery Card Skeleton
  deliveryCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  deliveryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deliveryFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F9FAFB',
  },
});
