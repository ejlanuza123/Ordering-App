import React from 'react';
import { render, act, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ReactNative from 'react-native';

const mockStorageState = {
  store: {},
};

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (key) => (key in mockStorageState.store ? mockStorageState.store[key] : null)),
    setItem: jest.fn(async (key, value) => { mockStorageState.store[key] = String(value); }),
    removeItem: jest.fn(async (key) => { delete mockStorageState.store[key]; }),
    clear: jest.fn(async () => { mockStorageState.store = {}; }),
  },
  getItem: jest.fn(async (key) => (key in mockStorageState.store ? mockStorageState.store[key] : null)),
  setItem: jest.fn(async (key, value) => { mockStorageState.store[key] = String(value); }),
  removeItem: jest.fn(async (key) => { delete mockStorageState.store[key]; }),
  clear: jest.fn(async () => { mockStorageState.store = {}; }),
}));

import { ThemeProvider, useTheme, THEME_STORAGE_KEY } from '../../context/ThemeContext';
import { lightColors, darkColors } from '../../constants/Colors';

describe('ThemeContext', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockStorageState.store = {};
  });

  const TestConsumer = ({ onRender }) => {
    const theme = useTheme();
    onRender(theme);
    return null;
  };

  it('provides light theme by default when system color scheme is light', async () => {
    jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue('light');
    let capturedTheme;

    render(
      <ThemeProvider>
        <TestConsumer onRender={(t) => { capturedTheme = t; }} />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(capturedTheme.isThemeLoading).toBe(false);
    });

    expect(capturedTheme.isDarkMode).toBe(false);
    expect(capturedTheme.themeMode).toBe('system');
    expect(capturedTheme.colors.background).toBe(lightColors.background);
    expect(capturedTheme.colors.surface).toBe(lightColors.surface);
  });

  it('provides dark theme by default when system color scheme is dark', async () => {
    jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue('dark');
    let capturedTheme;

    render(
      <ThemeProvider>
        <TestConsumer onRender={(t) => { capturedTheme = t; }} />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(capturedTheme.isThemeLoading).toBe(false);
    });

    expect(capturedTheme.isDarkMode).toBe(true);
    expect(capturedTheme.themeMode).toBe('system');
    expect(capturedTheme.colors.background).toBe(darkColors.background);
    expect(capturedTheme.colors.surface).toBe(darkColors.surface);
  });

  it('toggles theme between dark and light', async () => {
    jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue('light');
    let capturedTheme;

    render(
      <ThemeProvider>
        <TestConsumer onRender={(t) => { capturedTheme = t; }} />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(capturedTheme.isThemeLoading).toBe(false);
    });

    expect(capturedTheme.isDarkMode).toBe(false);

    // Toggle to dark
    await act(async () => {
      capturedTheme.toggleTheme();
    });

    expect(capturedTheme.isDarkMode).toBe(true);
    expect(capturedTheme.themeMode).toBe('dark');
    expect(capturedTheme.colors.background).toBe(darkColors.background);
    expect(await AsyncStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');

    // Toggle back to light
    await act(async () => {
      capturedTheme.toggleTheme();
    });

    expect(capturedTheme.isDarkMode).toBe(false);
    expect(capturedTheme.themeMode).toBe('light');
    expect(capturedTheme.colors.background).toBe(lightColors.background);
    expect(await AsyncStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('sets explicit theme mode and persists to AsyncStorage', async () => {
    let capturedTheme;

    render(
      <ThemeProvider>
        <TestConsumer onRender={(t) => { capturedTheme = t; }} />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(capturedTheme.isThemeLoading).toBe(false);
    });

    await act(async () => {
      await capturedTheme.setThemeMode('dark');
    });

    expect(capturedTheme.themeMode).toBe('dark');
    expect(capturedTheme.isDarkMode).toBe(true);
    expect(await AsyncStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');

    await act(async () => {
      await capturedTheme.setThemeMode('system');
    });

    expect(capturedTheme.themeMode).toBe('system');
    expect(await AsyncStorage.getItem(THEME_STORAGE_KEY)).toBe('system');
  });

  it('ignores invalid theme modes', async () => {
    let capturedTheme;

    render(
      <ThemeProvider>
        <TestConsumer onRender={(t) => { capturedTheme = t; }} />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(capturedTheme.isThemeLoading).toBe(false);
    });

    await act(async () => {
      await capturedTheme.setThemeMode('invalid_mode');
    });

    expect(capturedTheme.themeMode).toBe('system');
  });

  it('rehydrates persisted theme mode from AsyncStorage on mount', async () => {
    mockStorageState.store[THEME_STORAGE_KEY] = 'dark';
    let capturedTheme;

    render(
      <ThemeProvider>
        <TestConsumer onRender={(t) => { capturedTheme = t; }} />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(capturedTheme.themeMode).toBe('dark');
      expect(capturedTheme.isDarkMode).toBe(true);
      expect(capturedTheme.isThemeLoading).toBe(false);
    });
  });

  it('provides safe fallback when useTheme is called outside provider', () => {
    let capturedTheme;
    render(<TestConsumer onRender={(t) => { capturedTheme = t; }} />);

    expect(capturedTheme.isDarkMode).toBe(false);
    expect(capturedTheme.themeMode).toBe('system');
    expect(capturedTheme.colors).toBeDefined();
    expect(capturedTheme.colors.primary).toBe(lightColors.primary);
  });
});
