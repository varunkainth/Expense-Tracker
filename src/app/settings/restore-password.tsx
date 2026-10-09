import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

import { useTheme } from '../../hooks/useTheme';
import {
  readBackupFile,
  restoreBackup,
} from '../../services/backup.service';

export default function RestorePasswordScreen() {
  const { colors, spacing, borderRadius } = useTheme();

  const { fileUri } = useLocalSearchParams<{
    fileUri: string;
  }>();

  const [password, setPassword] = useState('');
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const handleRestore = async () => {
    setRestoreError(null);
    if (!password) {
      Alert.alert(
        'Password Required',
        'Enter the password used when this backup was created.',
      );
      return;
    }

    if (!fileUri) {
      Alert.alert(
        'Restore Failed',
        'Backup file could not be located.',
      );
      return;
    }

    try {
      setIsRestoring(true);

      const backup = await readBackupFile(fileUri);

      const summary = await restoreBackup(
        backup,
        password,
      );

      Alert.alert(
        'Restore Successful',
        `Restored ${summary.recordCount} records and ${summary.attachmentCount} receipt attachments. Attachment data passed its integrity checks.`,
        [
          {
            text: 'OK',
            onPress: () => {
              router.replace('/settings/backup');
            },
          },
        ],
      );
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : 'Unable to restore the backup.';
      const isDecryptionFailure = message.startsWith('Unable to decrypt backup.');

      if (!isDecryptionFailure) {
        console.error('Restore failed:', error);
      }

      setRestoreError(
        isDecryptionFailure
          ? 'We couldn’t verify this backup. Check that you entered the password used to create it and selected the original backup file. The file may also be damaged. Your current data has not been changed; you can try again.'
          : `${message} Your current data has not been changed. You can try again.`,
      );
    } finally {
      setIsRestoring(false);
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
      <View
        style={[
          styles.content,
          {
            padding: spacing.base,
          },
        ]}
      >
        <View
          style={[
            styles.iconContainer,
            {
              backgroundColor:
                colors.primaryLight,
            },
          ]}
        >
          <MaterialIcons
            name="lock"
            size={32}
            color={colors.primary}
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
          Enter Backup Password
        </Text>

        <Text
          style={[
            styles.description,
            {
              color: colors.textSecondary,
            },
          ]}
        >
          Enter the password used when this backup
          was created. Your current database will be
          replaced with the backup data.
        </Text>

        <TextInput
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            setRestoreError(null);
          }}
          placeholder="Backup password"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          editable={!isRestoring}
          style={[
            styles.input,
            {
              color: colors.text,
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: borderRadius.md,
            },
          ]}
        />

        {restoreError ? (
          <View
            accessibilityRole="alert"
            style={[
              styles.errorContainer,
              {
                backgroundColor: colors.dangerBackground,
                borderColor: colors.danger,
                borderRadius: borderRadius.md,
              },
            ]}
          >
            <MaterialIcons name="error-outline" size={20} color={colors.danger} />
            <Text style={[styles.errorText, { color: colors.danger }]}>
              {restoreError}
            </Text>
          </View>
        ) : null}

        <Pressable
          onPress={handleRestore}
          disabled={isRestoring}
          style={({ pressed }) => [
            styles.button,
            {
              backgroundColor: colors.primary,
              borderRadius: borderRadius.md,
            },
            pressed && styles.pressed,
            isRestoring && styles.disabled,
          ]}
        >
          {isRestoring ? (
            <ActivityIndicator
              color={colors.textInverse}
            />
          ) : (
            <Text
              style={[
                styles.buttonText,
                {
                  color: colors.textInverse,
                },
              ]}
            >
              {restoreError ? 'Try Again' : 'Restore Backup'}
            </Text>
          )}
        </Pressable>

        <Pressable
          onPress={() => router.back()}
          disabled={isRestoring}
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
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  content: {
    flex: 1,
    justifyContent: 'center',
  },

  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },

  title: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
  },

  description: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 28,
  },

  input: {
    height: 52,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 16,
  },

  errorContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 16,
  },

  errorText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },

  button: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },

  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },

  cancelButton: {
    alignItems: 'center',
    padding: 16,
    marginTop: 8,
  },

  cancelText: {
    fontSize: 15,
    fontWeight: '500',
  },

  pressed: {
    opacity: 0.7,
  },

  disabled: {
    opacity: 0.6,
  },
});
