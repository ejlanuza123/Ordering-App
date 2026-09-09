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
import { useTheme } from '../../context/ThemeContext';
import { useRiderRatings } from '../../context/RiderRatingContext';
import { formatCurrency } from '../../utils/formatters';
import CustomAlertModal from '../../components/CustomAlertModal';
import { useFocusEffect } from '@react-navigation/native';
import Avatar from '../../components/Avatar';
import { riderPresenceService } from '../../services/riderPresenceService';
import { locationTrackingService } from '../../services/locationTrackingService';

export default function RiderProfileScreen({ navigation }) {
  const { profile, signOut } = useAuth();
  const { isDarkMode, themeMode, toggleTheme, colors } = useTheme();
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
  const [onlineStatus, setOnlineStatus] = useState(true);
  const [togglingOnlineStatus, setTogglingOnlineStatus] = useState(false);
  const [batterySaverEnabled, setBatterySaverEnabled] = useState(true);
  const [togglingBatterySaver, setTogglingBatterySaver] = useState(false);

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
      setOnlineStatus(profile.is_online !== false);
    }
    locationTrackingService.isBatterySaverEnabled().then((enabled) => {
      setBatterySaverEnabled(enabled);
    });
    fetchRiderStats();
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      const fetchLatestProfileState = async () => {
        if (!profile?.id) return;
        
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('avatar_url, notifications_enabled, is_online')
            .eq('id', profile.id)
            .single();
            
          if (!error && data) {
            if (data.avatar_url) {
              setAvatarUrl(data.avatar_url);
            }
            if (typeof data.notifications_enabled === 'boolean') {
              setNotificationsEnabled(data.notifications_enabled);
            }
            if (typeof data.is_online === 'boolean') {
              setOnlineStatus(data.is_online);
            }
          }
        } catch (error) {
          console.error('Error fetching latest profile state:', error);
        }
      };

      fetchLatestProfileState();
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

  const handleOnlineStatusToggle = async (newValue) => {
    try {
      setTogglingOnlineStatus(true);
      setOnlineStatus(newValue);

      const { error } = await supabase
        .from('profiles')
        .update({
          is_online: newValue,
          last_seen: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', profile.id);

      if (error) throw error;

      riderPresenceService.setIntendedOnline(newValue);

      setAlertConfig({
        type: 'success',
        title: 'Success',
        message: newValue ? 'You are now online' : 'You are now offline'
      });
      setShowAlert(true);
    } catch (error) {
      console.error('Error toggling online status:', error);
      setOnlineStatus(!newValue);
      setAlertConfig({
        type: 'error',
        title: 'Error',
        message: 'Failed to update online status'
      });
      setShowAlert(true);
    } finally {
      setTogglingOnlineStatus(false);
    }
  };

  const handleBatterySaverToggle = async (newValue) => {
    try {
      setTogglingBatterySaver(true);
      setBatterySaverEnabled(newValue);
      await locationTrackingService.setBatterySaverEnabled(newValue);

      setAlertConfig({
        type: 'success',
        title: newValue ? 'Battery Saver Enabled' : 'Continuous Tracking Mode',
        message: newValue
          ? 'Adaptive GPS throttling is active. Stationary jitter is filtered and updates are throttled to save battery.'
          : 'Battery saver is off. Coordinates will be sent on every GPS reading (original continuous tracking, higher battery drain).'
      });
      setShowAlert(true);
    } catch (error) {
      console.error('Error toggling battery saver preference:', error);
      setBatterySaverEnabled(!newValue);
      setAlertConfig({
        type: 'error',
        title: 'Error',
        message: 'Failed to update battery saver preference'
      });
      setShowAlert(true);
    } finally {
      setTogglingBatterySaver(false);
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
    <View style={[styles.statCard, { backgroundColor: isDarkMode ? colors.surface : (color + '10'), borderColor: colors.border }]}>
      <Ionicons name={icon} size={24} color={color} />
      <Text style={[styles.statValue, { color: isDarkMode ? colors.textPrimary : color }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backButton, isDarkMode && { backgroundColor: colors.surfaceElevated }]}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>My Profile</Text>
        <TouchableOpacity onPress={() => setEditing(!editing)} style={[styles.editButton, isDarkMode && { backgroundColor: colors.surfaceElevated }]}>
          <Ionicons name={editing ? 'close' : 'create-outline'} size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]} style={{ backgroundColor: colors.background }}>
        
        {/* Profile Header */}
        <View style={[styles.profileHeader, { backgroundColor: colors.surface, borderColor: colors.border, shadowColor: colors.shadow }]}>
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
              <Text style={[styles.profileName, { color: colors.textPrimary }]}>{formData.full_name || 'Rider'}</Text>
              <Text style={[styles.profileRole, { color: colors.textSecondary }]}>Delivery Rider</Text>
              <View style={styles.ratingBadge}>
                <Ionicons name="star" size={16} color="#FFD700" />
                <Text style={[styles.ratingText, { color: colors.textSecondary }]}>{stats.rating}</Text>
              </View>
            </View>
          ) : (
            <Text style={[styles.editModeText, { color: colors.primary }]}>Edit Mode</Text>
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
            value={formatCurrency(stats.totalEarnings)} 
            icon="wallet" 
            color="#F59E0B" 
          />
        </View>

        {/* Personal Information */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Personal Information</Text>
          
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Full Name</Text>
            {editing ? (
              <TextInput
                style={[styles.input, { backgroundColor: isDarkMode ? colors.surfaceElevated : '#f8f9fa', borderColor: colors.border, color: colors.textPrimary }]}
                value={formData.full_name}
                onChangeText={(text) => setFormData({ ...formData, full_name: text })}
                placeholder="Enter your full name"
                placeholderTextColor={colors.textMuted}
              />
            ) : (
              <Text style={[styles.value, { color: colors.textPrimary }]}>{formData.full_name || 'Not set'}</Text>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Phone Number</Text>
            {editing ? (
              <TextInput
                style={[styles.input, { backgroundColor: isDarkMode ? colors.surfaceElevated : '#f8f9fa', borderColor: colors.border, color: colors.textPrimary }]}
                value={formData.phone_number}
                onChangeText={(text) => setFormData({ ...formData, phone_number: text })}
                placeholder="Enter phone number"
                keyboardType="phone-pad"
                placeholderTextColor={colors.textMuted}
              />
            ) : (
              <Text style={[styles.value, { color: colors.textPrimary }]}>{formData.phone_number || 'Not set'}</Text>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Address</Text>
            {editing ? (
              <TextInput
                style={[styles.input, styles.textArea, { backgroundColor: isDarkMode ? colors.surfaceElevated : '#f8f9fa', borderColor: colors.border, color: colors.textPrimary }]}
                value={formData.address}
                onChangeText={(text) => setFormData({ ...formData, address: text })}
                placeholder="Enter your address"
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={2}
              />
            ) : (
              <Text style={[styles.value, { color: colors.textPrimary }]}>{formData.address || 'Not set'}</Text>
            )}
          </View>
        </View>

        {/* Vehicle Information */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Vehicle Information</Text>
          
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Vehicle Type</Text>
            {editing ? (
              <TextInput
                style={[styles.input, { backgroundColor: isDarkMode ? colors.surfaceElevated : '#f8f9fa', borderColor: colors.border, color: colors.textPrimary }]}
                value={formData.vehicle_type}
                onChangeText={(text) => setFormData({ ...formData, vehicle_type: text })}
                placeholder="e.g. Motorcycle, Scooter"
                placeholderTextColor={colors.textMuted}
              />
            ) : (
              <Text style={[styles.value, { color: colors.textPrimary }]}>{formData.vehicle_type || 'Not set'}</Text>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Plate Number</Text>
            {editing ? (
              <TextInput
                style={[styles.input, { backgroundColor: isDarkMode ? colors.surfaceElevated : '#f8f9fa', borderColor: colors.border, color: colors.textPrimary }]}
                value={formData.vehicle_plate}
                onChangeText={(text) => setFormData({ ...formData, vehicle_plate: text })}
                placeholder="Enter plate number"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="characters"
              />
            ) : (
              <Text style={[styles.value, { color: colors.textPrimary }]}>{formData.vehicle_plate || 'Not set'}</Text>
            )}
          </View>
        </View>

        {/* Preferences */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Preferences</Text>
          
          <View style={[
            styles.preferenceItem,
            styles.onlinePreferenceItem,
            isDarkMode && {
              backgroundColor: onlineStatus ? 'rgba(16, 185, 129, 0.15)' : colors.surfaceElevated,
              borderColor: onlineStatus ? 'rgba(16, 185, 129, 0.4)' : colors.border,
            }
          ]}>
            <View style={styles.preferenceInfo}>
              <View style={[styles.preferenceIconWrap, onlineStatus ? styles.preferenceIconOnline : styles.preferenceIconOffline, isDarkMode && { backgroundColor: onlineStatus ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)', borderColor: onlineStatus ? '#10B981' : '#EF4444' }]}>
                <Ionicons name="radio-button-on" size={18} color={onlineStatus ? '#10B981' : '#EF4444'} />
              </View>
              <View>
                <Text style={[styles.preferenceText, { color: colors.textPrimary }]}>Online Status</Text>
                <Text style={[styles.preferenceSubtext, { color: colors.textSecondary }]}>Allow dispatch to mark you as available for deliveries</Text>
              </View>
            </View>
            <Switch
              value={onlineStatus}
              onValueChange={handleOnlineStatusToggle}
              disabled={togglingOnlineStatus}
              trackColor={{ false: isDarkMode ? '#334155' : '#d1d5db', true: '#10B981' }}
              thumbColor="#fff"
            />
          </View>

          <View style={[styles.preferenceItem, isDarkMode && { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            <View style={styles.preferenceInfo}>
              <View style={[styles.preferenceIconWrap, isDarkMode && { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="notifications" size={18} color={colors.primary} />
              </View>
              <View>
                <Text style={[styles.preferenceText, { color: colors.textPrimary }]}>Push Notifications</Text>
                <Text style={[styles.preferenceSubtext, { color: colors.textSecondary }]}>Receive delivery and app alerts</Text>
              </View>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleNotificationsToggle}
              disabled={togglingNotifications}
              trackColor={{ false: isDarkMode ? '#334155' : '#d1d5db', true: colors.primary }}
              thumbColor="#fff"
            />
          </View>

          <View style={[styles.preferenceItem, isDarkMode && { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            <View style={styles.preferenceInfo}>
              <View style={[styles.preferenceIconWrap, batterySaverEnabled ? styles.preferenceIconOnline : null, isDarkMode && { backgroundColor: batterySaverEnabled ? 'rgba(16, 185, 129, 0.2)' : colors.surface, borderColor: batterySaverEnabled ? '#10B981' : colors.border }]}>
                <Ionicons
                  name={batterySaverEnabled ? "battery-charging" : "battery-half"}
                  size={18}
                  color={batterySaverEnabled ? "#10B981" : "#F59E0B"}
                />
              </View>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={[styles.preferenceText, { color: colors.textPrimary }]}>Battery Saver (Adaptive GPS)</Text>
                <Text style={[styles.preferenceSubtext, { color: colors.textSecondary }]}>
                  {batterySaverEnabled
                    ? 'Throttles stationary GPS updates and caches active delivery queries to save battery'
                    : 'Continuous mode: Sends location on every reading (original high battery drain)'}
                </Text>
              </View>
            </View>
            <Switch
              value={batterySaverEnabled}
              onValueChange={handleBatterySaverToggle}
              disabled={togglingBatterySaver}
              trackColor={{ false: isDarkMode ? '#334155' : '#d1d5db', true: '#10B981' }}
              thumbColor="#fff"
            />
          </View>

          <View style={[styles.preferenceItem, isDarkMode && { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            <View style={styles.preferenceInfo}>
              <View style={[styles.preferenceIconWrap, isDarkMode ? styles.preferenceIconOnline : null, isDarkMode && { backgroundColor: 'rgba(96, 165, 250, 0.2)', borderColor: '#60A5FA' }]}>
                <Ionicons
                  name={isDarkMode ? "moon" : "sunny"}
                  size={18}
                  color={isDarkMode ? "#60A5FA" : "#F59E0B"}
                />
              </View>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={[styles.preferenceText, { color: colors.textPrimary }]}>Dark Mode</Text>
                <Text style={[styles.preferenceSubtext, { color: colors.textSecondary }]}>
                  {themeMode === 'system'
                    ? `System auto (${isDarkMode ? 'Dark' : 'Light'})`
                    : isDarkMode ? 'Dark theme active' : 'Light theme active'}
                </Text>
              </View>
            </View>
            <Switch
              value={isDarkMode}
              onValueChange={toggleTheme}
              trackColor={{ false: isDarkMode ? '#334155' : '#d1d5db', true: colors.primary }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Help */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Help</Text>

          <TouchableOpacity
            style={[styles.helpAction, { backgroundColor: isDarkMode ? colors.surfaceElevated : '#f8f9fa', borderColor: colors.border }]}
            onPress={() => navigation.navigate('HelpCenter', { role: 'rider' })}
          >
            <View style={styles.helpActionLeft}>
              <View style={[styles.helpIconWrap, isDarkMode && { backgroundColor: colors.surface }]}>
                <Ionicons name="book-outline" size={20} color={colors.primary} />
              </View>
              <View>
                <Text style={[styles.helpActionTitle, { color: colors.textPrimary }]}>User Manual</Text>
                <Text style={[styles.helpActionSubtitle, { color: colors.textSecondary }]}>Open rider workflow and troubleshooting guide</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.helpAction, { backgroundColor: isDarkMode ? colors.surfaceElevated : '#f8f9fa', borderColor: colors.border }]}
            onPress={() => navigation.navigate('TermsPrivacy')}
          >
            <View style={styles.helpActionLeft}>
              <View style={[styles.helpIconWrap, isDarkMode && { backgroundColor: colors.surface }]}>
                <Ionicons name="document-text-outline" size={20} color={colors.primary} />
              </View>
              <View>
                <Text style={[styles.helpActionTitle, { color: colors.textPrimary }]}>Terms & Privacy</Text>
                <Text style={[styles.helpActionSubtitle, { color: colors.textSecondary }]}>Review legal terms, privacy, and data handling policy</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Edit/Save Buttons */}
        {editing && (
          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: colors.primary }, saving && styles.saveButtonDisabled]}
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
          style={[styles.logoutButton, { backgroundColor: colors.surface, borderColor: '#ED2939' }]}
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
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f8fafc',
    marginBottom: 12,
  },
  onlinePreferenceItem: {
    backgroundColor: '#f7fff9',
    borderColor: '#d1fae5',
  },
  preferenceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    paddingRight: 12,
  },
  preferenceIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  preferenceIconOnline: {
    backgroundColor: '#ecfdf5',
    borderColor: '#bbf7d0',
  },
  preferenceIconOffline: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  preferenceText: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '600',
  },
  preferenceSubtext: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
    maxWidth: 240,
    lineHeight: 16,
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
