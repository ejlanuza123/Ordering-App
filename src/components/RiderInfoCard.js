// src/components/RiderInfoCard.js
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function RiderInfoCard({ delivery }) {
  // If no delivery or no rider, show "Not assigned yet" message
  if (!delivery || !delivery.rider) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Rider Information</Text>
        <View style={styles.notAssignedContainer}>
          <Ionicons name="person-outline" size={40} color="#ccc" />
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
      case 'assigned': return '#F59E0B';
      case 'accepted': return '#10B981';
      case 'picked_up': return '#0033A0';
      case 'delivered': return '#10B981';
      case 'failed': return '#EF4444';
      default: return '#666';
    }
  };

  const getStatusText = (status) => {
    switch(status) {
      case 'assigned': return 'Ready to Pick Up';
      case 'accepted': return 'Accepted by Rider';
      case 'picked_up': return 'Out for Delivery';
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
            <Ionicons name="person" size={40} color="#999" />
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
        <Ionicons name="person" size={18} color="#666" />
        <View style={styles.infoContent}>
          <Text style={styles.label}>Name</Text>
          <Text style={styles.value}>{rider.full_name}</Text>
        </View>
      </View>
      
      {rider.phone_number && (
        <View style={styles.infoRow}>
          <Ionicons name="call" size={18} color="#666" />
          <View style={styles.infoContent}>
            <Text style={styles.label}>Contact</Text>
            <Text style={styles.value}>{rider.phone_number}</Text>
          </View>
        </View>
      )}
      
      <View style={styles.infoRow}>
        <Ionicons name="bicycle" size={18} color="#666" />
        <View style={styles.infoContent}>
          <Text style={styles.label}>Status</Text>
          <Text style={[styles.value, { color: getStatusColor(delivery.status) }]}>
            {getStatusText(delivery.status)}
          </Text>
        </View>
      </View>

      {delivery.picked_up_at && (
        <View style={styles.infoRow}>
          <Ionicons name="time" size={18} color="#666" />
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
        {rider.phone_number && (
          <TouchableOpacity 
            style={styles.callButton}
            onPress={() => Linking.openURL(`tel:${rider.phone_number}`)}
          >
            <Ionicons name="call" size={18} color="#fff" />
            <Text style={styles.callButtonText}>Call Rider</Text>
          </TouchableOpacity>
        )}

        {rider.address_lat && rider.address_lng && (
          <TouchableOpacity
            style={[styles.callButton, { backgroundColor: '#F59E0B' }]}
            onPress={() => {
              const url = `https://www.google.com/maps/dir/?api=1&destination=${rider.address_lat},${rider.address_lng}`;
              Linking.openURL(url);
            }}
          >
            <Ionicons name="navigate" size={18} color="#fff" />
            <Text style={styles.callButtonText}>Track Rider</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
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
    backgroundColor: '#f0f0f0',
  },
  profileImagePlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 44,
    marginRight: 16,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
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
    backgroundColor: '#E5E7EB',
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
    color: '#999',
    marginBottom: 2,
  },
  value: {
    fontSize: 14,
    color: '#333',
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
  bottomActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 8,
  },
  // New styles for empty state
  notAssignedContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  notAssignedText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginTop: 8,
  },
  notAssignedSubtext: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 4,
  },
});