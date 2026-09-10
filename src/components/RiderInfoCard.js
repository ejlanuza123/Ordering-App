// src/components/RiderInfoCard.js
import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

export default function RiderInfoCard({ delivery, onChatPress }) {
  const { colors, isDarkMode } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDarkMode), [colors, isDarkMode]);

  // If no delivery or no rider, show "Not assigned yet" message
  if (!delivery || !delivery.rider) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Rider Information</Text>
        <View style={styles.notAssignedContainer}>
          <Ionicons name="person-outline" size={40} color={colors.textSecondary} />
          <Text style={styles.notAssignedText}>No rider assigned yet</Text>
          <Text style={styles.notAssignedSubtext}>
            A rider will be assigned once your order is being processed
          </Text>
        </View>
      </View>
    );
  }

  const rider = delivery.rider;
  
  const getStatusColor = (status) => {
    switch(status) {
      case 'assigned': return isDarkMode ? '#3B82F6' : '#F59E0B';
      case 'accepted': return isDarkMode ? '#34D399' : '#10B981';
      case 'picked_up': return isDarkMode ? '#38BDF8' : colors.primary;
      case 'out_for_delivery': return isDarkMode ? '#E879F9' : colors.primary;
      case 'delivered': return isDarkMode ? '#34D399' : '#10B981';
      case 'failed': return isDarkMode ? '#F87171' : '#EF4444';
      default: return colors.textSecondary;
    }
  };

  const getStatusText = (status) => {
    switch(status) {
      case 'assigned': return 'Waiting for Acceptance';
      case 'accepted': return 'Accepted - Ready to Pick Up';
      case 'picked_up': return 'Picked Up';
      case 'out_for_delivery': return 'Out for Delivery';
      case 'delivered': return 'Delivered';
      case 'failed': return 'Failed';
      default: return status;
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Rider Information</Text>
      
      {/* Profile Picture */}
      <View style={styles.profileSection}>
        {rider.avatar_url ? (
          <Image
            source={{ uri: rider.avatar_url }}
            style={styles.profileImage}
          />
        ) : (
          <View style={styles.profileImagePlaceholder}>
            <Ionicons name="person" size={40} color={colors.textSecondary} />
          </View>
        )}
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{rider.full_name}</Text>
          {rider.rating && (
            <View style={styles.ratingContainer}>
              <Ionicons name="star" size={14} color="#F59E0B" />
              <Text style={styles.ratingText}>{rider.rating.toFixed(1)}</Text>
            </View>
          )}
        </View>
      </View>
      
      <View style={styles.divider} />
      
      <View style={styles.infoRow}>
        <Ionicons name="person" size={18} color={colors.textSecondary} />
        <View style={styles.infoContent}>
          <Text style={styles.label}>Name</Text>
          <Text style={styles.value}>{rider.full_name}</Text>
        </View>
      </View>
      
      {rider.phone_number && (
        <View style={styles.infoRow}>
          <Ionicons name="call" size={18} color={colors.textSecondary} />
          <View style={styles.infoContent}>
            <Text style={styles.label}>Contact</Text>
            <Text style={styles.value}>{rider.phone_number}</Text>
          </View>
        </View>
      )}
      
      <View style={styles.infoRow}>
        <Ionicons name="bicycle" size={18} color={colors.textSecondary} />
        <View style={styles.infoContent}>
          <Text style={styles.label}>Status</Text>
          <Text style={[styles.value, { color: getStatusColor(delivery.status) }]}>
            {getStatusText(delivery.status)}
          </Text>
        </View>
      </View>

      {delivery.picked_up_at && (
        <View style={styles.infoRow}>
          <Ionicons name="time" size={18} color={colors.textSecondary} />
          <View style={styles.infoContent}>
            <Text style={styles.label}>Picked Up</Text>
            <Text style={styles.value}>
              {new Date(delivery.picked_up_at).toLocaleString()}
            </Text>
          </View>
        </View>
      )}

      {delivery.delivered_at && (
        <View style={styles.infoRow}>
          <Ionicons name="checkmark-circle" size={18} color="#10B981" />
          <View style={styles.infoContent}>
            <Text style={styles.label}>Delivered</Text>
            <Text style={styles.value}>
              {new Date(delivery.delivered_at).toLocaleString()}
            </Text>
          </View>
        </View>
      )}

      <View style={styles.bottomActions}>
        {onChatPress && (
          <TouchableOpacity
            style={[styles.callButton, styles.chatButton, styles.actionButtonFullWidth]}
            onPress={onChatPress}
          >
            <Ionicons name="chatbubbles" size={18} color="#fff" />
            <Text style={styles.callButtonText}>Chat Rider</Text>
          </TouchableOpacity>
        )}

        {rider.phone_number && (
          <TouchableOpacity 
            style={[styles.callButton, styles.actionButtonFullWidth]}
            onPress={() => Linking.openURL(`tel:${rider.phone_number}`)}
          >
            <Ionicons name="call" size={18} color="#fff" />
            <Text style={styles.callButtonText}>Call Rider</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const createStyles = (colors, isDarkMode) => StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: isDarkMode ? 0.3 : 0.05,
    shadowRadius: 4,
    borderWidth: isDarkMode ? 1 : 0,
    borderColor: colors.border,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileImage: {
    width: 88,
    height: 88,
    borderRadius: 44,
    marginRight: 16,
    backgroundColor: isDarkMode ? colors.surfaceElevated : '#f0f0f0',
  },
  profileImagePlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 44,
    marginRight: 16,
    backgroundColor: isDarkMode ? colors.surfaceElevated : '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F59E0B',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 12,
  },
  infoContent: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  value: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    padding: 12,
    borderRadius: 10,
    marginTop: 8,
    gap: 8,
  },
  callButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  chatButton: {
    backgroundColor: colors.primary,
  },
  bottomActions: {
    flexDirection: 'column',
    marginTop: 12,
    gap: 10,
  },
  actionButtonFullWidth: {
    width: '100%',
  },
  notAssignedContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  notAssignedText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 8,
  },
  notAssignedSubtext: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
});