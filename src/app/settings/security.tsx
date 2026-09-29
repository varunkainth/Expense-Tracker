import { MaterialIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SecurityService } from '../../services/security.service';

import AppAlert from '../../components/ui/app-alert';
import { useTheme } from '../../hooks/useTheme';
import { AuthService } from '../../services/auth.service';

export default function SecurityScreen() {
  const { colors, spacing, borderRadius, shadows } = useTheme();

  // -----------------------------------------
  // Device / Security State
  // -----------------------------------------

  const [hasHardware, setHasHardware] = useState(false);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [appLockEnabled, setAppLockEnabled] = useState(false);

  // -----------------------------------------
  // Alert State
  // -----------------------------------------

  const [alert, setAlert] = useState({
    visible: false,
    title: '',
    message: '',
    icon: '🔐',
  });

  // -----------------------------------------
  // Show Custom Alert
  // -----------------------------------------

  const showAlert = (
    title: string,
    message: string,
    icon = '🔐',
  ) => {
    setAlert({
      visible: true,
      title,
      message,
      icon,
    });
  };

  // -----------------------------------------
  // Close Custom Alert
  // -----------------------------------------

  const closeAlert = () => {
    setAlert((prev) => ({
      ...prev,
      visible: false,
    }));
  };

  // -----------------------------------------
  // Check Device Biometrics
  // -----------------------------------------

useEffect(() => {
  async function loadSecurityState() {
    try {
      const [hardware, enrolled, lockEnabled] =
        await Promise.all([
          AuthService.hasHardwareSupport(),
          AuthService.isEnrolled(),
          SecurityService.isAppLockEnabled(),
        ]);

      setHasHardware(hardware);
      setIsEnrolled(enrolled);
      setAppLockEnabled(lockEnabled);
    } catch (error) {
      console.error(
        'Error loading security state:',
        error,
      );

      showAlert(
        'Security Check Failed',
        'We could not load your security settings. Please try again.',
        '⚠️',
      );
    }
  }

  loadSecurityState();
}, []);

  // -----------------------------------------
  // Toggle App Lock
  // -----------------------------------------

  const handleToggleLock = async (value: boolean) => {
    // ---------------------------------------
    // Enable App Lock
    // ---------------------------------------

    if (value) {
      // Check biometric hardware
      if (!hasHardware) {
        showAlert(
          'Biometrics Unavailable',
          'Your device does not support biometric authentication.',
          '⚠️',
        );

        return;
      }

      // Check biometric enrollment
      if (!isEnrolled) {
        showAlert(
          'Biometrics Not Set Up',
          'Please enroll a fingerprint or Face ID on your device before enabling App Lock.',
          '👆',
        );

        return;
      }

      try {
        // Ask the user to verify identity
        const success =
          await AuthService.authenticate(
            'Confirm biometrics to enable App Lock',
          );

        // -----------------------------------
        // Authentication Successful
        // -----------------------------------

       if (success) {
  await SecurityService.setAppLockEnabled(true);

  setAppLockEnabled(true);

  showAlert(
    'App Lock Enabled',
    'Your Payment App is now protected. You will need to verify your identity when opening the app.',
    '🔐',
  );
}

        // -----------------------------------
        // Authentication Failed
        // -----------------------------------

        else {
          await SecurityService.setAppLockEnabled(false);

setAppLockEnabled(false);

          showAlert(
            'Verification Failed',
            'Your identity could not be verified. App Lock has not been enabled.',
            '❌',
          );
        }
      } catch (error) {
        console.error(
          'Error enabling App Lock:',
          error,
        );

        setAppLockEnabled(false);

        showAlert(
          'Authentication Error',
          'Something went wrong while verifying your identity. Please try again.',
          '⚠️',
        );
      }

      return;
    }


// ---------------------------------------
// Disable App Lock — verify identity first
// ---------------------------------------

try {
  const success = await AuthService.authenticate(
    'Confirm biometrics to disable App Lock',
  );

  if (!success) {
    // Keep the switch ON — auth failed or cancelled
    setAppLockEnabled(true);

    showAlert(
      'Verification Failed',
      'Your identity could not be verified. App Lock is still enabled.',
      '❌',
    );

    return;
  }

  await SecurityService.setAppLockEnabled(false);
  setAppLockEnabled(false);

  showAlert(
    'App Lock Disabled',
    'The app will no longer require authentication when it starts.',
    '🔓',
  );
} catch (error) {
  console.error('Error disabling App Lock:', error);

  // Important: revert the switch, don't leave it half-off
  setAppLockEnabled(true);

  showAlert(
    'Error',
    'Something went wrong. App Lock is still enabled.',
    '⚠️',
  );
}
  };

  // -----------------------------------------
  // UI
  // -----------------------------------------

  return (
    <SafeAreaView
      edges={['bottom', 'left', 'right']}
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
        },
      ]}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            padding: spacing.base,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* -------------------------------- */}
        {/* Device Protection */}
        {/* -------------------------------- */}

        <Text
          style={[
            styles.sectionTitle,
            {
              color: colors.textSecondary,
            },
          ]}
        >
          Device Protection
        </Text>

        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: borderRadius.lg,
              ...shadows.sm,
            },
          ]}
        >
          <View style={styles.optionRow}>
            {/* Icon */}

            <View
              style={[
                styles.iconCircle,
                {
                  backgroundColor: '#10b98120',
                },
              ]}
            >
              <MaterialIcons
                name="fingerprint"
                size={24}
                color="#10b981"
              />
            </View>

            {/* Text */}

            <View style={styles.optionTextContainer}>
              <Text
                style={[
                  styles.optionTitle,
                  {
                    color: colors.text,
                  },
                ]}
              >
                App Lock
              </Text>

              <Text
                style={[
                  styles.optionDesc,
                  {
                    color: colors.textSecondary,
                  },
                ]}
              >
                Require Fingerprint / Face ID / Device
                authentication to open the app
              </Text>
            </View>

            {/* Switch */}

            <Switch
              value={appLockEnabled}
              onValueChange={handleToggleLock}
              trackColor={{
                false: colors.border,
                true: colors.primary,
              }}
              thumbColor="#ffffff"
            />
          </View>
        </View>

        {/* -------------------------------- */}
        {/* Security Status */}
        {/* -------------------------------- */}

        <View
          style={[
            styles.statusBox,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: borderRadius.lg,
            },
          ]}
        >
          <Text
            style={[
              styles.statusTitle,
              {
                color: colors.text,
              },
            ]}
          >
            Biometric Hardware Status
          </Text>

          {/* Hardware */}

          <View style={styles.statusRow}>
            <MaterialIcons
              name={
                hasHardware
                  ? 'check-circle'
                  : 'cancel'
              }
              size={18}
              color={
                hasHardware
                  ? '#10b981'
                  : colors.danger
              }
            />

            <Text
              style={[
                styles.statusDesc,
                {
                  color: colors.textSecondary,
                },
              ]}
            >
              Hardware Support:{' '}
              {hasHardware
                ? 'Available'
                : 'Not detected'}
            </Text>
          </View>

          {/* Enrollment */}

          <View style={styles.statusRow}>
            <MaterialIcons
              name={
                isEnrolled
                  ? 'check-circle'
                  : 'cancel'
              }
              size={18}
              color={
                isEnrolled
                  ? '#10b981'
                  : colors.danger
              }
            />

            <Text
              style={[
                styles.statusDesc,
                {
                  color: colors.textSecondary,
                },
              ]}
            >
              Biometrics:{' '}
              {isEnrolled
                ? 'Enrolled'
                : 'Not enrolled'}
            </Text>
          </View>

          {/* App Lock */}

          <View style={styles.statusRow}>
            <MaterialIcons
              name={
                appLockEnabled
                  ? 'lock'
                  : 'lock-open'
              }
              size={18}
              color={
                appLockEnabled
                  ? colors.primary
                  : colors.textSecondary
              }
            />

            <Text
              style={[
                styles.statusDesc,
                {
                  color: colors.textSecondary,
                },
              ]}
            >
              App Lock:{' '}
              {appLockEnabled
                ? 'Enabled'
                : 'Disabled'}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* -------------------------------- */}
      {/* Custom Alert */}
      {/* -------------------------------- */}

      <AppAlert
        visible={alert.visible}
        title={alert.title}
        message={alert.message}
        onClose={closeAlert}
      />
    </SafeAreaView>
  );
}

// =========================================
// Styles
// =========================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  scrollContent: {
    paddingBottom: 32,
  },

  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },

  card: {
    borderWidth: 1,
    overflow: 'hidden',
  },

  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },

  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },

  optionTextContainer: {
    flex: 1,
    paddingRight: 8,
  },

  optionTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 3,
  },

  optionDesc: {
    fontSize: 12,
    lineHeight: 18,
  },

  statusBox: {
    marginTop: 24,
    padding: 16,
    borderWidth: 1,
    gap: 10,
  },

  statusTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },

  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  statusDesc: {
    fontSize: 13,
  },
});