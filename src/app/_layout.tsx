import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  AppState,
  AppStateStatus,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useCallback, useEffect, useRef, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import AppAlert from '@/components/ui/app-alert';
import { useDatabase } from '../hooks/useDatabase';
import { ThemeProvider, useTheme } from '../hooks/useTheme';
import { AuthService } from '../services/auth.service';
import { SecurityService } from '../services/security.service';

import AnimatedSplash from '@/components/splash/AnimatedSplash';

// Keep the native splash visible until our animated splash is ready.
SplashScreen.preventAutoHideAsync().catch(() => {});

// ------------------------------------------------------------
// App Lock
// ------------------------------------------------------------
function AppLockGuard({
  children,
  onReady,
}: {
  children: React.ReactNode;
  onReady: () => void;
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [isLocked, setIsLocked] = useState(false);

  const appState = useRef<AppStateStatus>(AppState.currentState);
  const authenticating = useRef(false);

  const authenticate = useCallback(async () => {
    if (authenticating.current) return;
    authenticating.current = true;

    try {
      const enabled = await SecurityService.isAppLockEnabled();
      if (!enabled) {
        setIsLocked(false);
        return;
      }
      setIsLocked(true);
      const success = await AuthService.authenticate('Unlock Payment App');
      if (success) setIsLocked(false);
    } catch (error) {
      console.error('App Lock authentication error:', error);
    } finally {
      authenticating.current = false;
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    authenticate();
  }, [authenticate]);

  useEffect(() => {
    if (!isLoading) onReady();
  }, [isLoading, onReady]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextState) => {
      const previousState = appState.current;
      appState.current = nextState;

      const wentToBackground =
        previousState === 'active' &&
        (nextState === 'background' || nextState === 'inactive');

      const returnedToForeground =
        (previousState === 'background' || previousState === 'inactive') &&
        nextState === 'active';

      if (wentToBackground) {
        const enabled = await SecurityService.isAppLockEnabled();
        if (enabled) setIsLocked(true);
      }
      if (returnedToForeground) {
        await authenticate();
      }
    });
    return () => subscription.remove();
  }, [authenticate]);

  if (isLoading || isLocked) {
    return <AppLockScreen isLoading={isLoading} onAuthenticate={authenticate} />;
  }

  return <>{children}</>;
}

function AppLockScreen({
  isLoading,
  onAuthenticate,
}: {
  isLoading: boolean;
  onAuthenticate: () => Promise<void>;
}) {
  return (
    <View style={lockStyles.container}>
      <View style={lockStyles.iconContainer}>
        <Text style={lockStyles.lockIcon}>🔐</Text>
      </View>
      <Text style={lockStyles.title}>Payment App Locked</Text>
      <Text style={lockStyles.message}>Authenticate to continue</Text>
      {!isLoading && (
        <View style={lockStyles.buttonContainer}>
          <Text style={lockStyles.button} onPress={onAuthenticate}>
            Unlock
          </Text>
        </View>
      )}
    </View>
  );
}

// ------------------------------------------------------------
// App Content
// ------------------------------------------------------------
function AppContent({ onReady }: { onReady: () => void }) {
  const { isReady, error } = useDatabase();
  const { colors, isDark } = useTheme();

  useEffect(() => {
    if (error) onReady();
  }, [error, onReady]);

  const alert = {
    visible: false,
    title: '',
    message: '',
    icon: 'info' as const,
  };
  const closeAlert = () => {};

  if (error) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorTitle, { color: colors.danger }]}>
          Database Initialization Error
        </Text>
        <Text style={[styles.errorMessage, { color: colors.textSecondary }]}>
          {error.message}
        </Text>
      </View>
    );
  }

  // Don't return a spinner — the splash is covering this.
  // Just render nothing while DB loads.
  if (!isReady) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AppLockGuard onReady={onReady}>
          <AppAlert
            visible={alert.visible}
            title={alert.title}
            message={alert.message}
            icon={alert.icon}
            onClose={closeAlert}
          />
          <Stack
            screenOptions={{
              animation: 'slide_from_right',
              animationDuration: 240,
              gestureEnabled: true,
              gestureDirection: 'horizontal',
              headerStyle: { backgroundColor: colors.headerBackground },
              headerTintColor: colors.text,
              headerTitleStyle: { fontWeight: '700', fontSize: 18 },
              contentStyle: { backgroundColor: colors.background },
            }}
          >
            <Stack.Screen
              name="(tabs)"
              options={{ headerShown: false, animation: 'fade' }}
            />
            <Stack.Screen
              name="(personal)/quick-add"
              options={{
                presentation: 'modal',
                animation: 'slide_from_bottom',
                animationDuration: 260,
                gestureEnabled: true,
                title: 'Quick Add Expense',
                headerTitleAlign: 'center',
              }}
            />
            <Stack.Screen
              name="(personal)/add-expense"
              options={{
                presentation: 'modal',
                animation: 'slide_from_bottom',
                animationDuration: 260,
                gestureEnabled: true,
                title: 'Add Expense',
                headerTitleAlign: 'center',
              }}
            />
            <Stack.Screen
              name="(personal)/history"
              options={{ title: 'Expense History', animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="(personal)/expense/[id]"
              options={{ title: 'Expense Details', animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="(company)/employee"
              options={{ title: 'Employee Details', animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="(company)/local-conveyance"
              options={{ title: 'Local Conveyance', animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="(company)/outstation-conveyance"
              options={{ title: 'Outstation Conveyance', animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="(company)/hotel"
              options={{ title: 'Hotel Expense', animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="(company)/tour-conveyance"
              options={{ title: 'Tour Conveyance', animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="(company)/phone-expense"
              options={{ title: 'Phone & Fax Expense', animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="(company)/miscellaneous"
              options={{ title: 'Miscellaneous Expense', animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="(company)/daily-allowance"
              options={{ title: 'Daily Allowance', animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="settings/appearance"
              options={{ title: 'Appearance', animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="settings/security"
              options={{ title: 'Security & App Lock', animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="settings/backup"
              options={{ title: 'Backup & Restore', animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="settings/backup-password"
              options={{
                title: 'Create Backup',
                presentation: 'modal',
                animation: 'slide_from_bottom',
                headerTitleAlign: 'center',
              }}
            />
            <Stack.Screen
              name="settings/restore-password"
              options={{
                title: 'Restore Backup',
                presentation: 'modal',
                animation: 'slide_from_bottom',
                headerTitleAlign: 'center',
              }}
            />
            <Stack.Screen
              name="settings/data"
              options={{ title: 'Export & Import', animation: 'slide_from_right' }}
            />
            <Stack.Screen name="crypto-test" options={{ title: 'Crypto Test' }} />
          </Stack>
        </AppLockGuard>
      </GestureHandlerRootView>
    </>
  );
}

// ------------------------------------------------------------
// Root Layout — wraps everything with the Animated Splash overlay
// ------------------------------------------------------------
export default function RootLayout() {
  const [appReady, setAppReady] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const markAppReady = useCallback(() => setAppReady(true), []);
  const finishSplash = useCallback(() => setSplashDone(true), []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppContent onReady={markAppReady} />
        {!splashDone && (
          <AnimatedSplash
            isReady={appReady}
            onFinish={finishSplash}
          />
        )}
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

// ------------------------------------------------------------
// Styles
// ------------------------------------------------------------
const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    fontWeight: '500',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    textAlign: 'center',
  },
});

const lockStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#000',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1f1f1f',
    marginBottom: 24,
  },
  lockIcon: { fontSize: 36 },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  message: { color: '#aaa', fontSize: 15, marginBottom: 28 },
  buttonContainer: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  button: { color: '#000', fontSize: 15, fontWeight: '700' },
});
