import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Alert, 
  ActivityIndicator,
  ScrollView 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

export default function ProfileScreen({ navigation }) {
  const { user, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form State
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  // 1. Fetch Profile Data on Load
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        if (!user) return;

        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (error) throw error;

        if (data) {
          setFullName(data.full_name || '');
          setPhone(data.phone_number || '');
          setAddress(data.address || '');
        }
      } catch (error) {
        console.error('Error fetching profile:', error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

  // 2. Handle Update (Save Changes)
  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          phone_number: phone,
          address: address,
        })
        .eq('id', user.id);

      if (error) throw error;

      Alert.alert('Success', 'Profile updated successfully!');
    } catch (error) {
      Alert.alert('Error', error.message);
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
            // AuthContext will automatically redirect to Login
          } 
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0033A0" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      
      {/* Header / Avatar Section */}
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarText}>
            {fullName ? fullName.charAt(0).toUpperCase() : 'U'}
          </Text>
        </View>
        <Text style={styles.emailText}>{user.email}</Text>
      </View>

      {/* Form Section */}
      <View style={styles.form}>
        <Text style={styles.sectionTitle}>Personal Information</Text>

        <Text style={styles.label}>Full Name</Text>
        <TextInput
          style={styles.input}
          value={fullName}
          onChangeText={setFullName}
          placeholder="Enter your name"
        />

        <Text style={styles.label}>Phone Number</Text>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          placeholder="0912 345 6789"
          keyboardType="phone-pad"
        />

        <Text style={styles.label}>Default Delivery Address</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={address}
          onChangeText={setAddress}
          placeholder="House No., Street, Barangay..."
          multiline
          numberOfLines={3}
        />

        {/* Save Button */}
        <TouchableOpacity 
          style={styles.saveButton} 
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.saveButtonText}>SAVE CHANGES</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color="#ED2939" />
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9f9f9' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  header: {
    backgroundColor: 'white', padding: 30, alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: '#eee',
    marginBottom: 20
  },
  avatarContainer: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#0033A0',
    justifyContent: 'center', alignItems: 'center', marginBottom: 10,
    elevation: 5
  },
  avatarText: { fontSize: 32, color: 'white', fontWeight: 'bold' },
  emailText: { fontSize: 16, color: '#666' },

  form: { paddingHorizontal: 20 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 15 },
  
  label: { fontSize: 14, color: '#666', marginBottom: 5, fontWeight: '600' },
  input: {
    backgroundColor: 'white', padding: 12, borderRadius: 8, marginBottom: 15,
    borderWidth: 1, borderColor: '#ddd', fontSize: 16
  },
  textArea: { height: 80, textAlignVertical: 'top' },

  saveButton: {
    backgroundColor: '#0033A0', padding: 15, borderRadius: 10,
    alignItems: 'center', marginTop: 10, elevation: 2
  },
  saveButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },

  logoutButton: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    marginTop: 30, marginBottom: 50, padding: 15,
    backgroundColor: '#fff', marginHorizontal: 20, borderRadius: 10,
    borderWidth: 1, borderColor: '#ED2939'
  },
  logoutText: { color: '#ED2939', fontWeight: 'bold', fontSize: 16, marginLeft: 10 }
});