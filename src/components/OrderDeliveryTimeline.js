import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const TIMELINE_STEPS = [
  { id: 'placed', label: 'Placed', icon: 'receipt-outline', activeIcon: 'receipt', desc: 'Order received' },
  { id: 'confirmed', label: 'Confirmed', icon: 'checkmark-circle-outline', activeIcon: 'checkmark-circle', desc: 'Accepted by store' },
  { id: 'preparing', label: 'Preparing', icon: 'cube-outline', activeIcon: 'cube', desc: 'Packing your order' },
  { id: 'transit', label: 'In Transit', icon: 'bicycle-outline', activeIcon: 'bicycle', desc: 'Rider on the way' },
  { id: 'delivered', label: 'Delivered', icon: 'flag-outline', activeIcon: 'flag', desc: 'Delivery complete' },
];

export const getActiveStepIndex = (status) => {
  const s = String(status || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
  
  // Step 4: Delivered / Completed
  if (['completed', 'delivered', 'received'].includes(s)) return 4;
  
  // Step 3: In Transit / Out for Delivery / On the way
  if (['outfordelivery', 'intransit', 'transit', 'ontheway', 'delivering', 'dispatched'].includes(s)) return 3;
  
  // Step 2: Preparing / Packing / Rider Picked Up / Ready
  if (['processing', 'preparing', 'packing', 'riderpickedup', 'riderpickeduptheorder', 'pickedup', 'ready', 'readyforpickup'].includes(s)) return 2;
  
  // Step 1: Confirmed / Accepted / Assigned
  if (['confirmed', 'accepted', 'assigned', 'orderconfirmed'].includes(s)) return 1;
  
  // Step 0: Placed / Pending
  return 0;
};

export default function OrderDeliveryTimeline({ status = 'Pending', isRiderOnline = false, etaMinutes = null, distanceKm = null }) {
  const activeIndex = getActiveStepIndex(status);
  const currentStep = TIMELINE_STEPS[activeIndex] || TIMELINE_STEPS[0];

  return (
    <View style={styles.cardContainer}>
      {/* Active Stage Header Badge */}
      <View style={styles.headerBadgeRow}>
        <View style={styles.stageTitleGroup}>
          <Text style={styles.stageTitleText}>{currentStep.label}</Text>
          <Text style={styles.stageDescText}>{currentStep.desc}</Text>
        </View>

        {activeIndex === 3 && (
          <View style={styles.liveIndicatorBadge}>
            <View style={[styles.pulsingDot, { backgroundColor: isRiderOnline ? '#10B981' : '#F59E0B' }]} />
            <Text style={[styles.liveIndicatorText, { color: isRiderOnline ? '#10B981' : '#F59E0B' }]}>
              {isRiderOnline ? 'LIVE RIDER' : 'RIDER EN ROUTE'}
            </Text>
          </View>
        )}
      </View>

      {/* 5-Step Stepper Bar */}
      <View style={styles.stepperContainer}>
        {TIMELINE_STEPS.map((step, idx) => {
          const isDone = idx < activeIndex;
          const isActive = idx === activeIndex;
          const isUpcoming = idx > activeIndex;

          return (
            <View key={step.id} style={styles.stepWrapper}>
              {/* Connector line before step (except first) */}
              {idx > 0 && (
                <View
                  style={[
                    styles.connectorLine,
                    { backgroundColor: idx <= activeIndex ? '#0033A0' : '#E5E7EB' }
                  ]}
                />
              )}

              {/* Step Circle */}
              <View
                style={[
                  styles.circleBase,
                  isDone && styles.circleDone,
                  isActive && styles.circleActive,
                  isUpcoming && styles.circleUpcoming,
                ]}
              >
                {isDone ? (
                  <Ionicons name="checkmark" size={14} color="#fff" />
                ) : (
                  <Ionicons
                    name={isActive ? step.activeIcon : step.icon}
                    size={14}
                    color={isActive ? '#fff' : '#9CA3AF'}
                  />
                )}
              </View>

              {/* Step Label */}
              <Text
                style={[
                  styles.stepLabelText,
                  isActive && styles.stepLabelActive,
                  isDone && styles.stepLabelDone,
                ]}
                numberOfLines={1}
              >
                {step.label}
              </Text>
            </View>
          );
        })}
      </View>

      {/* ETA & Distance Metric Banner for Active Deliveries */}
      {activeIndex >= 2 && activeIndex < 4 && (etaMinutes !== null || distanceKm !== null) && (
        <View style={styles.etaBanner}>
          <Ionicons name="time" size={18} color="#0033A0" />
          <Text style={styles.etaBannerText}>
            Estimated Arrival: <Text style={styles.boldText}>{etaMinutes ? `${etaMinutes} mins` : 'Calculating...'}</Text>
            {distanceKm ? ` (${distanceKm} km away)` : ''}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  headerBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  stageTitleGroup: {
    flex: 1,
  },
  stageTitleText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0033A0',
  },
  stageDescText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  liveIndicatorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 6,
  },
  pulsingDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  liveIndicatorText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  stepWrapper: {
    flex: 1,
    alignItems: 'center',
    position: 'relative',
  },
  connectorLine: {
    position: 'absolute',
    top: 14,
    left: '-50%',
    right: '50%',
    height: 3,
    zIndex: 0,
  },
  circleBase: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  circleDone: {
    backgroundColor: '#0033A0',
  },
  circleActive: {
    backgroundColor: '#0033A0',
    borderWidth: 3,
    borderColor: '#93C5FD',
    shadowColor: '#0033A0',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  circleUpcoming: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
  },
  stepLabelText: {
    fontSize: 10,
    color: '#9CA3AF',
    fontWeight: '500',
    marginTop: 6,
    textAlign: 'center',
  },
  stepLabelActive: {
    color: '#0033A0',
    fontWeight: '800',
  },
  stepLabelDone: {
    color: '#374151',
    fontWeight: '600',
  },
  etaBanner: {
    marginTop: 14,
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  etaBannerText: {
    fontSize: 13,
    color: '#1E40AF',
  },
  boldText: {
    fontWeight: '700',
  },
});
