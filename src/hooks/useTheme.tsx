import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useColorScheme as useRNColorScheme } from 'react-native';
import { getPreference, setPreference, subscribePreferences } from '../services/preferences.service';

import {
  darkColors,
  lightColors,
  ThemeColors,
} from '../theme/colors';

import { typography } from '../theme/typography';

import {
  borderRadius,
  layout,
  shadows,
  spacing,
} from '../theme/spacing';

export type AppearanceMode = 'light' | 'dark' | 'system';

const APPEARANCE_STORAGE_KEY =
  '@payment_app_appearance';

type ThemeContextValue = {
  colors: ThemeColors;

  isDark: boolean;

  appearanceMode: AppearanceMode;

  setThemeMode: (
    mode: AppearanceMode
  ) => Promise<void>;

  isLoaded: boolean;

  typography: typeof typography;
  spacing: typeof spacing;
  borderRadius: typeof borderRadius;
  shadows: typeof shadows;
  layout: typeof layout;
};

const ThemeContext =
  createContext<ThemeContextValue | undefined>(
    undefined
  );

type ThemeProviderProps = {
  children: React.ReactNode;
};

export function ThemeProvider({
  children,
}: ThemeProviderProps) {
  const systemColorScheme = useRNColorScheme();

  const [appearanceMode, setAppearanceMode] =
    useState<AppearanceMode>('system');

  const [isLoaded, setIsLoaded] =
    useState(false);

  /**
   * Load saved appearance preference
   */
  useEffect(() => {
    async function loadAppearance() {
      try {
        const savedMode =
          await getPreference(
            APPEARANCE_STORAGE_KEY
          );

        if (
          savedMode === 'light' ||
          savedMode === 'dark' ||
          savedMode === 'system'
        ) {
          setAppearanceMode(savedMode);
        } else {
          setAppearanceMode('system');
        }
      } catch (error) {
        console.error(
          'Failed to load appearance preference:',
          error
        );
      } finally {
        setIsLoaded(true);
      }
    }

    loadAppearance();
    return subscribePreferences(() => { void loadAppearance(); });
  }, []);

  /**
   * Change and save appearance preference
   */
  const setThemeMode = useCallback(async (
    mode: AppearanceMode
  ) => {
    try {
      await setPreference(
        APPEARANCE_STORAGE_KEY,
        mode
      );
      setAppearanceMode(mode);
    } catch (error) {
      console.error(
        'Failed to save appearance preference:',
        error
      );
    }
  }, []);

  /**
   * Determine the actual active theme
   */
  const isDark =
    appearanceMode === 'dark' ||
    (
      appearanceMode === 'system' &&
      systemColorScheme === 'dark'
    );

  const colors: ThemeColors = isDark
    ? darkColors
    : lightColors;

  const value = useMemo(
    () => ({
      colors,

      isDark,

      appearanceMode,

      setThemeMode,

      isLoaded,

      typography,
      spacing,
      borderRadius,
      shadows,
      layout,
    }),
    [
      colors,
      isDark,
      appearanceMode,
      isLoaded,
      setThemeMode,
    ]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Access the application theme
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error(
      'useTheme must be used inside ThemeProvider'
    );
  }

  return context;
}