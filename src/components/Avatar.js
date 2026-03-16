// src/components/Avatar.js
import React, { useState } from 'react';
import {
  View,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Animated,
  Easing
} from 'react-native';
import { Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { avatarService } from '../services/avatarService';
import { useAuth } from '../context/AuthContext';
import CustomAlertModal from './CustomAlertModal';

const Avatar = ({ 
  size = 60, 
  avatarUrl,
  onUploadSuccess,
  editable = true,
  showEditButton = true
}) => {
  const { user, profile } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showOptions, setShowOptions] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('preparing'); // preparing, uploading, success, error
  const [showAlert, setShowAlert] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    type: 'warning',
    title: '',
    message: ''
  });

  // Animation values
  const progressAnimation = useState(new Animated.Value(0))[0];
  const rotateAnimation = useState(new Animated.Value(0))[0];

  // Rotate animation for loading
  const startRotateAnimation = () => {
    Animated.loop(
      Animated.timing(rotateAnimation, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  };

  // Progress bar animation
  const animateProgress = (toValue) => {
    Animated.timing(progressAnimation, {
      toValue,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const rotate = rotateAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const handleAvatarPress = async () => {
    if (!editable) return;
    setShowOptions(true);
  };

  const handleChooseFromGallery = async () => {
    setShowOptions(false);
    
    const hasPermission = await avatarService.requestPermissions();
    if (!hasPermission) {
      setAlertConfig({
        type: 'warning',
        title: 'Permission Required',
        message: 'Please grant permission to access your photos.'
      });
      setShowAlert(true);
      return;
    }

    const image = await avatarService.pickImage();
    if (image) {
      await uploadWithProgress(image.uri);
    }
  };

  const handleTakePhoto = async () => {
    setShowOptions(false);
    
    const image = await avatarService.takePhoto();
    if (image) {
      await uploadWithProgress(image.uri);
    }
  };

    const uploadWithProgress = async (uri) => {
    try {
        console.log('📸 STEP 1: Starting upload process for URI:', uri);
        
        // Reset states
        setUploadProgress(0);
        setUploadStatus('preparing');
        setShowUploadModal(true);
        console.log('📸 STEP 2: Upload modal should be visible now');
        
        animateProgress(0);
        startRotateAnimation();

        // Simulate preparation
        console.log('📸 STEP 3: Preparing image...');
        await new Promise(resolve => setTimeout(resolve, 500));
        setUploadStatus('uploading');
        
        // Animate to 30% - preparing
        animateProgress(0.3);
        
        // Simulate processing
        await new Promise(resolve => setTimeout(resolve, 300));
        animateProgress(0.5);

        // Actual upload
        console.log('📸 STEP 4: Calling avatarService.uploadAvatar...');
        setUploading(true);
        
        const publicUrl = await avatarService.uploadAvatar(user.id, uri);
        console.log('📸 STEP 5: Upload successful, URL:', publicUrl);
        
        // Animate to 90% - upload complete
        animateProgress(0.9);
        
        // Simulate finalizing
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Success!
        animateProgress(1);
        setUploadStatus('success');
        
        // Close modal after showing success
        setTimeout(() => {
        console.log('📸 STEP 6: Closing modal and calling onUploadSuccess');
        setShowUploadModal(false);
        if (onUploadSuccess) onUploadSuccess(publicUrl);
        }, 1500);

    } catch (error) {
        console.log('📸 ERROR: Upload failed at step:', error);
        console.log('📸 Error details:', error.message);
        console.log('📸 Full error:', error);
        
        setUploadStatus('error');
        animateProgress(0);
        
        setTimeout(() => {
        setShowUploadModal(false);
        setAlertConfig({
            type: 'error',
            title: 'Upload Failed',
            message: error.message || 'Failed to upload avatar'
        });
        setShowAlert(true);
        }, 1500);
    } finally {
        setUploading(false);
    }
    };

  const handleRemoveAvatar = async () => {
    setShowOptions(false);
    
    Alert.alert(
      'Remove Avatar',
      'Are you sure you want to remove your profile picture?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              setUploading(true);
              setUploadStatus('uploading');
              setShowUploadModal(true);
              animateProgress(0.3);
              
              await avatarService.deleteAvatar(user.id, profile?.avatar_url);
              
              animateProgress(1);
              setUploadStatus('success');
              
              setTimeout(() => {
                setShowUploadModal(false);
                if (onUploadSuccess) onUploadSuccess(null);
              }, 1000);
              
            } catch (error) {
              setUploadStatus('error');
              setTimeout(() => {
                setShowUploadModal(false);
                setAlertConfig({
                  type: 'error',
                  title: 'Error',
                  message: error.message || 'Failed to remove avatar'
                });
                setShowAlert(true);
              }, 1000);
            } finally {
              setUploading(false);
            }
          }
        }
      ]
    );
  };

  const getInitials = () => {
    if (profile?.full_name) {
      return profile.full_name
        .split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return user?.email?.charAt(0)?.toUpperCase() || 'U';
  };

  // Get status message
  const getStatusMessage = () => {
    switch(uploadStatus) {
      case 'preparing':
        return 'Preparing image...';
      case 'uploading':
        return 'Uploading to server...';
      case 'success':
        return 'Upload Successful!';
      case 'error':
        return 'Upload Failed';
      default:
        return 'Processing...';
    }
  };

  // Get status icon
  const getStatusIcon = () => {
    switch(uploadStatus) {
      case 'preparing':
        return <Ionicons name="image-outline" size={40} color="#0033A0" />;
      case 'uploading':
        return (
          <Animated.View style={{ transform: [{ rotate }] }}>
            <Ionicons name="cloud-upload-outline" size={40} color="#0033A0" />
          </Animated.View>
        );
      case 'success':
        return <Ionicons name="checkmark-circle" size={40} color="#10B981" />;
      case 'error':
        return <Ionicons name="close-circle" size={40} color="#EF4444" />;
      default:
        return <Ionicons name="cloud-outline" size={40} color="#0033A0" />;
    }
  };

  return (
    <>
      <TouchableOpacity
        onPress={handleAvatarPress}
        disabled={!editable || uploading}
        activeOpacity={0.7}
      >
        <View style={[styles.container, { width: size, height: size }]}>
          {avatarUrl ? (
            <Image
              source={{ uri: avatarUrl }}
              style={[styles.avatar, { width: size, height: size }]}
            />
          ) : profile?.avatar_url ? (
            <Image
              source={{ uri: profile.avatar_url }}
              style={[styles.avatar, { width: size, height: size }]}
            />
          ) : (
            <View style={[styles.avatar, styles.placeholder, { width: size, height: size }]}>
              <Text style={[styles.initials, { fontSize: size * 0.4 }]}>
                {getInitials()}
              </Text>
            </View>
          )}

          {editable && showEditButton && !uploading && (
            <View style={styles.editBadge}>
              <Ionicons name="camera" size={size * 0.2} color="#fff" />
            </View>
          )}
        </View>
      </TouchableOpacity>

      {/* Options Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showOptions}
        onRequestClose={() => setShowOptions(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowOptions(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Profile Picture</Text>
              <TouchableOpacity onPress={() => setShowOptions(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.optionItem}
              onPress={handleChooseFromGallery}
            >
              <Ionicons name="images" size={24} color="#0033A0" />
              <Text style={styles.optionText}>Choose from Gallery</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.optionItem}
              onPress={handleTakePhoto}
            >
              <Ionicons name="camera" size={24} color="#0033A0" />
              <Text style={styles.optionText}>Take Photo</Text>
            </TouchableOpacity>

            {profile?.avatar_url && (
              <TouchableOpacity
                style={[styles.optionItem, styles.removeOption]}
                onPress={handleRemoveAvatar}
              >
                <Ionicons name="trash" size={24} color="#ED2939" />
                <Text style={[styles.optionText, styles.removeText]}>
                  Remove Current Photo
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Upload Progress Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showUploadModal}
        onRequestClose={() => {}}
      >
        <View style={styles.uploadModalOverlay}>
          <View style={styles.uploadModalContent}>
            <View style={styles.uploadIconContainer}>
              {getStatusIcon()}
            </View>
            
            <Text style={styles.uploadTitle}>
              {getStatusMessage()}
            </Text>
            
            <Text style={styles.uploadSubtitle}>
              {uploadStatus === 'preparing' && 'Please wait...'}
              {uploadStatus === 'uploading' && `${Math.round(progressAnimation.__getValue() * 100)}% complete`}
              {uploadStatus === 'success' && 'Your profile picture has been updated'}
              {uploadStatus === 'error' && 'Please try again'}
            </Text>

            {/* Progress Bar */}
            <View style={styles.progressBarContainer}>
              <Animated.View 
                style={[
                  styles.progressBarFill,
                  {
                    width: progressAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%']
                    }),
                    backgroundColor: uploadStatus === 'error' ? '#EF4444' : '#0033A0'
                  }
                ]} 
              />
            </View>

            {uploadStatus === 'success' && (
              <Text style={styles.successMessage}>✓</Text>
            )}

            {uploadStatus === 'error' && (
              <TouchableOpacity 
                style={styles.retryButton}
                onPress={() => setShowUploadModal(false)}
              >
                <Text style={styles.retryButtonText}>Close</Text>
              </TouchableOpacity>
            )}
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
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  avatar: {
    borderRadius: 999,
    borderWidth: 3,
    borderColor: '#fff',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  placeholder: {
    backgroundColor: '#0033A0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  initials: {
    color: '#fff',
    fontWeight: 'bold',
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#ED2939',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
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
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f4ff',
  },
  optionText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
  removeOption: {
    backgroundColor: '#FFF5F5',
  },
  removeText: {
    color: '#ED2939',
  },
  // Upload Modal Styles
  uploadModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  uploadModalContent: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 30,
    width: '100%',
    maxWidth: 300,
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  uploadIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f0f4ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  uploadTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  uploadSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  progressBarContainer: {
    width: '100%',
    height: 8,
    backgroundColor: '#e9ecef',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  successMessage: {
    fontSize: 40,
    color: '#10B981',
    marginTop: 10,
  },
  retryButton: {
    backgroundColor: '#0033A0',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 10,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default Avatar;