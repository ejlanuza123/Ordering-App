import { DefaultTheme, DarkTheme } from '@react-navigation/native';

export const createNavigationTheme = (isDarkMode, colors) => {
  const baseNavigationTheme = isDarkMode ? DarkTheme : DefaultTheme;

  return {
    ...baseNavigationTheme,
    dark: isDarkMode,
    colors: {
      ...baseNavigationTheme.colors,
      primary: colors?.primary || baseNavigationTheme.colors.primary,
      background: colors?.background || baseNavigationTheme.colors.background,
      card: colors?.surface || baseNavigationTheme.colors.card,
      text: colors?.textPrimary || baseNavigationTheme.colors.text,
      border: colors?.border || baseNavigationTheme.colors.border,
      notification: colors?.secondary || baseNavigationTheme.colors.notification,
    },
    fonts: baseNavigationTheme.fonts || {
      regular: { fontFamily: 'System', fontWeight: '400' },
      medium: { fontFamily: 'System', fontWeight: '500' },
      bold: { fontFamily: 'System', fontWeight: '600' },
      heavy: { fontFamily: 'System', fontWeight: '700' },
    },
  };
};

export default createNavigationTheme;
