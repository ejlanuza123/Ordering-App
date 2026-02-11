import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const Header = ({ 
  title, 
  subtitle, 
  showBackButton = true, 
  onBackPress, 
  rightComponent,
  backgroundColor = '#fff'
}) => {
  const insets = useSafeAreaInsets();
  
  const getStatusBarHeight = () => {
    return Platform.OS === 'ios' ? insets.top : StatusBar.currentHeight || 0;
  };

  return (
    <View style={[
      styles.container,
      { 
        backgroundColor,
        paddingTop: getStatusBarHeight() + 15,
      }
    ]}>
      <View style={styles.content}>
        {showBackButton && (
          <TouchableOpacity 
            onPress={onBackPress}
            style={styles.backButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={24} color="#0033A0" />
          </TouchableOpacity>
        )}
        
        <View style={[
          styles.titleContainer,
          { marginLeft: showBackButton ? 0 : 16 }
        ]}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {subtitle && (
            <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
          )}
        </View>
        
        {rightComponent && (
          <View style={styles.rightContainer}>
            {rightComponent}
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    zIndex: 1000,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f4ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  titleContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0033A0',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  rightContainer: {
    marginLeft: 12,
  },
});