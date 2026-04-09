// src/screens/rider/RiderProfileScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Switch
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useRiderRatings } from '../../context/RiderRatingContext';
import CustomAlertModal from '../../components/CustomAlertModal';
import { useFocusEffect } from '@react-navigation/native';
import Avatar from '../../components/Avatar';

export default function RiderProfileScreen({ navigation }) {
  const { profile, signOut } = useAuth();
  const { getRiderStats } = useRiderRatings();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [formData, setFormData] = useState({
    full_name: '',
    phone_number: '',
    address: '',
    vehicle_type: '',
    vehicle_plate: ''
  });
  const [stats, setStats] = useState({
    totalDeliveries: 0,
    completedDeliveries: 0,
    failedDeliveries: 0,
    totalEarnings: 0,
    rating: 4.8
  });
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [togglingNotifications, setTogglingNotifications] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ type: 'success', title: '', message: '' });

  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        phone_number: profile.phone_number || '',
        address: profile.address || '',
        vehicle_type: profile.vehicle_type || '',
        vehicle_plate: profile.vehicle_plate || ''
      });
      setAvatarUrl(profile.avatar_url || '');
      // Load notification preference
      setNotificationsEnabled(profile.notifications_enabled !== false); // Default to true
    }
    fetchRiderStats();
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      const fetchLatestAvatar = async () => {
        if (!profile?.id) return;
        
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('avatar_url')
            .eq('id', profile.id)
            .single();
            
          if (!error && data?.avatar_url) {
            setAvatarUrl(data.avatar_url);
          }
        } catch (error) {
          console.error('Error fetching latest avatar:', error);
        }
      };

      fetchLatestAvatar();
    }, [profile?.id])
  );

  const fetchRiderStats = async () => {
    try {
      const { data, error } = await supabase
        .from('deliveries')
        .select(`
          id,
          status,
          orders:order_id (
            delivery_fee
          )
        `)
        .eq('rider_id', profile.id);

      if (error) throw error;

      const completed = data?.filter(d => d.status === 'delivered') || [];
      const failed = data?.filter(d => d.status === 'failed') || [];
      // Calculate earnings based on delivery fees from completed deliveries
      const earnings = completed.reduce((sum, d) => 
        sum + (parseFloat(d.orders?.delivery_fee) || 0), 0
      );

      // Fetch rider rating from database
      const riderStatsData = await getRiderStats(profile.id);
      const riderRating = riderStatsData?.averageRating || 0;

      setStats({
        totalDeliveries: data?.length || 0,
        completedDeliveries: completed.length,
        failedDeliveries: failed.length,
        totalEarnings: earnings,
        rating: riderRating
      });
    } catch (error) {
      console.error('Error fetching stats:', error.message);
    }
  };

  const handleNotificationsToggle = async (newValue) => {
    try {
      setTogglingNotifications(true);
      setNotificationsEnabled(newValue);

      // Save notification preference to database
      const { error } = await supabase
        .from('profiles')
        .update({
          notifications_enabled: newValue,
          updated_at: new Date().toISOString()
        })
        .eq('id', profile.id);

      if (error) throw error;

      setAlertConfig({
        type: 'success',
        title: 'Success',
        message: newValue ? 'Notifications enabled' : 'Notifications disabled'
      });
      setShowAlert(true);
    } catch (error) {
      console.error('Error toggling notifications:', error);
      // Revert the toggle on error
      setNotificationsEnabled(!newValue);
      setAlertConfig({
        type: 'error',
        title: 'Error',
        message: 'Failed to update notification settings'
      });
      setShowAlert(true);
    } finally {
      setTogglingNotifications(false);
    }
  };

  const handleSave = async () => {
    if (!formData.full_name.trim()) {
      setAlertConfig({
        type: 'warning',
        title: 'Error',
        message: 'Please enter your full name'
      });
      setShowAlert(true);
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name.trim(),
          phone_number: formData.phone_number.trim(),
          address: formData.address.trim(),
          vehicle_type: formData.vehicle_type.trim(),
          vehicle_plate: formData.vehicle_plate.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', profile.id);

      if (error) throw error;

      setAlertConfig({
        type: 'success',
        title: 'Success',
        message: 'Profile updated successfully'
      });
      setShowAlert(true);
      setEditing(false);
    } catch (error) {
      setAlertConfig({
        type: 'error',
        title: 'Error',
        message: error.message
      });
      setShowAlert(true);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    setShowLogoutModal(false);
    await signOut();
  };

  const StatCard = ({ label, value, icon, color }) => (
    <View style={[styles.statCard, { backgroundColor: color + '10' }]}>
      <Ionicons name={icon} size={24} color={color} />
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#0033A0" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Profile</Text>
        <TouchableOpacity onPress={() => setEditing(!editing)} style={styles.editButton}>
          <Ionicons name={editing ? 'close' : 'create-outline'} size={24} color="#0033A0" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}>
        
        {/* Profile Header */}
        <View style={styles.profileHeader}>
  <Avatar 
            size={70}
            avatarUrl={avatarUrl}
            onUploadSuccess={async (url) => {
              setAvatarUrl(url);
              // Refetch full profile data for realtime update
              if (profile?.id) {
                const { data, error } = await supabase
                  .from('profiles')
                  .select('*')
                  .eq('id', profile.id)
                  .single();
                if (!error && data) {
                  setFormData({
                    full_name: data.full_name || '',
                    phone_number: data.phone_number || '',
                    address: data.address || '',
                    vehicle_type: data.vehicle_type || '',
                    vehicle_plate: data.vehicle_plate || ''
                  });
                  setAvatarUrl(data.avatar_url || null);
                }
              }
            }}
            editable={true}
          />
          {!editing ? (
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{formData.full_name || 'Rider'}</Text>
              <Text style={styles.profileRole}>Delivery Rider</Text>
              <View style={styles.ratingBadge}>
                <Ionicons name="star" size={16} color="#FFD700" />
                <Text style={styles.ratingText}>{stats.rating}</Text>
              </View>
            </View>
          ) : (
            <Text style={styles.editModeText}>Edit Mode</Text>
          )}
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <StatCard 
            label="Total" 
            value={stats.totalDeliveries} 
            icon="bicycle" 
            color="#0033A0" 
          />
          <StatCard 
            label="Completed" 
            value={stats.completedDeliveries} 
            icon="checkmark-circle" 
            color="#10B981" 
          />
          <StatCard 
            label="Failed" 
            value={stats.failedDeliveries} 
            icon="close-circle" 
            color="#EF4444" 
          />
          <StatCard 
            label="Earnings" 
            value={`₱${stats.totalEarnings}`} 
            icon="wallet" 
            color="#F59E0B" 
          />
        </View>

        {/* Personal Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Full Name</Text>
            {editing ? (
              <TextInput
                style={styles.input}
                value={formData.full_name}
                onChangeText={(text) => setFormData({ ...formData, full_name: text })}
                placeholder="Enter your full name"
              />
            ) : (
              <Text style={styles.value}>{formData.full_name || 'Not set'}</Text>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone Number</Text>
            {editing ? (
              <TextInput
                style={styles.input}
                value={formData.phone_number}
                onChangeText={(text) => setFormData({ ...formData, phone_number: text })}
                placeholder="Enter phone number"
                keyboardType="phone-pad"
              />
            ) : (
              <Text style={styles.value}>{formData.phone_number || 'Not set'}</Text>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Address</Text>
            {editing ? (
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.address}
                onChangeText={(text) => setFormData({ ...formData, address: text })}
                placeholder="Enter your address"
                multiline
                numberOfLines={2}
              />
            ) : (
              <Text style={styles.value}>{formData.address || 'Not set'}</Text>
            )}
          </View>
        </View>

        {/* Vehicle Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vehicle Information</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Vehicle Type</Text>
            {editing ? (
              <TextInput
                style={styles.input}
                value={formData.vehicle_type}
                onChangeText={(text) => setFormData({ ...formData, vehicle_type: text })}
                placeholder="e.g. Motorcycle, Scooter"
              />
            ) : (
              <Text style={styles.value}>{formData.vehicle_type || 'Not set'}</Text>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Plate Number</Text>
            {editing ? (
              <TextInput
                style={styles.input}
                value={formData.vehicle_plate}
                onChangeText={(text) => setFormData({ ...formData, vehicle_plate: text })}
                placeholder="Enter plate number"
                autoCapitalize="characters"
              />
            ) : (
              <Text style={styles.value}>{formData.vehicle_plate || 'Not set'}</Text>
            )}
          </View>
        </View>

        {/* Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          
          <View style={styles.preferenceItem}>
            <View style={styles.preferenceInfo}>
              <Ionicons name="notifications" size={22} color="#0033A0" />
              <Text style={styles.preferenceText}>Push Notifications</Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleNotificationsToggle}
              disabled={togglingNotifications}
              trackColor={{ false: '#e9ecef', true: '#0033A0' }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Help */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Help</Text>

          <TouchableOpacity
            style={styles.helpAction}
            onPress={() => navigation.navigate('HelpCenter', { role: 'rider' })}
          >
            <View style={styles.helpActionLeft}>
              <View style={styles.helpIconWrap}>
                <Ionicons name="book-outline" size={20} color="#0033A0" />
              </View>
              <View>
                <Text style={styles.helpActionTitle}>User Manual</Text>
                <Text style={styles.helpActionSubtitle}>Open rider workflow and troubleshooting guide</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.helpAction}
            onPress={() => navigation.navigate('TermsPrivacy')}
          >
            <View style={styles.helpActionLeft}>
              <View style={styles.helpIconWrap}>
                <Ionicons name="document-text-outline" size={20} color="#0033A0" />
              </View>
              <View>
                <Text style={styles.helpActionTitle}>Terms & Privacy</Text>
                <Text style={styles.helpActionSubtitle}>Review legal terms, privacy, and data handling policy</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {/* Edit/Save Buttons */}
        {editing && (
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Sign Out Button */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={() => setShowLogoutModal(true)}
        >
          <Ionicons name="log-out" size={20} color="#ED2939" />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Logout Modal */}
      <CustomAlertModal
        visible={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        type="confirm"
        title="Sign Out"
        message="Are you sure you want to log out?"
        confirmText="Log Out"
        cancelText="Cancel"
        showCancelButton={true}
        onConfirm={handleLogout}
      />

      {/* Success/Error Alert */}
      <CustomAlertModal
        visible={showAlert}
        onClose={() => setShowAlert(false)}
        type={alertConfig.type}
        title={alertConfig.title}
        message={alertConfig.message}
        confirmText="OK"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f4ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f4ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0033A0',
  },
  scrollContent: {
    padding: 16,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#0033A0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 28,
    color: '#fff',
    fontWeight: 'bold',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  profileRole: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  editModeText: {
    fontSize: 16,
    color: '#0033A0',
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statCard: {
    width: '48%',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
    fontWeight: '500',
  },
  value: {
    fontSize: 16,
    color: '#333',
    paddingVertical: 8,
  },
  input: {
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: '#333',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  textArea: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  preferenceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  preferenceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  preferenceText: {
    fontSize: 16,
    color: '#333',
  },
  helpAction: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  helpActionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    paddingRight: 8,
  },
  helpIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f4ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  helpActionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 2,
  },
  helpActionSubtitle: {
    fontSize: 12,
    color: '#64748b',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0033A0',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  saveButtonDisabled: {
    backgroundColor: '#8da2c0',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ED2939',
  },
  logoutText: {
    color: '#ED2939',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});