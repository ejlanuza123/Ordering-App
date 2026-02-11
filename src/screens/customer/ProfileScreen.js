import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Alert, 
  ActivityIndicator,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Switch,
  Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ProfileScreen({ navigation }) {
  const { user, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Form State
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notifications, setNotifications] = useState(true);
  const [marketingEmails, setMarketingEmails] = useState(false);

  // User stats
  const [orderCount, setOrderCount] = useState(0);
  const [totalSpent, setTotalSpent] = useState(0);

  // 1. Fetch Profile Data and Stats
  useEffect(() => {
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

    fetchProfileData();
  }, [user]);

  // 2. Handle Update (Save Changes)
  const handleSave = async () => {
    if (!fullName.trim()) {
      Alert.alert('Error', 'Please enter your full name.');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          phone_number: phone.trim(),
          address: address.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;

      Alert.alert('Success', 'Profile updated successfully!');
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  // 3. Handle Logout
  const handleLogout = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Log Out', 
          style: 'destructive', 
          onPress: async () => {
            await signOut();
          } 
        }
      ]
    );
  };

  // 4. Handle Account Deletion
  const handleDeleteAccount = async () => {
    Alert.alert(
      'Delete Account',
      'This action cannot be undone. All your data will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete Account', 
          style: 'destructive',
          onPress: async () => {
            try {
              // First delete user data from profiles table
              const { error: profileError } = await supabase
                .from('profiles')
                .delete()
                .eq('id', user.id);

              if (profileError) throw profileError;

              // Then sign out (which will delete auth user)
              await signOut();
              
            } catch (error) {
              Alert.alert('Error', 'Failed to delete account. Please contact support.');
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0033A0" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  // Format phone number for display
  const formatPhoneNumber = (phone) => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
    if (match) {
      return `+63 ${match[1]} ${match[2]} ${match[3]}`;
    }
    return phone;
  };

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header with Back Button */}
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="#0033A0" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Profile</Text>
          <View style={{width: 40}} />
        </View>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.avatarContainer}>
              <Text style={styles.avatarText}>
                {fullName ? fullName.charAt(0).toUpperCase() : 'U'}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{fullName || 'User'}</Text>
              <Text style={styles.profileEmail}>{user.email}</Text>
              <Text style={styles.profileMember}>Member since {new Date(user.created_at).getFullYear()}</Text>
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

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Delivery Address</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={address}
              onChangeText={setAddress}
              placeholder="House No., Street, Barangay, City..."
              multiline
              numberOfLines={3}
              placeholderTextColor="#999"
            />
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
                <Text style={styles.preferenceDescription}>Order updates and promotions</Text>
              </View>
            </View>
            <Switch
              value={notifications}
              onValueChange={setNotifications}
              trackColor={{ false: '#e9ecef', true: '#0033A0' }}
              thumbColor="#fff"
            />
          </View>

          <View style={styles.preferenceItem}>
            <View style={styles.preferenceInfo}>
              <Ionicons name="mail" size={22} color="#0033A0" />
              <View style={styles.preferenceText}>
                <Text style={styles.preferenceTitle}>Marketing Emails</Text>
                <Text style={styles.preferenceDescription}>Special offers and news</Text>
              </View>
            </View>
            <Switch
              value={marketingEmails}
              onValueChange={setMarketingEmails}
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
            onPress={() => Alert.alert('Help', 'Contact support at support@petronsanpedro.com')}
          >
            <View style={styles.actionIconContainer}>
              <Ionicons name="help-circle" size={22} color="#0033A0" />
            </View>
            <Text style={styles.actionText}>Help & Support</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionItem}
            onPress={() => Alert.alert('Terms', 'By using our service, you agree to our Terms of Service and Privacy Policy.')}
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

        {/* Danger Zone */}
        <View style={styles.dangerZone}>
          <Text style={styles.dangerZoneTitle}>Account Actions</Text>
          
          <TouchableOpacity 
            style={[styles.dangerButton, styles.logoutButton]}
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <Ionicons name="log-out" size={20} color="#ED2939" />
            <Text style={[styles.dangerButtonText, { color: '#ED2939' }]}>Sign Out</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.dangerButton, styles.deleteButton]}
            onPress={handleDeleteAccount}
            activeOpacity={0.7}
          >
            <Ionicons name="trash" size={20} color="#666" />
            <Text style={[styles.dangerButtonText, { color: '#666' }]}>Delete Account</Text>
          </TouchableOpacity>
        </View>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={styles.appVersion}>Petron San Pedro v1.0.0</Text>
          <Text style={styles.appCopyright}>© 2024 Petron San Pedro Delivery</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
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
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    marginBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f4ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0033A0',
  },
  // Profile Card
  profileCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
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
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  inputHint: {
    fontSize: 12,
    color: '#999',
    marginTop: 6,
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
    marginBottom: 20,
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
  // Danger Zone
  dangerZone: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ffeaea',
  },
  dangerZoneTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
  },
  logoutButton: {
    borderColor: '#ED2939',
    backgroundColor: '#fff',
  },
  deleteButton: {
    borderColor: '#e9ecef',
    backgroundColor: '#fff',
  },
  dangerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
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
});