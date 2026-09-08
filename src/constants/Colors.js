export const lightColors = {
  // Brand
  primary: '#0033A0', // Petron Blue - Primary brand color
  secondary: '#ED2939', // Petron Red - Secondary/Action color
  accent: '#ED2939',
  
  // Status colors
  warning: '#F59E0B',
  danger: '#EF4444',
  success: '#10B981',
  
  // Backgrounds & Surfaces
  background: '#f8f9fa',
  cardBackground: '#ffffff',
  surface: '#ffffff',
  surfaceElevated: '#ffffff',
  
  // Text colors
  text: {
    primary: '#333333',
    secondary: '#666666',
    tertiary: '#999999',
    light: '#ffffff',
  },
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  
  // Borders & Dividers
  border: '#e9ecef',
  divider: '#f1f5f9',
  shadow: '#000000',

  // Status Bar
  statusBarStyle: 'light-content',
  statusBarBg: '#0033A0',
};

export const darkColors = {
  // Brand
  primary: '#3B82F6', // High-contrast blue for dark slate
  secondary: '#F87171',
  accent: '#60A5FA',
  
  // Status colors
  warning: '#FBBF24',
  danger: '#F87171',
  success: '#34D399',
  
  // Backgrounds & Surfaces
  background: '#0F172A', // Slate 900
  cardBackground: '#1E293B', // Slate 800
  surface: '#1E293B',
  surfaceElevated: '#334155', // Slate 700
  
  // Text colors
  text: {
    primary: '#F8FAFC',
    secondary: '#CBD5E1',
    tertiary: '#94A3B8',
    light: '#ffffff',
  },
  textPrimary: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  
  // Borders & Dividers
  border: '#334155',
  divider: '#1E293B',
  shadow: '#000000',

  // Status Bar
  statusBarStyle: 'light-content',
  statusBarBg: '#0F172A',
};

export const getThemeColors = (isDarkMode) => (isDarkMode ? darkColors : lightColors);

export default lightColors;