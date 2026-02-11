import React from 'react';
import { StatusBar, Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const SafeAreaWrapper = ({ children, backgroundColor = '#fff', barStyle = 'dark-content' }) => {
  const safeAreaStyle = { flex: 1, backgroundColor };
  
  return (
    <>
      <StatusBar 
        barStyle={barStyle} 
        backgroundColor={barStyle === 'light-content' ? '#0033A0' : backgroundColor}
        translucent={false}
      />
      <SafeAreaView 
        style={safeAreaStyle}
        edges={['right', 'left']} // Only apply to left and right edges, not top/bottom
      >
        {children}
      </SafeAreaView>
    </>
  );
};

export default SafeAreaWrapper;