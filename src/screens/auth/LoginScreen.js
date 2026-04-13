// src/screens/auth/LoginScreen.js
import React, { useEffect, useRef, useState } from 'react';
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
  StatusBar,
  Animated,
  Linking,
  Easing
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import CustomAlertModal from '../../components/CustomAlertModal';
import { Ionicons } from '@expo/vector-icons';

const { height } = Dimensions.get('window');
const RECOVERY_PENDING_KEY = 'auth_recovery_pending_password_reset';
const RECOVERY_CANCELLED_KEY = 'auth_recovery_cancelled_password_reset';
const MOBILE_APP_ROLES = ['customer', 'rider'];

export default function LoginScreen({ navigation }) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
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
  const [showNewPasswordModal, setShowNewPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.92)).current;
  const formOpacity = useRef(new Animated.Value(0)).current;
  const formTranslateY = useRef(new Animated.Value(18)).current;
  const footerOpacity = useRef(new Animated.Value(0)).current;
  const footerTranslateY = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 420,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(logoScale, {
          toValue: 1,
          duration: 420,
          easing: Easing.out(Easing.back(1.1)),
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(formOpacity, {
          toValue: 1,
          duration: 380,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(formTranslateY, {
          toValue: 0,
          duration: 380,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(footerOpacity, {
          toValue: 1,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(footerTranslateY, {
          toValue: 0,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [footerOpacity, footerTranslateY, formOpacity, formTranslateY, logoOpacity, logoScale]);

  useEffect(() => {
    const restorePendingRecoveryModal = async () => {
      try {
        const pending = await AsyncStorage.getItem(RECOVERY_PENDING_KEY);
        if (pending === '1') {
          setShowNewPasswordModal(true);
        }
      } catch {
        // Ignore storage read errors and continue normal flow.
      }
    };

    restorePendingRecoveryModal();

    const parseAuthParams = (url) => {
      if (!url) return {};

      const readParams = (rawUrl) => {
        const [basePart, hashFragment = ''] = rawUrl.split('#');
        const queryString = basePart.includes('?') ? basePart.split('?')[1] : '';
        const merged = [queryString, hashFragment].filter(Boolean).join('&');
        return new URLSearchParams(merged);
      };

      const params = readParams(url);
      const nestedRedirect = params.get('redirect_to');
      const nested = nestedRedirect ? readParams(decodeURIComponent(nestedRedirect)) : null;
      const pick = (key) => params.get(key) || nested?.get(key) || null;

      return {
        type: pick('type'),
        access_token: pick('access_token') || pick('accessToken'),
        refresh_token: pick('refresh_token') || pick('refreshToken'),
        token_hash: pick('token_hash'),
        token: pick('token'),
        code: pick('code'),
        hasResetPath:
          url.includes('auth/reset-password') ||
          (nestedRedirect ? nestedRedirect.includes('auth/reset-password') : false),
      };
    };

    const handleRecoveryUrl = async (url) => {
      if (!url) return;

      const {
        type,
        access_token,
        refresh_token,
        token_hash,
        token,
        code,
        hasResetPath,
      } = parseAuthParams(url);

      const hasRecoveryCredentials =
        !!access_token || !!refresh_token || !!token_hash || !!token || !!code;
      const isRecoveryIntent = type === 'recovery' || hasResetPath || hasRecoveryCredentials;

      if (!isRecoveryIntent) return;

      // We only clear the cancelled guard for URLs that are actually recovery-related.
      await AsyncStorage.removeItem(RECOVERY_CANCELLED_KEY);
      await AsyncStorage.setItem(RECOVERY_PENDING_KEY, '1');
      setShowNewPasswordModal(true);

      try {
        let error = null;
        let handled = false;

        if (access_token && refresh_token) {
          const result = await supabase.auth.setSession({ access_token, refresh_token });
          error = result.error;
          handled = true;
        } else if (token_hash) {
          const result = await supabase.auth.verifyOtp({
            type: 'recovery',
            token_hash,
          });
          error = result.error;
          handled = true;
        } else if (token) {
          const result = await supabase.auth.verifyOtp({
            type: 'recovery',
            token_hash: token,
          });
          error = result.error;
          handled = true;
        } else if (code) {
          const result = await supabase.auth.exchangeCodeForSession(code);
          error = result.error;
          handled = true;
        }

        if (!handled && hasResetPath) {
          // Some clients open the app first and append credentials moments later.
          // Open the modal so the flow can continue once session is available.
          return;
        }

        if (error) throw error;
      } catch (error) {
        await AsyncStorage.removeItem(RECOVERY_PENDING_KEY);
        await AsyncStorage.setItem(RECOVERY_CANCELLED_KEY, '1');

        try {
          await supabase.auth.signOut({ scope: 'global' });
        } catch {
          // Ignore sign-out failure; we still show the recovery-link error.
        }

        setAlertConfig({
          type: 'error',
          title: 'Invalid Recovery Link',
          message: error?.message || 'This password reset link is invalid or expired.',
        });
        setShowAlert(true);
      }
    };

    const retryTimers = [];
    const tryInitialUrl = async (remainingAttempts = 5) => {
      const url = await Linking.getInitialURL();
      if (url) {
        handleRecoveryUrl(url);
        return;
      }

      if (remainingAttempts > 0) {
        const timer = setTimeout(() => {
          tryInitialUrl(remainingAttempts - 1);
        }, 700);
        retryTimers.push(timer);
      }
    };

    tryInitialUrl();

    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleRecoveryUrl(url);
    });

    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        AsyncStorage.removeItem(RECOVERY_CANCELLED_KEY).catch(() => {});
        AsyncStorage.setItem(RECOVERY_PENDING_KEY, '1').catch(() => {});
        setShowNewPasswordModal(true);
      }
    });

    return () => {
      subscription.remove();
      authSubscription.unsubscribe();
      retryTimers.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  const handleCloseNewPasswordModal = async () => {
    setShowNewPasswordModal(false);
    setNewPassword('');
    setConfirmNewPassword('');
    await AsyncStorage.removeItem(RECOVERY_PENDING_KEY);
    await AsyncStorage.setItem(RECOVERY_CANCELLED_KEY, '1');

    // Recovery links may create a temporary auth session.
    // If user cancels reset, clear it to avoid unintended auto-login.
    try {
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      if (error) {
        await supabase.auth.signOut();
      }
    } catch {
      // Ignore sign-out issues here; user can still retry recovery.
    }
  };

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

    setLoginLoading(true);
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
      setLoginLoading(false);
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

    const normalizedEmail = resetEmail.trim().toLowerCase();

    setResetLoading(true);
    try {
      const { data: eligibilityRows, error: eligibilityError } = await supabase.rpc(
        'get_mobile_reset_eligibility',
        { p_email: normalizedEmail }
      );

      let isMobile = false;
      let isAdmin = false;

      // Fallback for environments where migration has not been applied yet.
      if (eligibilityError && eligibilityError.code === '42883') {
        const { data: profileRows, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .ilike('email', normalizedEmail)
          .limit(5);

        if (profileError && profileError.code !== '42501') throw profileError;

        const visibleRows = profileRows || [];
        isMobile = visibleRows.some((row) => row?.role && MOBILE_APP_ROLES.includes(row.role));
        isAdmin = visibleRows.some((row) => row?.role === 'admin');
      } else {
        if (eligibilityError) throw eligibilityError;

        const row = Array.isArray(eligibilityRows) ? eligibilityRows[0] : eligibilityRows;
        isMobile = !!row?.is_mobile;
        isAdmin = !!row?.is_admin;
      }

      if (isAdmin && !isMobile) {
        setAlertConfig({
          type: 'error',
          title: 'Reset Not Allowed',
          message: 'This email is not registered for the mobile app. Use a customer or rider account.',
        });
        setShowAlert(true);
        return;
      }

      if (!isMobile) {
        setAlertConfig({
          type: 'error',
          title: 'Reset Not Allowed',
          message: 'This email is not registered for the mobile app. Use a customer or rider account.',
        });
        setShowAlert(true);
        return;
      }

      await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: 'petronapp://auth/reset-password',
      });
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
      setResetLoading(false);
    }
  };

  const handleSetNewPassword = async () => {
    if (!newPassword || !confirmNewPassword) {
      setAlertConfig({
        type: 'warning',
        title: 'Error',
        message: 'Please fill in all password fields.',
      });
      setShowAlert(true);
      return;
    }

    if (newPassword.length < 6) {
      setAlertConfig({
        type: 'warning',
        title: 'Error',
        message: 'Password must be at least 6 characters.',
      });
      setShowAlert(true);
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setAlertConfig({
        type: 'warning',
        title: 'Error',
        message: 'Passwords do not match.',
      });
      setShowAlert(true);
      return;
    }

    setUpdatingPassword(true);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;

      const authUserId = userData?.user?.id;
      if (!authUserId) {
        throw new Error('Recovery session is invalid. Please open the latest reset link again.');
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', authUserId)
        .maybeSingle();

      if (profileError) throw profileError;

      if (!profile || !MOBILE_APP_ROLES.includes(profile.role)) {
        await supabase.auth.signOut();
        throw new Error('This recovery link is not for a mobile app customer or rider account.');
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      await supabase.auth.signOut();
      await AsyncStorage.removeItem(RECOVERY_PENDING_KEY);
      await AsyncStorage.removeItem(RECOVERY_CANCELLED_KEY);
      setShowNewPasswordModal(false);
      setNewPassword('');
      setConfirmNewPassword('');

      setAlertConfig({
        type: 'success',
        title: 'Password Updated',
        message: 'Your password has been reset successfully. Please log in with your new password.',
      });
      setShowAlert(true);
    } catch (error) {
      setAlertConfig({
        type: 'error',
        title: 'Reset Failed',
        message: error?.message || 'Failed to update password. Please request a new reset link.',
      });
      setShowAlert(true);
    } finally {
      setUpdatingPassword(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="light-content" backgroundColor="#0033A0" />
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Main Content - Fixed layout, no scrolling */}
        <View style={styles.content}>
          {/* Header with decorative elements */}
          <View style={styles.headerDecoration}>
            <View style={styles.decorationCircle1} />
            <View style={styles.decorationCircle2} />
          </View>

          {/* Logo and Welcome Section */}
          <Animated.View style={[styles.logoContainer, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
            <View style={styles.logoWrapper}>
              <Image 
                source={require('../../../assets/petron-logo.png')} 
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.welcomeTitle}>Welcome Back!</Text>
            <Text style={styles.welcomeSubtitle}>Sign in to continue to Petron San Pedro</Text>
          </Animated.View>

          {/* Form Section - Fixed height, no scrolling needed */}
          <Animated.View style={[styles.formContainer, { opacity: formOpacity, transform: [{ translateY: formTranslateY }] }]}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email Address</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="mail-outline" size={20} color="#999" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your email"
                  placeholderTextColor="#999"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={20} color="#999" style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  placeholder="Enter your password"
                  placeholderTextColor="#999"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoComplete="password"
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
                <Ionicons name="alert-circle" size={20} color="#a1201f" />
                <Text style={styles.blockedMessageText}>{blockedMessage}</Text>
              </View>
            ) : null}

            <TouchableOpacity 
              style={[styles.loginButton, (loginLoading || blockedMessage) && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={loginLoading || !!blockedMessage}
              activeOpacity={0.8}
            >
                {loginLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.loginButtonText}>LOGIN</Text>
                  <Ionicons name="arrow-forward" size={18} color="#fff" style={styles.loginButtonIcon} />
                </>
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
            
            <View style={styles.infoBadge}>
              <Ionicons name="information-circle-outline" size={14} color="#0033A0" />
              <Text style={styles.signUpNote}>
                Sign up is for customers only. Riders contact admin.
              </Text>
            </View>
          </Animated.View>

          {/* Footer */}
          <Animated.View style={[styles.footer, { opacity: footerOpacity, transform: [{ translateY: footerTranslateY }] }]}>
            <Text style={styles.footerText}>© 2026 Petron San Pedro</Text>
            <Text style={styles.footerSubtext}>Fuel & Oil Delivery Service</Text>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>

      {/* Reset Password Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showResetModal}
        onRequestClose={() => setShowResetModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIconContainer}>
                <Ionicons name="key-outline" size={30} color="#fff" />
              </View>
              <TouchableOpacity 
                style={styles.modalCloseButton}
                onPress={() => {
                  setShowResetModal(false);
                  setResetEmail('');
                }}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.modalTitle}>Reset Password</Text>
            <Text style={styles.modalMessage}>
              Enter your email and we'll send you a password reset link.
            </Text>
            
            <View style={styles.modalInputContainer}>
              <Ionicons name="mail-outline" size={20} color="#999" style={styles.modalInputIcon} />
              <TextInput
                style={styles.modalInput}
                placeholder="Email address"
                placeholderTextColor="#999"
                keyboardType="email-address"
                autoCapitalize="none"
                value={resetEmail}
                onChangeText={setResetEmail}
              />
            </View>
            
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
                disabled={resetLoading}
              >
                {resetLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalConfirmText}>Send Reset Link</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Set New Password Modal (from recovery link) */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showNewPasswordModal}
        onRequestClose={handleCloseNewPasswordModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIconContainer}>
                <Ionicons name="lock-closed-outline" size={30} color="#fff" />
              </View>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={handleCloseNewPasswordModal}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalTitle}>Set New Password</Text>
            <Text style={styles.modalMessage}>
              Enter your new password to complete account recovery.
            </Text>

            <View style={styles.modalInputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color="#999" style={styles.modalInputIcon} />
              <TextInput
                style={[styles.modalInput, styles.modalPasswordInput]}
                placeholder="New password"
                placeholderTextColor="#999"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showNewPassword}
              />
              <TouchableOpacity style={styles.eyeIcon} onPress={() => setShowNewPassword(!showNewPassword)}>
                <Ionicons name={showNewPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color="#0033A0" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalInputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color="#999" style={styles.modalInputIcon} />
              <TextInput
                style={[styles.modalInput, styles.modalPasswordInput]}
                placeholder="Confirm new password"
                placeholderTextColor="#999"
                value={confirmNewPassword}
                onChangeText={setConfirmNewPassword}
                secureTextEntry={!showConfirmNewPassword}
              />
              <TouchableOpacity style={styles.eyeIcon} onPress={() => setShowConfirmNewPassword(!showConfirmNewPassword)}>
                <Ionicons name={showConfirmNewPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color="#0033A0" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={handleCloseNewPasswordModal}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalConfirmButton]}
                onPress={handleSetNewPassword}
                disabled={updatingPassword}
              >
                {updatingPassword ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalConfirmText}>Update Password</Text>
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
    backgroundColor: '#0033A0', // Changed to Petron blue for gradient effect
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 20,
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
  // Logo Section
  logoContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  logoWrapper: {
    width: 120,
    height: 120,
    borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    borderWidth: 3,
    borderColor: '#ffffff',
  },
  logo: {
    width: 114,
    height: 114,
    borderRadius: 16,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
  },
  // Form Container
  formContainer: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    width: '100%',
    alignSelf: 'center',
    marginVertical: 20,
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
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#0033A0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  loginButtonDisabled: {
    backgroundColor: '#8da2c0',
    shadowOpacity: 0,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  loginButtonIcon: {
    marginLeft: 8,
  },
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
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  registerText: {
    color: '#666',
    fontSize: 14,
  },
  registerLink: {
    color: '#0033A0',
    fontSize: 14,
    fontWeight: 'bold',
  },
  infoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f4ff',
    padding: 8,
    borderRadius: 20,
    marginTop: 8,
  },
  signUpNote: {
    color: '#0033A0',
    fontSize: 11,
    marginLeft: 4,
  },
  // Blocked Message
  blockedMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fdecea',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f5c2c7',
    gap: 8,
  },
  blockedMessageText: {
    color: '#a1201f',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  // Footer
  footer: {
    alignItems: 'center',
  },
  footerText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    marginBottom: 2,
  },
  footerSubtext: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#fff',
    borderRadius: 28,
    padding: 24,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#0033A0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0033A0',
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    lineHeight: 20,
  },
  modalInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
    marginBottom: 20,
  },
  modalInputIcon: {
    marginLeft: 12,
  },
  modalInput: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#333',
  },
  modalPasswordInput: {
    paddingRight: 44,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
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