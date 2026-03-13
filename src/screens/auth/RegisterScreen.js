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
  Dimensions,
  StatusBar,
  ScrollView
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
        <StatusBar barStyle="light-content" backgroundColor="#0033A0" />
        
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          {/* Decorative elements - Fixed background */}
          <View style={styles.headerDecoration}>
            <View style={styles.decorationCircle1} />
            <View style={styles.decorationCircle2} />
          </View>

          {/* Fixed Header Section - NOT SCROLLABLE */}
          <View style={styles.fixedHeader}>
            <View style={styles.header}>
              <TouchableOpacity 
                onPress={() => navigation.goBack()}
                style={styles.backButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>
              <View style={styles.titleContainer}>
                <Text style={styles.title}>Create Account</Text>
                <Text style={styles.subtitle}>Join Petron San Pedro</Text>
              </View>
              <View style={{ width: 40 }} />
            </View>
          </View>

          {/* Scrollable Form Section */}
          <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Form Container */}
            <View style={styles.formContainer}>
              {/* Full Name */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Full Name</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="person-outline" size={20} color="#999" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Juan Dela Cruz"
                    placeholderTextColor="#999"
                    value={fullName}
                    onChangeText={setFullName}
                  />
                </View>
              </View>

              {/* Phone Number */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Phone Number</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="call-outline" size={20} color="#999" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="0912 345 6789"
                    placeholderTextColor="#999"
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                  />
                </View>
              </View>

              {/* Email Address */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email Address</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="mail-outline" size={20} color="#999" style={styles.inputIcon} />
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
              </View>

              {/* Password */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Password</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="lock-closed-outline" size={20} color="#999" style={styles.inputIcon} />
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
                    <Ionicons 
                      name={showPassword ? "eye-outline" : "eye-off-outline"} 
                      size={20} 
                      color="#0033A0" 
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Confirm Password */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Confirm Password</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="lock-closed-outline" size={20} color="#999" style={styles.inputIcon} />
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
                    <Ionicons 
                      name={showConfirmPassword ? "eye-outline" : "eye-off-outline"} 
                      size={20} 
                      color="#0033A0" 
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Password Requirements */}
              <View style={styles.passwordRequirements}>
                <View style={styles.requirementItem}>
                  <Ionicons 
                    name={password.length >= 6 ? "checkmark-circle" : "ellipse-outline"} 
                    size={16} 
                    color={password.length >= 6 ? "#10B981" : "#999"} 
                  />
                  <Text style={[styles.requirementText, password.length >= 6 && styles.requirementMet]}>
                    At least 6 characters
                  </Text>
                </View>
                <View style={styles.requirementItem}>
                  <Ionicons 
                    name={password && password === confirmPassword ? "checkmark-circle" : "ellipse-outline"} 
                    size={16} 
                    color={password && password === confirmPassword ? "#10B981" : "#999"} 
                  />
                  <Text style={[styles.requirementText, password && password === confirmPassword && styles.requirementMet]}>
                    Passwords match
                  </Text>
                </View>
              </View>

              {/* Sign Up Button */}
              <TouchableOpacity 
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleRegister}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={styles.buttonText}>CREATE ACCOUNT</Text>
                    <Ionicons name="arrow-forward" size={18} color="#fff" style={styles.buttonIcon} />
                  </>
                )}
              </TouchableOpacity>

              {/* Divider */}
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Login Link */}
              <TouchableOpacity 
                style={styles.loginLink}
                onPress={() => navigation.navigate('Login')}
              >
                <Text style={styles.loginLinkText}>
                  Already have an account? <Text style={styles.loginLinkBold}>Sign In</Text>
                </Text>
              </TouchableOpacity>

              {/* Info Box */}
              <View style={styles.infoBox}>
                <Ionicons name="mail-outline" size={16} color="#0033A0" />
                <Text style={styles.infoText}>
                  Check your email (including spam) for verification link
                </Text>
              </View>

              {/* Terms */}
              <Text style={styles.termsText}>
                By signing up, you agree to our{' '}
                <Text style={styles.termsLink}>Terms of Service</Text> and{' '}
                <Text style={styles.termsLink}>Privacy Policy</Text>
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0033A0',
  },
  keyboardView: {
    flex: 1,
  },
  // Decorative elements
  headerDecoration: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 200,
    overflow: 'hidden',
  },
  decorationCircle1: {
    position: 'absolute',
    top: -50,
    right: -30,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  decorationCircle2: {
    position: 'absolute',
    top: 20,
    left: -40,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  // Fixed Header Section
  fixedHeader: {
    paddingTop: 10,
    paddingHorizontal: 20,
    backgroundColor: 'transparent',
    zIndex: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleContainer: {
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
  },
  // Scrollable Form Section
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  // Form Container
  formContainer: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    width: '100%',
    marginTop: 5,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
    marginLeft: 4,
  },
  inputWrapper: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  inputIcon: {
    marginLeft: 12,
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 14,
    fontSize: 15,
    color: '#333',
  },
  passwordInput: {
    paddingRight: 45,
  },
  eyeIcon: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  // Password Requirements
  passwordRequirements: {
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  requirementText: {
    fontSize: 12,
    color: '#999',
  },
  requirementMet: {
    color: '#10B981',
  },
  // Button
  button: {
    backgroundColor: '#ED2939',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#ED2939',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#f8a5b0',
    shadowOpacity: 0,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  buttonIcon: {
    marginLeft: 8,
  },
  // Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e9ecef',
  },
  dividerText: {
    paddingHorizontal: 12,
    color: '#999',
    fontSize: 13,
    fontWeight: '500',
  },
  // Login Link
  loginLink: {
    alignItems: 'center',
    marginBottom: 16,
  },
  loginLinkText: {
    color: '#666',
    fontSize: 14,
  },
  loginLinkBold: {
    fontWeight: 'bold',
    color: '#0033A0',
  },
  // Info Box
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f4ff',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    gap: 8,
  },
  infoText: {
    color: '#0033A0',
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
  // Terms
  termsText: {
    fontSize: 11,
    color: '#999',
    textAlign: 'center',
    lineHeight: 16,
  },
  termsLink: {
    color: '#0033A0',
    fontWeight: '600',
  },
});