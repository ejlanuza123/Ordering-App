// src/components/GPSNavigationModal.js
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Platform,
  Clipboard,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { navigationService } from '../services/navigationService';

export default function GPSNavigationModal({ visible, onClose, destination }) {
  if (!visible || !destination) return null;

  const { lat, lng, address, customerName, orderNumber } = destination;
  const hasCoords = Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) && Number(lat) !== 0;

  const handleOpenGoogle = () => {
    navigationService.openGoogleMaps({ lat, lng, address });
    onClose();
  };

  const handleOpenWaze = () => {
    navigationService.openWaze({ lat, lng, address });
    onClose();
  };

  const handleOpenApple = () => {
    navigationService.openAppleMaps({ lat, lng, address });
    onClose();
  };

  const handleCopyAddress = () => {
    if (address) {
      Clipboard.setString(address);
      Alert.alert('Copied', 'Delivery address copied to clipboard.');
    }
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.container}>
              {/* Header handle */}
              <View style={styles.handle} />

              <View style={styles.header}>
                <View style={styles.headerTitleRow}>
                  <Ionicons name="compass" size={22} color="#0033A0" />
                  <Text style={styles.headerTitle}>Choose GPS App</Text>
                </View>
                {orderNumber && (
                  <Text style={styles.headerOrder}>Order #{orderNumber}</Text>
                )}
              </View>

              {/* Destination Summary */}
              <View style={styles.destinationCard}>
                {customerName && (
                  <Text style={styles.customerName}>
                    <Ionicons name="person" size={14} color="#555" /> {customerName}
                  </Text>
                )}
                <Text style={styles.addressText} numberOfLines={2}>
                  {address || 'Destination coordinates set'}
                </Text>
                {hasCoords && (
                  <Text style={styles.coordsText}>
                    📍 {Number(lat).toFixed(5)}, {Number(lng).toFixed(5)}
                  </Text>
                )}
              </View>

              {/* Navigation Options */}
              <View style={styles.optionsList}>
                {/* Google Maps */}
                <TouchableOpacity
                  style={[styles.optionButton, { backgroundColor: '#4285F4' }]}
                  onPress={handleOpenGoogle}
                  activeOpacity={0.85}
                >
                  <Ionicons name="map" size={22} color="#FFFFFF" />
                  <View style={styles.optionTextContainer}>
                    <Text style={styles.optionTitle}>Google Maps</Text>
                    <Text style={styles.optionSubtitle}>Turn-by-turn driving directions</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
                </TouchableOpacity>

                {/* Waze */}
                <TouchableOpacity
                  style={[styles.optionButton, { backgroundColor: '#33CCFF' }]}
                  onPress={handleOpenWaze}
                  activeOpacity={0.85}
                >
                  <Ionicons name="navigate" size={22} color="#FFFFFF" />
                  <View style={styles.optionTextContainer}>
                    <Text style={styles.optionTitle}>Waze Navigation</Text>
                    <Text style={styles.optionSubtitle}>Live traffic & fastest route alerts</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
                </TouchableOpacity>

                {/* Apple Maps (iOS Only) */}
                {Platform.OS === 'ios' && (
                  <TouchableOpacity
                    style={[styles.optionButton, { backgroundColor: '#000000' }]}
                    onPress={handleOpenApple}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="logo-apple" size={22} color="#FFFFFF" />
                    <View style={styles.optionTextContainer}>
                      <Text style={styles.optionTitle}>Apple Maps</Text>
                      <Text style={styles.optionSubtitle}>iOS native navigation</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
                  </TouchableOpacity>
                )}

                {/* Copy Address */}
                <TouchableOpacity
                  style={styles.copyButton}
                  onPress={handleCopyAddress}
                  activeOpacity={0.8}
                >
                  <Ionicons name="copy-outline" size={18} color="#555" />
                  <Text style={styles.copyButtonText}>Copy Address Only</Text>
                </TouchableOpacity>
              </View>

              {/* Close Button */}
              <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 20,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  headerOrder: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0033A0',
    backgroundColor: '#0033A015',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  destinationCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  customerName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 4,
  },
  addressText: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  coordsText: {
    fontSize: 11,
    color: '#0033A0',
    fontWeight: '600',
    marginTop: 4,
  },
  optionsList: {
    gap: 10,
    marginBottom: 16,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  optionSubtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 1,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    gap: 6,
    marginTop: 4,
  },
  copyButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  cancelButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
  },
});
