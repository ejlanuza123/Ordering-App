process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://mock.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'mock-anon-key';

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    channel: jest.fn(),
  },
}));

jest.mock('react-native-webview', () => {
  const { View } = require('react-native');
  return {
    WebView: View,
  };
});

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: null, loading: false, role: 'customer' }),
}));

import { createNavigationTheme } from '../../navigation/navigationTheme';
import { lightColors, darkColors } from '../../constants/Colors';

describe('AppNavigator createNavigationTheme', () => {
  it('includes valid fonts definition in light mode to prevent Cannot read property regular of undefined', () => {
    const theme = createNavigationTheme(false, lightColors);

    expect(theme).toBeDefined();
    expect(theme.dark).toBe(false);
    expect(theme.fonts).toBeDefined();
    expect(theme.fonts.regular).toBeDefined();
    expect(typeof theme.fonts.regular).toBe('object');
    expect(theme.fonts.regular.fontFamily).toBeDefined();
    expect(theme.fonts.regular.fontWeight).toBeDefined();

    expect(theme.colors.primary).toBe(lightColors.primary);
    expect(theme.colors.background).toBe(lightColors.background);
    expect(theme.colors.card).toBe(lightColors.surface);
  });

  it('includes valid fonts definition in dark mode to prevent Cannot read property regular of undefined', () => {
    const theme = createNavigationTheme(true, darkColors);

    expect(theme).toBeDefined();
    expect(theme.dark).toBe(true);
    expect(theme.fonts).toBeDefined();
    expect(theme.fonts.regular).toBeDefined();
    expect(typeof theme.fonts.regular).toBe('object');
    expect(theme.fonts.regular.fontFamily).toBeDefined();
    expect(theme.fonts.regular.fontWeight).toBeDefined();

    expect(theme.colors.primary).toBe(darkColors.primary);
    expect(theme.colors.background).toBe(darkColors.background);
    expect(theme.colors.card).toBe(darkColors.surface);
  });

  it('gracefully handles empty or missing colors without throwing', () => {
    const theme = createNavigationTheme(false, null);

    expect(theme).toBeDefined();
    expect(theme.fonts).toBeDefined();
    expect(theme.fonts.regular).toBeDefined();
    expect(theme.colors).toBeDefined();
    expect(theme.colors.primary).toBeDefined();
  });

  it('is properly exported from AppNavigator as well as navigationTheme', () => {
    const { createNavigationTheme: exportedFromNavigator } = require('../../navigation/AppNavigator');
    expect(exportedFromNavigator).toBeDefined();
    expect(exportedFromNavigator).toBe(createNavigationTheme);
  });
});
