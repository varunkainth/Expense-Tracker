export const palette = {
  // Brand / Primary
  primary50: '#eef2ff',
  primary100: '#e0e7ff',
  primary200: '#c7d2fe',
  primary400: '#818cf8',
  primary500: '#6366f1',
  primary600: '#4f46e5',
  primary700: '#4338ca',
  primary800: '#3730a3',
  primary900: '#312e81',

  // Emerald / Success (Money & Income)
  success50: '#ecfdf5',
  success100: '#d1fae5',
  success500: '#10b981',
  success600: '#059669',
  success700: '#047857',

  // Rose / Error
  danger50: '#fff1f2',
  danger100: '#ffe4e6',
  danger500: '#f43f5e',
  danger600: '#e11d48',
  danger700: '#be123c',

  // Amber / Warning
  warning50: '#fffbeb',
  warning100: '#fef3c7',
  warning500: '#f59e0b',
  warning600: '#d97706',
  warning700: '#b45309',

  // Blue / Info
  info50: '#eff6ff',
  info100: '#dbeafe',
  info500: '#3b82f6',
  info600: '#2563eb',
  info700: '#1d4ed8',

  // Neutral Slate
  slate50: '#f8fafc',
  slate100: '#f1f5f9',
  slate200: '#e2e8f0',
  slate300: '#cbd5e1',
  slate400: '#94a3b8',
  slate500: '#64748b',
  slate600: '#475569',
  slate700: '#334155',
  slate800: '#1e293b',
  slate900: '#0f172a',
  slate950: '#020617',

  white: '#ffffff',
  black: '#000000',
  transparent: 'transparent',
};

export const lightColors = {
  // Backgrounds
  background: palette.slate50,
  surface: palette.white,
  surfaceElevated: palette.white,
  surfaceVariant: palette.slate100,
  card: palette.white,
  modal: palette.white,

  // Text & Content
  text: palette.slate900,
  textSecondary: palette.slate600,
  textMuted: palette.slate400,
  textInverse: palette.white,

  // Interactive & Accent
  primary: palette.primary600,
  primaryLight: palette.primary100,
  primaryDark: palette.primary800,
  accent: palette.primary500,

  // Status
  success: palette.success600,
  successBackground: palette.success50,
  danger: palette.danger600,
  dangerBackground: palette.danger50,
  warning: palette.warning600,
  warningBackground: palette.warning50,
  info: palette.info600,
  infoBackground: palette.info50,

  // Borders & Dividers
  border: palette.slate200,
  borderFocus: palette.primary600,
  divider: palette.slate200,

  // Icons
  icon: palette.slate700,
  iconSecondary: palette.slate400,

  // Navigation
  tabBarBackground: palette.white,
  tabBarBorder: palette.slate200,
  tabBarActive: palette.primary600,
  tabBarInactive: palette.slate400,
  headerBackground: palette.white,

  // Domain Accents
  personalAccent: '#4f46e5', // Indigo
  companyAccent: '#0d9488',  // Teal
};

export const darkColors: typeof lightColors = {
  // Backgrounds
  background: palette.slate950,
  surface: palette.slate900,
  surfaceElevated: palette.slate800,
  surfaceVariant: '#1e293b',
  card: palette.slate900,
  modal: palette.slate900,

  // Text & Content
  text: palette.slate50,
  textSecondary: palette.slate300,
  textMuted: palette.slate500,
  textInverse: palette.slate950,

  // Interactive & Accent
  primary: palette.primary400,
  primaryLight: '#312e81',
  primaryDark: palette.primary200,
  accent: palette.primary400,

  // Status
  success: palette.success500,
  successBackground: '#064e3b',
  danger: palette.danger500,
  dangerBackground: '#4c0519',
  warning: palette.warning500,
  warningBackground: '#451a03',
  info: palette.info500,
  infoBackground: '#172554',

  // Borders & Dividers
  border: palette.slate800,
  borderFocus: palette.primary400,
  divider: palette.slate800,

  // Icons
  icon: palette.slate200,
  iconSecondary: palette.slate500,

  // Navigation
  tabBarBackground: palette.slate900,
  tabBarBorder: palette.slate800,
  tabBarActive: palette.primary400,
  tabBarInactive: palette.slate500,
  headerBackground: palette.slate900,

  // Domain Accents
  personalAccent: '#818cf8',
  companyAccent: '#2dd4bf',
};

export type ThemeColors = typeof lightColors;
