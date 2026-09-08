// src/context/ThemeContext.js
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightColors, darkColors, getThemeColors } from '../constants/Colors';

export const THEME_STORAGE_KEY = '@app_theme_mode';

export const ThemeContext = createContext({
  isDarkMode: false,
  themeMode: 'system', // 'system' | 'light' | 'dark'
  colors: lightColors,
  setThemeMode: async () => {},
  toggleTheme: async () => {},
  isThemeLoading: true,
});

export const ThemeProvider = ({ children }) => {
  const systemColorScheme = useColorScheme(); // 'light' | 'dark' | null / undefined
  const [themeMode, setThemeModeState] = useState('system');
  const [isThemeLoading, setIsThemeLoading] = useState(true);

  // Load saved preference on startup
  useEffect(() => {
    let isMounted = true;

    const loadPersistedTheme = async () => {
      try {
        const savedMode = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (isMounted && savedMode && ['system', 'light', 'dark'].includes(savedMode)) {
          setThemeModeState(savedMode);
        }
      } catch (err) {
        console.warn('Failed to load theme preference from AsyncStorage:', err?.message || err);
      } finally {
        if (isMounted) {
          setIsThemeLoading(false);
        }
      }
    };

    loadPersistedTheme();

    return () => {
      isMounted = false;
    };
  }, []);

  const setThemeMode = useCallback(async (mode) => {
    if (!['system', 'light', 'dark'].includes(mode)) return;
    setThemeModeState(mode);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch (err) {
      console.warn('Failed to persist theme preference:', err?.message || err);
    }
  }, []);

  // Compute active dark mode state
  const isDarkMode =
    themeMode === 'system'
      ? systemColorScheme === 'dark'
      : themeMode === 'dark';

  const colors = getThemeColors(isDarkMode);

  const toggleTheme = useCallback(() => {
    const nextMode = isDarkMode ? 'light' : 'dark';
    setThemeMode(nextMode);
  }, [isDarkMode, setThemeMode]);

  const value = {
    isDarkMode,
    themeMode,
    colors,
    setThemeMode,
    toggleTheme,
    isThemeLoading,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    return {
      isDarkMode: false,
      themeMode: 'system',
      colors: lightColors,
      setThemeMode: async () => {},
      toggleTheme: async () => {},
      isThemeLoading: false,
    };
  }
  return context;
};
