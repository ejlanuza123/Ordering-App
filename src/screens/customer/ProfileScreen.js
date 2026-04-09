// src/screens/customer/ProfileScreen.js
import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  ActivityIndicator,
  ScrollView,
  StatusBar,
  Switch,
  Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import OpenStreetMapPicker from '../../components/OpenStreetMapPicker';
import { getAddressFromCurrentLocation } from '../../utils/location';
import CustomAlertModal from '../../components/CustomAlertModal';
import Avatar from '../../components/Avatar';

export default function ProfileScreen({ navigation }) {
  const { user, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [mapModalVisible, setMapModalVisible] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('');

  // Form State
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [addressLat, setAddressLat] = useState(null);
  const [addressLng, setAddressLng] = useState(null);
  const [notifications, setNotifications] = useState(true);

  // User stats
  const [orderCount, setOrderCount] = useState(0);
  const [totalSpent, setTotalSpent] = useState(0);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
  });

  // coordinates of saved address (optional) — already declared earlier
  
  // alertConfig was initialized above with empty object; leave as-is

  // 1. Fetch Profile Data and Stats
  const fetchProfileData = async () => {
    try {
      if (!user) return;

      // Fetch profile data
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;

      if (profileData) {
        setFullName(profileData.full_name || '');
        setPhone(profileData.phone_number || '');
        setAddress(profileData.address || '');
        if (profileData.address_lat != null) setAddressLat(profileData.address_lat);
        if (profileData.address_lng != null) setAddressLng(profileData.address_lng);
        setAvatarUrl(profileData.avatar_url || '');
        setNotifications(profileData.notifications_enabled !== false);
      }

      // Fetch user stats
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('id, total_amount, status')
        .eq('user_id', user.id);

      if (!ordersError && ordersData) {
        setOrderCount(ordersData.length);
        
        const spent = ordersData
          .filter(order => order.status === 'Completed')
          .reduce((sum, order) => sum + parseFloat(order.total_amount), 0);
        setTotalSpent(spent);
      }

    } catch (error) {
      console.error('Error fetching profile:', error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfileData();
  }, [user]);

  const handleNotificationsToggle = async (value) => {
    setNotifications(value);

    if (!user?.id) return;

    setSavingNotifications(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          notifications_enabled: value,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;
    } catch (error) {
      setNotifications(!value);
      setAlertConfig({
        type: 'error',
        title: 'Error',
        message: 'Failed to update notification setting.'
      });
      setShowAlert(true);
    } finally {
      setSavingNotifications(false);
    }
  };

  // 2. Handle Update (Save Changes)
  const handleSave = async () => {
    if (!fullName.trim()) {
      setAlertConfig({
        type: 'warning',
        title: 'Error',
        message: 'Please enter your full name.'
      });
      setShowAlert(true);
      return;
    }

    // unique phone check
    if (phone.trim()) {
      try {
        const { data: existing, error: phoneErr } = await supabase
          .from('profiles')
          .select('id')
          .eq('phone_number', phone.trim())
          .single();

        if (!phoneErr && existing && existing.id !== user.id) {
          setAlertConfig({
            type: 'error',
            title: 'Duplicate Phone',
            message: 'This phone number is already used by another account.'
          });
          setShowAlert(true);
          return;
        }
      } catch (e) {
        // ignore lookup errors and proceed with normal save, server will still reject if constraint fails
        console.warn('phone uniqueness check failed', e);
      }
    }

    setSaving(true);
    try {
      const updates = {
          full_name: fullName.trim(),
          phone_number: phone.trim(),
          address: address.trim(),
          notifications_enabled: notifications,
          updated_at: new Date().toISOString(),
      };
      if (addressLat != null) updates.address_lat = addressLat;
      if (addressLng != null) updates.address_lng = addressLng;

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (error) throw error;

      setAlertConfig({
        type: 'success',
        title: 'Success',
        message: 'Profile updated successfully!'
      });
      setShowAlert(true);
    } catch (error) {
      // handle unique constraint message
      let msg = error.message || 'Failed to update profile.';
      if (msg.includes('profiles_phone_number_key')) {
        msg = 'That phone number is already in use.';
      }
      setAlertConfig({
        type: 'error',
        title: 'Error',
        message: msg
      });
      setShowAlert(true);
    } finally {
      setSaving(false);
    }
  };

  // 3. Handle Logout
  const handleLogoutPress = () => {
    setShowLogoutModal(true);
  };
  
  const confirmLogout = async () => {
    setShowLogoutModal(false);
    await signOut();
  };

  // 4. Handle Account Deletion
  const handleDeletePress = () => {
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    setShowDeleteModal(false);
    try {
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', user.id);

      if (profileError) throw profileError;

      await signOut();
    } catch (error) {
      setAlertConfig({
        type: 'error',
        title: 'Error',
        message: 'Failed to delete account. Please contact support.'
      });
      setShowAlert(true);
    }
  };

  // 5. Location Functions
  const useCurrentLocation = async () => {
    setIsGettingLocation(true);
    try {
      const locationData = await getAddressFromCurrentLocation();
      if (locationData && locationData.address) {
        setAddress(locationData.address);
        if (locationData.coords) {
          setAddressLat(locationData.coords.latitude);
          setAddressLng(locationData.coords.longitude);
        }
      }
    } catch (error) {
      console.error('Error getting location:', error);
      setAlertConfig({
        type: 'error',
        title: 'Error',
        message: 'Could not get your current location'
      });
      setShowAlert(true);
    } finally {
      setIsGettingLocation(false);
    }
  };

  const handleMapAddressSelected = (location) => {
    setAddress(location.address);
    // picker may send { latitude, longitude } or { lat, lng }
    const latVal = location.lat != null ? location.lat : location.latitude;
    const lngVal = location.lng != null ? location.lng : location.longitude;
    if (latVal != null && lngVal != null) {
      setAddressLat(latVal);
      setAddressLng(lngVal);
    }
    setMapModalVisible(false);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0033A0" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
        
        {/* Fixed Header - NOT SCROLLABLE */}
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="#0033A0" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Profile</Text>
          <TouchableOpacity 
            onPress={() => setShowSettingsModal(true)}
            style={styles.settingsButton}
          >
            <Ionicons name="settings-outline" size={24} color="#0033A0" />
          </TouchableOpacity>
        </View>

        {/* Scrollable Content */}
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Profile Card */}
          <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <Avatar 
              size={80}
              avatarUrl={avatarUrl}
              onUploadSuccess={async (url) => {
                setAvatarUrl(url);
                await fetchProfileData();
              }}
            />
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{fullName || 'User'}</Text>
              <Text style={styles.profileEmail}>{user.email}</Text>
            </View>
          </View>

            {/* User Stats */}
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{orderCount}</Text>
                <Text style={styles.statLabel}>Orders</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>₱{totalSpent.toFixed(0)}</Text>
                <Text style={styles.statLabel}>Total Spent</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Ionicons name="star" size={20} color="#F59E0B" />
                <Text style={styles.statLabel}>Loyal Customer</Text>
              </View>
            </View>
          </View>

          {/* Personal Information Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Personal Information</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Enter your full name"
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="0912 345 6789"
                keyboardType="phone-pad"
                placeholderTextColor="#999"
              />
              <Text style={styles.inputHint}>Used for delivery updates</Text>
            </View>

            {/* Delivery Address with Map Integration */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Delivery Address</Text>
              
              {/* Address Input with Map Button */}
              <View style={styles.addressInputContainer}>
                <TextInput
                  style={styles.addressInput}
                  value={address}
                  onChangeText={setAddress}
                  placeholder="House No., Street, Barangay, City..."
                  multiline
                  numberOfLines={2}
                  placeholderTextColor="#999"
                  textAlignVertical="top"
                />
                <TouchableOpacity 
                  style={styles.mapButton}
                  onPress={() => setMapModalVisible(true)}
                >
                  <Ionicons name="map-outline" size={24} color="#0033A0" />
                </TouchableOpacity>
              </View>

              {/* Location Action Buttons */}
              <View style={styles.locationActions}>
                <TouchableOpacity 
                  style={styles.locationButton}
                  onPress={useCurrentLocation}
                  disabled={isGettingLocation}
                >
                  {isGettingLocation ? (
                    <ActivityIndicator size="small" color="#0033A0" />
                  ) : (
                    <>
                      <Ionicons name="locate" size={18} color="#0033A0" />
                      <Text style={styles.locationButtonText}>Use My Location</Text>
                    </>
                  )}
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.locationButton, styles.mapButtonSmall]}
                  onPress={() => setMapModalVisible(true)}
                >
                  <Ionicons name="map" size={18} color="#0033A0" />
                  <Text style={styles.locationButtonText}>Pick on Map</Text>
                </TouchableOpacity>
              </View>
              
              <Text style={styles.inputHint}>We'll deliver to this address by default</Text>
            </View>
          </View>

          {/* Preferences Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Preferences</Text>
            
            <View style={styles.preferenceItem}>
              <View style={styles.preferenceInfo}>
                <Ionicons name="notifications" size={22} color="#0033A0" />
                <View style={styles.preferenceText}>
                  <Text style={styles.preferenceTitle}>Push Notifications</Text>
                  <Text style={styles.preferenceDescription}>Order and delivery status updates</Text>
                </View>
              </View>
              <Switch
                value={notifications}
                onValueChange={handleNotificationsToggle}
                disabled={savingNotifications}
                trackColor={{ false: '#e9ecef', true: '#0033A0' }}
                thumbColor="#fff"
              />
            </View>
          </View>

          {/* Account Actions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>
            
            <TouchableOpacity 
              style={styles.actionItem}
              onPress={() => navigation.navigate('OrderHistory')}
            >
              <View style={styles.actionIconContainer}>
                <Ionicons name="time" size={22} color="#0033A0" />
              </View>
              <Text style={styles.actionText}>Order History</Text>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionItem}
              onPress={() => navigation.navigate('HelpCenter', { role: 'customer' })}
            >
              <View style={styles.actionIconContainer}>
                <Ionicons name="help-circle" size={22} color="#0033A0" />
              </View>
              <Text style={styles.actionText}>Help & User Manual</Text>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionItem}
              onPress={() => navigation.navigate('TermsPrivacy')}
            >
              <View style={styles.actionIconContainer}>
                <Ionicons name="document-text" size={22} color="#0033A0" />
              </View>
              <Text style={styles.actionText}>Terms & Privacy</Text>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </TouchableOpacity>
          </View>

          {/* Save Changes Button */}
          <TouchableOpacity 
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
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

          {/* Sign Out Button */}
          <TouchableOpacity 
            style={styles.signOutButton}
            onPress={handleLogoutPress}
            activeOpacity={0.7}
          >
            <Ionicons name="log-out" size={20} color="#ED2939" />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>

          {/* App Info */}
          <View style={styles.appInfo}>
            <Text style={styles.appVersion}>Petron San Pedro v1.0.0</Text>
            <Text style={styles.appCopyright}>© 2026 Petron San Pedro Delivery</Text>
          </View>
        </ScrollView>

        {/* Map Picker Modal */}
        <OpenStreetMapPicker
          visible={mapModalVisible}
          onClose={() => setMapModalVisible(false)}
          onSelectAddress={handleMapAddressSelected}
          initialAddress={address}
        />

        {/* Logout Confirmation Modal */}
        <CustomAlertModal
          visible={showLogoutModal}
          onClose={() => setShowLogoutModal(false)}
          type="confirm"
          title="Sign Out"
          message="Are you sure you want to log out?"
          confirmText="Log Out"
          cancelText="Cancel"
          showCancelButton={true}
          onConfirm={confirmLogout}
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

      {/* Settings Modal - Contains Delete Account Button */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showSettingsModal}
        onRequestClose={() => setShowSettingsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Account Settings</Text>
              <TouchableOpacity 
                onPress={() => setShowSettingsModal(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Delete Account Option */}
              <TouchableOpacity 
                style={styles.deleteOption}
                onPress={() => {
                  setShowSettingsModal(false);
                  setShowDeleteModal(true);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.deleteIconContainer}>
                  <Ionicons name="trash" size={24} color="#EF4444" />
                </View>
                <View style={styles.deleteTextContainer}>
                  <Text style={styles.deleteTitle}>Delete Account</Text>
                  <Text style={styles.deleteDescription}>
                    Permanently delete your account and all data
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </TouchableOpacity>

              <View style={styles.modalFooter}>
                <Text style={styles.modalFooterText}>
                  This action cannot be undone. All your order history and personal information will be permanently removed.
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Delete Account Confirmation Modal */}
      <CustomAlertModal
        visible={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        type="warning"
        title="Delete Account"
        message="This action cannot be undone. All your data will be permanently deleted."
        confirmText="Delete Account"
        cancelText="Cancel"
        showCancelButton={true}
        onConfirm={confirmDelete}
      />
    </>
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
    paddingHorizontal: 20,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
    fontSize: 14,
  },
  // Fixed Header
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
  settingsButton: {
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
  // Profile Card
  profileCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginTop: 15,
    marginBottom: 25,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarContainer: {
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
    color: 'white',
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
  profileEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  profileMember: {
    fontSize: 12,
    color: '#999',
  },
  // Stats
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#e9ecef',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0033A0',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  // Sections
  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  // Inputs
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  // Address Input Styles
  addressInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  addressInput: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#e9ecef',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  mapButton: {
    width: 50,
    height: 80,
    backgroundColor: '#f0f4ff',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#0033A0',
  },
  locationActions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  locationButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f4ff',
    padding: 10,
    borderRadius: 10,
    gap: 6,
  },
  mapButtonSmall: {
    backgroundColor: '#f0f4ff',
  },
  locationButtonText: {
    color: '#0033A0',
    fontSize: 13,
    fontWeight: '500',
  },
  inputHint: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  // Preferences
  preferenceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f4ff',
  },
  preferenceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  preferenceText: {
    marginLeft: 12,
    flex: 1,
  },
  preferenceTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  preferenceDescription: {
    fontSize: 13,
    color: '#666',
  },
  // Account Actions
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f4ff',
  },
  actionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f4ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  actionText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  // Save Button
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0033A0',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 4,
    shadowColor: '#0033A0',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
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
  // Sign Out Button
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ED2939',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  signOutText: {
    color: '#ED2939',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  // App Info
  appInfo: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  appVersion: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  appCopyright: {
    fontSize: 11,
    color: '#ccc',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '50%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalBody: {
    padding: 20,
  },
  deleteOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f4ff',
  },
  deleteIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  deleteTextContainer: {
    flex: 1,
  },
  deleteTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
    marginBottom: 2,
  },
  deleteDescription: {
    fontSize: 13,
    color: '#666',
  },
  modalFooter: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  modalFooterText: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 18,
  },
});