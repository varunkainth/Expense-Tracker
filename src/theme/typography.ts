import { TextStyle } from 'react-native';

export const typography = {
  fontSizes: {
    xs: 11,
    sm: 13,
    base: 15,
    md: 17,
    lg: 20,
    xl: 24,
    '2xl': 30,
    '3xl': 36,
    '4xl': 44,
  },
  lineHeights: {
    xs: 14,
    sm: 18,
    base: 22,
    md: 24,
    lg: 28,
    xl: 32,
    '2xl': 38,
    '3xl': 44,
    '4xl': 52,
  },
  fontWeights: {
    regular: '400' as TextStyle['fontWeight'],
    medium: '500' as TextStyle['fontWeight'],
    semibold: '600' as TextStyle['fontWeight'],
    bold: '700' as TextStyle['fontWeight'],
    heavy: '800' as TextStyle['fontWeight'],
  },
  styles: {
    heroAmount: {
      fontSize: 36,
      lineHeight: 44,
      fontWeight: '700',
      letterSpacing: -0.5,
    } as TextStyle,
    h1: {
      fontSize: 28,
      lineHeight: 34,
      fontWeight: '700',
      letterSpacing: -0.3,
    } as TextStyle,
    h2: {
      fontSize: 22,
      lineHeight: 28,
      fontWeight: '600',
    } as TextStyle,
    h3: {
      fontSize: 18,
      lineHeight: 24,
      fontWeight: '600',
    } as TextStyle,
    body: {
      fontSize: 15,
      lineHeight: 22,
      fontWeight: '400',
    } as TextStyle,
    bodyMedium: {
      fontSize: 15,
      lineHeight: 22,
      fontWeight: '500',
    } as TextStyle,
    caption: {
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '400',
    } as TextStyle,
    captionMedium: {
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '500',
    } as TextStyle,
    button: {
      fontSize: 16,
      lineHeight: 22,
      fontWeight: '600',
    } as TextStyle,
    tabLabel: {
      fontSize: 11,
      lineHeight: 14,
      fontWeight: '600',
    } as TextStyle,
  },
};
