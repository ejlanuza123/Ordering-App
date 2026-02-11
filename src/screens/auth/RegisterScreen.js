import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Alert, 
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { supabase } from '../../lib/supabase';


export default function RegisterScreen({ navigation }) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!fullName || !phone || !email || !password) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters.');
      return;
    }

    setLoading(true);


    try {
      // 1. Create User in Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
          data: {
            full_name: fullName,
            phone_number: phone,
          },

        }
      });

      if (error) throw error;

      // 2. Check if email confirmation is required
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        // This means user already exists but needs to confirm email
        Alert.alert(
          'Check Your Email', 
          'A user with this email already exists. Please check your inbox for confirmation email or try logging in.',
          [{ text: 'OK' }]
        );
        setLoading(false);
        return;
      }

      // 3. Manually create/update profile if trigger doesn't exist
      if (data.user) {
        try {
          const { error: profileError } = await supabase
            .from('profiles')
            .upsert({ 
              id: data.user.id,
              full_name: fullName,
              phone_number: phone,
              role: 'customer' 
            }, {
              onConflict: 'id'
            });

          if (profileError) {
            console.log('Profile update error:', profileError);
            // Continue anyway - the trigger might handle it
          }
        } catch (profileErr) {
          console.log('Profile creation failed:', profileErr);
          // Non-critical error, continue
        }

        // 4. Show appropriate message
        if (data.session) {
          // User is immediately signed in (if email confirmations are disabled)
          Alert.alert(
            'Success!', 
            'Account created successfully. You are now logged in.',
          );
        } else {
          // Email confirmation required
          Alert.alert(
            'Almost There!', 
            'Account created successfully! Please check your email (including spam folder) to verify your account before logging in.',
            [
              { 
                text: 'Check Email', 
                onPress: () => {
                  // Optionally open email client
                  // Linking.openURL('message://');
                }
              },
              { 
                text: 'Go to Login', 
                style: 'default',
                onPress: () => navigation.navigate('Login') 
              }
            ]
          );
        }
      }

    } catch (error) {
      console.error('Registration error:', error);
      Alert.alert('Registration Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join Petron San Pedro</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Full Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Juan Dela Cruz"
            placeholderTextColor="#999"
            value={fullName}
            onChangeText={setFullName}
          />

          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            style={styles.input}
            placeholder="0912 345 6789"
            placeholderTextColor="#999"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>Email Address</Text>
          <TextInput
            style={styles.input}
            placeholder="juan@example.com"
            placeholderTextColor="#999"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Minimum 6 characters"
            placeholderTextColor="#999"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity 
            style={styles.button} 
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>SIGN UP</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.linkButton}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.linkText}>
              Already have an account? <Text style={styles.bold}>Login</Text>
            </Text>
          </TouchableOpacity>

          {/* Add informational text */}
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              📧 After registration, check your email (including spam folder) for verification link.
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scrollContent: { padding: 20, justifyContent: 'center', minHeight: '100%' },
  header: { marginBottom: 30, alignItems: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#0033A0' },
  subtitle: { fontSize: 16, color: '#666', marginTop: 5 },
  form: { width: '100%' },
  label: { fontSize: 14, color: '#333', marginBottom: 5, fontWeight: '600' },
  input: {
    backgroundColor: '#f5f5f5', padding: 15, borderRadius: 10, marginBottom: 15,
    borderWidth: 1, borderColor: '#e0e0e0',
  },
  button: {
    backgroundColor: '#ED2939', padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 10,
  },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  linkButton: { marginTop: 20, alignItems: 'center' },
  linkText: { color: '#666' },
  bold: { fontWeight: 'bold', color: '#0033A0' },
  infoBox: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#f0f7ff',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#0033A0',
  },
  infoText: {
    color: '#0033A0',
    fontSize: 12,
    fontStyle: 'italic',
  },
});