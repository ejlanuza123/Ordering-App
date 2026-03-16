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
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { avatarService } from '../services/avatarService';
import { useAuth } from '../context/AuthContext';
import CustomAlertModal from './CustomAlertModal';

const Avatar = ({ 
  size = 60, 
  onUploadSuccess,
  editable = true,
  showEditButton = true
}) => {
  const { user, profile, updateProfile } = useAuth(); // Assuming you have updateProfile
  const [uploading, setUploading] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    type: 'warning',
    title: '',
    message: ''
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
      await uploadAvatar(image.uri);
    }
  };

  const handleTakePhoto = async () => {
    setShowOptions(false);
    
    const image = await avatarService.takePhoto();
    if (image) {
      await uploadAvatar(image.uri);
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
              await avatarService.deleteAvatar(user.id, profile?.avatar_url);
              if (onUploadSuccess) onUploadSuccess(null);
            } catch (error) {
              setAlertConfig({
                type: 'error',
                title: 'Error',
                message: 'Failed to remove avatar'
              });
              setShowAlert(true);
            } finally {
              setUploading(false);
            }
          }
        }
      ]
    );
  };

  const uploadAvatar = async (uri) => {
    try {
      setUploading(true);
      const publicUrl = await avatarService.uploadAvatar(user.id, uri);
      if (onUploadSuccess) onUploadSuccess(publicUrl);
    } catch (error) {
      setAlertConfig({
        type: 'error',
        title: 'Upload Failed',
        message: error.message || 'Failed to upload avatar'
      });
      setShowAlert(true);
    } finally {
      setUploading(false);
    }
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

  return (
    <>
      <TouchableOpacity
        onPress={handleAvatarPress}
        disabled={!editable || uploading}
        activeOpacity={0.7}
      >
        <View style={[styles.container, { width: size, height: size }]}>
          {uploading ? (
            <View style={[styles.avatar, { backgroundColor: '#f0f4ff' }]}>
              <ActivityIndicator size="small" color="#0033A0" />
            </View>
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
});

export default Avatar;