// src\screens\auth\LoginScreen.js
import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Alert, 
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  Dimensions,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import CustomAlertModal from '../../components/CustomAlertModal';

const { height } = Dimensions.get('window');

export default function LoginScreen({ navigation }) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const insets = useSafeAreaInsets();
  const [showAlert, setShowAlert] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    type: 'error',
    title: '',
    message: ''
  });
  const [blockedMessage, setBlockedMessage] = useState('');
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');

  const handleLogin = async () => {
    if (!email || !password) {
      setAlertConfig({
          type: 'warning',
          title: 'Error',
          message: 'Please fill in all fields'
        });
        setShowAlert(true);
      return;
    }

    if (!email.includes('@')) {
      setAlertConfig({
        type: 'warning',
        title: 'Error',
        message: 'Please enter a valid email address',
      });
      setShowAlert(true);
      return;
    }

    setLoading(true);
    try {
      await signIn(email, password);
      setBlockedMessage('');
    } catch (error) {
      const message = error?.message || 'Invalid credentials. Please try again.';
      if (message.toLowerCase().includes('not allowed')) {
        setBlockedMessage(message);
      } else {
        setAlertConfig({
          type: 'error',
          title: 'Login Failed',
          message,
        });
        setShowAlert(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetEmail) {
      setAlertConfig({
        type: 'warning',
        title: 'Error',
        message: 'Please enter your email address',
      });
      setShowAlert(true);
      return;
    }

    if (!resetEmail.includes('@')) {
      setAlertConfig({
        type: 'warning',
        title: 'Error',
        message: 'Please enter a valid email address',
      });
      setShowAlert(true);
      return;
    }

    setLoading(true);
    try {
      await supabase.auth.resetPasswordForEmail(resetEmail);
      setShowResetModal(false);
      setResetEmail('');
      setAlertConfig({
        type: 'success',
        title: 'Email Sent',
        message: 'Check your inbox for a password reset link.',
      });
      setShowAlert(true);
    } catch (error) {
      setAlertConfig({
        type: 'error',
        title: 'Reset Failed',
        message: error?.message || 'Unable to send reset email. Please try again.',
      });
      setShowAlert(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Main Content - No ScrollView */}
        <View style={styles.content}>
          {/* Logo and Welcome Section */}
          <View style={styles.logoContainer}>
            <Image 
              source={require('../../../assets/petron-logo.png')} 
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.welcomeTitle}>Welcome Back!</Text>
            <Text style={styles.welcomeSubtitle}>Sign in to continue to Petron San Pedro</Text>
          </View>

          {/* Form Section */}
          <View style={styles.formContainer}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email Address</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your email"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  placeholderTextColor="#999"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  placeholder="Enter your password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoComplete="password"
                  placeholderTextColor="#999"
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

            {/* Forgot Password */}
            <TouchableOpacity
              style={styles.forgotPassword}
              onPress={() => {
                setResetEmail(email);
                setShowResetModal(true);
              }}
            >
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>

            {/* Login Button */}
            {blockedMessage ? (
              <View style={styles.blockedMessageContainer}>
                <Text style={styles.blockedMessageText}>{blockedMessage}</Text>
              </View>
            ) : null}

            <TouchableOpacity 
              style={[styles.loginButton, (loading || blockedMessage) && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={loading || !!blockedMessage}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.loginButtonText}>LOGIN</Text>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Register Link */}
            <View style={styles.registerContainer}>
              <Text style={styles.registerText}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                <Text style={styles.registerLink}>Sign Up</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.signUpNote}>
              Sign up is for customers only. Riders should contact admin to be added.
            </Text>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>© 2026 Petron San Pedro</Text>
            <Text style={styles.footerSubtext}>Fuel & Oil Delivery Service</Text>
          </View>
        </View>
      </KeyboardAvoidingView>
      <Modal
        animationType="slide"
        transparent={true}
        visible={showResetModal}
        onRequestClose={() => setShowResetModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Reset Password</Text>
            <Text style={styles.modalMessage}>
              Enter your email and we’ll send a password reset link.
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Email address"
              placeholderTextColor="#999"
              keyboardType="email-address"
              autoCapitalize="none"
              value={resetEmail}
              onChangeText={setResetEmail}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => {
                  setShowResetModal(false);
                  setResetEmail('');
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalConfirmButton]}
                onPress={handleResetPassword}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalConfirmText}>Send</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
    backgroundColor: '#e6f2ff',
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  logo: {
    width: 100,
    height: 100,
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#ED2939',
  },
  logoContainer: {
    alignItems: 'center',
    flexShrink: 0,
  },
  welcomeTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#0033A0',
    marginBottom: 6,
    textAlign: 'center',
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  formContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    width: '100%',
    alignSelf: 'center',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  inputWrapper: {
    position: 'relative',
  },
  input: {
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e9ecef',
    fontSize: 15,
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
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 20,
  },
  forgotPasswordText: {
    color: '#0033A0',
    fontSize: 13,
    fontWeight: '600',
  },
  loginButton: {
    backgroundColor: '#0033A0',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#0033A0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  loginButtonDisabled: {
    backgroundColor: '#8da2c0',
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e9ecef',
  },
  dividerText: {
    paddingHorizontal: 12,
    color: '#666',
    fontSize: 13,
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  registerText: {
    color: '#666',
    fontSize: 13,
  },
  registerLink: {
    color: '#0033A0',
    fontSize: 13,
    fontWeight: 'bold',
  },
  signUpNote: {
    color: '#555',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 10,
    lineHeight: 18,
  },
  footer: {
    alignItems: 'center',
    flexShrink: 0,
  },
  footerText: {
    color: '#666',
    fontSize: 11,
    marginBottom: 2,
  },
  footerSubtext: {
    color: '#999',
    fontSize: 10,
  },
  blockedMessageContainer: {
    backgroundColor: '#fdecea',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f5c2c7',
  },
  blockedMessageText: {
    color: '#a1201f',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0033A0',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 14,
    color: '#555',
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalInput: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#333',
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelButton: {
    backgroundColor: '#f0f4ff',
    borderWidth: 1,
    borderColor: '#cbd6e5',
  },
  modalConfirmButton: {
    backgroundColor: '#0033A0',
  },
  modalCancelText: {
    color: '#0033A0',
    fontWeight: '600',
    fontSize: 14,
  },
  modalConfirmText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});