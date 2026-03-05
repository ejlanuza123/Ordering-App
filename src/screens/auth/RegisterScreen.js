// src/screens/auth/RegisterScreen.js
import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import CustomAlertModal from '../../components/CustomAlertModal';

const { height } = Dimensions.get('window');

export default function RegisterScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    type: 'warning',
    title: '',
    message: ''
  });

  const handleRegister = async () => {
    if (!fullName || !phone || !email || !password || !confirmPassword) {
      setAlertConfig({
        type: 'warning',
        title: 'Error',
        message: 'Please fill in all fields.'
      });
      setShowAlert(true);
      return;
    }

    if (password.length < 6) {
      setAlertConfig({
        type: 'warning',
        title: 'Error',
        message: 'Password must be at least 6 characters.'
      });
      setShowAlert(true);
      return;
    }

    if (password !== confirmPassword) {
      setAlertConfig({
        type: 'warning',
        title: 'Error',
        message: 'Passwords do not match.'
      });
      setShowAlert(true);
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
        setAlertConfig({
          type: 'info',
          title: 'Check Your Email',
          message: 'A user with this email already exists. Please check your inbox for confirmation email or try logging in.'
        });
        setShowAlert(true);
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
          }
        } catch (profileErr) {
          console.log('Profile creation failed:', profileErr);
        }

        // 4. Show appropriate message
        if (data.session) {
          setAlertConfig({
            type: 'success',
            title: 'Success!',
            message: 'Account created successfully. You are now logged in.'
          });
          setShowAlert(true);
        } else {
          setAlertConfig({
            type: 'success',
            title: 'Almost There!',
            message: 'Account created successfully! Please check your email (including spam folder) to verify your account before logging in.'
          });
          setShowAlert(true);
        }
      }

    } catch (error) {
      console.error('Registration error:', error);
      setAlertConfig({
        type: 'error',
        title: 'Registration Failed',
        message: error.message
      });
      setShowAlert(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <CustomAlertModal
        visible={showAlert}
        onClose={() => {
          setShowAlert(false);
          // Navigate to login screen after successful registration that requires email verification
          if (alertConfig.type === 'success' && alertConfig.title === 'Almost There!') {
            navigation.navigate('Login');
          }
        }}
        type={alertConfig.type}
        title={alertConfig.title}
        message={alertConfig.message}
        confirmText="OK"
      />
      
      <View style={[styles.container, { 
        paddingTop: insets.top, 
        paddingBottom: insets.bottom 
      }]}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          {/* Main Content - No ScrollView */}
          <View style={styles.content}>
            {/* Header with Back Button */}
            <View style={styles.header}>
              <TouchableOpacity 
                onPress={() => navigation.goBack()}
                style={styles.backButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="arrow-back" size={24} color="#0033A0" />
              </TouchableOpacity>
              <View style={styles.titleContainer}>
                <Text style={styles.title}>Create Account</Text>
                <Text style={styles.subtitle}>Join Petron San Pedro</Text>
              </View>
              <View style={{ width: 40 }} />
            </View>

            {/* Form */}
            <View style={styles.form}>
              {/* Full Name */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Full Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Juan Dela Cruz"
                  placeholderTextColor="#999"
                  value={fullName}
                  onChangeText={setFullName}
                />
              </View>

              {/* Phone Number */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Phone Number</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0912 345 6789"
                  placeholderTextColor="#999"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />
              </View>

              {/* Email Address */}
              <View style={styles.inputGroup}>
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
              </View>

              {/* Password */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Password</Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={[styles.input, styles.passwordInput]}
                    placeholder="Minimum 6 characters"
                    placeholderTextColor="#999"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity 
                    style={styles.eyeIcon}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <Text style={styles.eyeIconText}>
                      {showPassword ? '👁️' : '👁️‍🗨️'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Confirm Password */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Confirm Password</Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={[styles.input, styles.passwordInput]}
                    placeholder="Re-enter your password"
                    placeholderTextColor="#999"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showConfirmPassword}
                  />
                  <TouchableOpacity 
                    style={styles.eyeIcon}
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    <Text style={styles.eyeIconText}>
                      {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Sign Up Button */}
              <TouchableOpacity 
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleRegister}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>SIGN UP</Text>
                )}
              </TouchableOpacity>

              {/* Login Link */}
              <TouchableOpacity 
                style={styles.linkButton}
                onPress={() => navigation.navigate('Login')}
              >
                <Text style={styles.linkText}>
                  Already have an account? <Text style={styles.bold}>Login</Text>
                </Text>
              </TouchableOpacity>

              {/* Info Box */}
              <View style={styles.infoBox}>
                <Text style={styles.infoText}>
                  📧 After registration, check your email (including spam folder) for verification link.
                </Text>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#e6f2ff',
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingTop: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f4ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleContainer: {
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0033A0',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  form: {
    flex: 1,
    justifyContent: 'center',
  },
  inputGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    color: '#333',
    marginBottom: 4,
    fontWeight: '600',
  },
  inputWrapper: {
    position: 'relative',
  },
  input: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    fontSize: 14,
    color: '#333',
  },
  passwordInput: {
    paddingRight: 45,
  },
  eyeIcon: {
    position: 'absolute',
    right: 14,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  eyeIconText: {
    fontSize: 18,
  },
  button: {
    backgroundColor: '#ED2939',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
    elevation: 3,
    shadowColor: '#ED2939',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  buttonDisabled: {
    backgroundColor: '#f8a5b0',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
    letterSpacing: 0.5,
  },
  linkButton: {
    alignItems: 'center',
    marginBottom: 12,
  },
  linkText: {
    color: '#666',
    fontSize: 13,
  },
  bold: {
    fontWeight: 'bold',
    color: '#0033A0',
  },
  infoBox: {
    padding: 12,
    backgroundColor: '#f0f7ff',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#0033A0',
  },
  infoText: {
    color: '#0033A0',
    fontSize: 11,
    fontStyle: 'italic',
    lineHeight: 16,
  },
});