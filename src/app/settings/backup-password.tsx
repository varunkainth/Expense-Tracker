import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { useTheme } from '../../hooks/useTheme';
import { createAndSaveBackup } from '../../services/backup.service';

export default function BackupPasswordScreen() {
  const { colors, spacing, borderRadius, shadows } =
    useTheme();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] =
    useState('');

  const [showPassword, setShowPassword] =
    useState(false);

  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [isCreating, setIsCreating] =
    useState(false);

  const handleCreateBackup = async () => {
    if (isCreating) {
      return;
    }

    if (!password) {
      Alert.alert(
        'Password Required',
        'Please enter a backup password.',
      );
      return;
    }

    if (password.length < 8) {
      Alert.alert(
        'Password Too Short',
        'Your backup password must be at least 8 characters long.',
      );
      return;
    }

    if (!confirmPassword) {
      Alert.alert(
        'Confirm Password',
        'Please confirm your backup password.',
      );
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert(
        'Passwords Do Not Match',
        'Please make sure both passwords are the same.',
      );
      return;
    }

    try {
      setIsCreating(true);

      const result = await createAndSaveBackup(password);
      const attachmentLabel = result.summary.attachmentCount === 1
        ? '1 receipt attachment'
        : `${result.summary.attachmentCount} receipt attachments`;

      Alert.alert(
        'Backup Created',
        `The encrypted backup was saved with ${result.summary.recordCount} records and ${attachmentLabel}.`,
        [
          {
            text: 'Done',
            onPress: () => router.back(),
          },
        ],
      );
    } catch (error) {
      console.error(
        'Backup creation failed:',
        error,
      );

      const message =
        error instanceof Error
          ? error.message
          : 'Unable to create backup.';

      Alert.alert(
        'Backup Failed',
        message,
      );
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
        },
      ]}
      behavior={
        Platform.OS === 'ios'
          ? 'padding'
          : undefined
      }
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            padding: spacing.base,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <View
            style={[
              styles.iconContainer,
              {
                backgroundColor:
                  colors.surfaceVariant,
              },
            ]}
          >
            <MaterialIcons
              name="lock"
              size={30}
              color={colors.text}
            />
          </View>

          <Text
            style={[
              styles.title,
              {
                color: colors.text,
              },
            ]}
          >
            Create Backup Password
          </Text>

          <Text
            style={[
              styles.subtitle,
              {
                color: colors.textSecondary,
              },
            ]}
          >
            Your backup will be encrypted with this
            password before it is saved.
          </Text>
        </View>

        {/* Password Card */}
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
          {/* Password */}
          <Text
            style={[
              styles.label,
              {
                color: colors.text,
              },
            ]}
          >
            Backup Password
          </Text>

          <View
            style={[
              styles.inputContainer,
              {
                backgroundColor:
                  colors.surfaceVariant,
                borderColor: colors.border,
                borderRadius:
                  borderRadius.md,
              },
            ]}
          >
            <MaterialIcons
              name="lock-outline"
              size={21}
              color={colors.textSecondary}
            />

            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Enter password"
              placeholderTextColor={
                colors.textMuted
              }
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="newPassword"
              style={[
                styles.input,
                {
                  color: colors.text,
                },
              ]}
              editable={!isCreating}
            />

            <Pressable
              onPress={() =>
                setShowPassword(
                  (value) => !value,
                )
              }
              hitSlop={10}
            >
              <MaterialIcons
                name={
                  showPassword
                    ? 'visibility-off'
                    : 'visibility'
                }
                size={21}
                color={colors.textSecondary}
              />
            </Pressable>
          </View>

          {/* Password Hint */}
          <Text
            style={[
              styles.hint,
              {
                color: colors.textMuted,
              },
            ]}
          >
            Minimum 8 characters.
          </Text>

          {/* Confirm Password */}
          <Text
            style={[
              styles.label,
              styles.confirmLabel,
              {
                color: colors.text,
              },
            ]}
          >
            Confirm Password
          </Text>

          <View
            style={[
              styles.inputContainer,
              {
                backgroundColor:
                  colors.surfaceVariant,
                borderColor: colors.border,
                borderRadius:
                  borderRadius.md,
              },
            ]}
          >
            <MaterialIcons
              name="lock-outline"
              size={21}
              color={colors.textSecondary}
            />

            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm password"
              placeholderTextColor={
                colors.textMuted
              }
              secureTextEntry={
                !showConfirmPassword
              }
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="newPassword"
              style={[
                styles.input,
                {
                  color: colors.text,
                },
              ]}
              editable={!isCreating}
            />

            <Pressable
              onPress={() =>
                setShowConfirmPassword(
                  (value) => !value,
                )
              }
              hitSlop={10}
            >
              <MaterialIcons
                name={
                  showConfirmPassword
                    ? 'visibility-off'
                    : 'visibility'
                }
                size={21}
                color={colors.textSecondary}
              />
            </Pressable>
          </View>
        </View>

        {/* Security Warning */}
        <View
          style={[
            styles.warning,
            {
              backgroundColor:
                colors.surfaceVariant,
              borderRadius: borderRadius.md,
            },
          ]}
        >
          <MaterialIcons
            name="warning"
            size={22}
            color={colors.textSecondary}
          />

          <Text
            style={[
              styles.warningText,
              {
                color: colors.textSecondary,
              },
            ]}
          >
            Keep this password safe. The Payment App
            does not store your backup password. If
            you forget it, the encrypted backup cannot
            be recovered.
          </Text>
        </View>

        {/* Create Button */}
        <Pressable
          onPress={handleCreateBackup}
          disabled={isCreating}
          style={({ pressed }) => [
            styles.createButton,
            {
              backgroundColor: colors.primary,
              borderRadius: borderRadius.md,
            },
            pressed &&
              !isCreating &&
              styles.buttonPressed,
            isCreating &&
              styles.buttonDisabled,
          ]}
        >
          {isCreating ? (
            <Text
              style={styles.createButtonText}
            >
              Creating Backup...
            </Text>
          ) : (
            <>
              <MaterialIcons
                name="backup"
                size={21}
                color="#ffffff"
              />

              <Text
                style={styles.createButtonText}
              >
                Create Encrypted Backup
              </Text>
            </>
          )}
        </Pressable>

        {/* Cancel */}
        <Pressable
          onPress={() => router.back()}
          disabled={isCreating}
          style={styles.cancelButton}
        >
          <Text
            style={[
              styles.cancelText,
              {
                color: colors.textSecondary,
              },
            ]}
          >
            Cancel
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  content: {
    flexGrow: 1,
    paddingBottom: 40,
  },

  header: {
    alignItems: 'center',
    marginBottom: 28,
  },

  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },

  title: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },

  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    maxWidth: 340,
  },

  card: {
    borderWidth: 1,
    padding: 18,
    marginBottom: 16,
  },

  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },

  confirmLabel: {
    marginTop: 20,
  },

  inputContainer: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderWidth: 1,
  },

  input: {
    flex: 1,
    fontSize: 16,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },

  hint: {
    fontSize: 12,
    marginTop: 6,
  },

  warning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    marginBottom: 24,
    gap: 10,
  },

  warningText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },

  createButton: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 20,
  },

  createButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },

  buttonPressed: {
    opacity: 0.75,
  },

  buttonDisabled: {
    opacity: 0.6,
  },

  cancelButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },

  cancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
