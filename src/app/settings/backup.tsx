import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';

import { useTheme } from '../../hooks/useTheme';
import {
  pickBackupFile,
  readBackupFile,
} from '../../services/backup.service';
import {
  getLastSuccessfulBackup,
} from '../../services/backup-status.service';
import {
  BACKUP_REMINDER_AFTER_DAYS,
  BackupStatus,
  isBackupOverdue,
} from '../../services/backup-data';

export default function BackupScreen() {
  const { colors, spacing, borderRadius, shadows } =
    useTheme();
  const [backupStatus, setBackupStatus] = useState<BackupStatus | null>(null);
  const [statusLoaded, setStatusLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      getLastSuccessfulBackup().then((status) => {
        if (isActive) {
          setBackupStatus(status);
          setStatusLoaded(true);
        }
      });
      return () => {
        isActive = false;
      };
    }, []),
  );

  const backupOverdue = statusLoaded && isBackupOverdue(backupStatus);

  const handleCreateBackup = () => {
    router.push('/settings/backup-password');
  };

const handleRestoreBackup = async () => {
  try {
    const fileUri = await pickBackupFile();

    if (!fileUri) {
      return;
    }

    // Validate the backup before asking for the password.
    const backup = await readBackupFile(fileUri);

    Alert.alert(
      'Restore Backup',
      `Backup created on ${new Date(
        backup.created_at,
      ).toLocaleString()}.\n\n` +
        'Restoring this backup will replace your current database data.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Continue',
          onPress: () => {
            router.push({
              pathname: '/settings/restore-password',
              params: {
                fileUri,
              },
            });
          },
        },
      ],
    );
  } catch (error) {
    Alert.alert(
      'Invalid Backup',
      error instanceof Error
        ? error.message
        : 'Unable to read backup.',
    );
  }
};

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
      >
        {/* Header */}
        <View style={styles.headerInfo}>
          <MaterialIcons
            name="cloud-download"
            size={48}
            color={colors.primary}
          />

          <Text
            style={[
              styles.headerTitle,
              {
                color: colors.text,
              },
            ]}
          >
            Database Backup & Restore
          </Text>

          <Text
            style={[
              styles.headerDesc,
              {
                color: colors.textSecondary,
              },
            ]}
          >
            Since Payment App is 100% offline-first,
            your backups remain strictly on your local
            device or your chosen storage.
          </Text>
        </View>

        <View
          style={[
            styles.backupStatusCard,
            {
              backgroundColor: backupOverdue
                ? `${colors.warning}12`
                : colors.card,
              borderColor: backupOverdue
                ? colors.warning
                : colors.border,
              borderRadius: borderRadius.lg,
            },
          ]}
        >
          <MaterialIcons
            name={backupOverdue ? 'backup' : 'verified-user'}
            size={24}
            color={backupOverdue ? colors.warning : colors.success}
          />
          <View style={styles.backupStatusText}>
            <Text style={[styles.backupStatusTitle, { color: colors.text }]}>
              {!statusLoaded
                ? 'Checking backup status…'
                : !backupStatus
                  ? 'No backup saved yet'
                  : backupOverdue
                    ? 'Backup is due'
                    : 'Backup is recent'}
            </Text>
            <Text style={[styles.backupStatusDesc, { color: colors.textSecondary }]}>
              {!statusLoaded
                ? 'Checking when this device last saved a backup.'
                : !backupStatus
                  ? 'Create an encrypted backup and save it somewhere separate from this phone.'
                  : `${new Date(backupStatus.createdAt).toLocaleString()} · ${backupStatus.recordCount} records · ${backupStatus.attachmentCount} receipt attachments`}
            </Text>
            {backupStatus && backupOverdue && (
              <Text style={[styles.backupOverdueHint, { color: colors.warning }]}>
                It has been at least {BACKUP_REMINDER_AFTER_DAYS} days since the last successful backup.
              </Text>
            )}
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionsContainer}>
          {/* Create Backup */}
          <TouchableOpacity
            style={[
              styles.actionCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: borderRadius.lg,
                ...shadows.sm,
              },
            ]}
            onPress={handleCreateBackup}
            activeOpacity={0.8}
          >
            <View
              style={[
                styles.iconCircle,
                {
                  backgroundColor:
                    colors.primaryLight,
                },
              ]}
            >
              <MaterialIcons
                name="file-upload"
                size={24}
                color={colors.primary}
              />
            </View>

            <View
              style={styles.actionTextContainer}
            >
              <Text
                style={[
                  styles.actionTitle,
                  {
                    color: colors.text,
                  },
                ]}
              >
                Create Full Database Backup
              </Text>

              <Text
                style={[
                  styles.actionDesc,
                  {
                    color: colors.textSecondary,
                  },
                ]}
              >
                Save an encrypted copy of personal and company records,
                including receipt images and PDF attachments.
              </Text>
            </View>

            <MaterialIcons
              name="chevron-right"
              size={24}
              color={colors.textMuted}
            />
          </TouchableOpacity>

          {/* Restore Backup */}
          <TouchableOpacity
            style={[
              styles.actionCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: borderRadius.lg,
                ...shadows.sm,
              },
            ]}
            onPress={handleRestoreBackup}
            activeOpacity={0.8}
          >
            <View
              style={[
                styles.iconCircle,
                {
                  backgroundColor: '#f59e0b20',
                },
              ]}
            >
              <MaterialIcons
                name="settings-backup-restore"
                size={24}
                color="#f59e0b"
              />
            </View>

            <View
              style={styles.actionTextContainer}
            >
              <Text
                style={[
                  styles.actionTitle,
                  {
                    color: colors.text,
                  },
                ]}
              >
                Restore Database from Backup
              </Text>

              <Text
                style={[
                  styles.actionDesc,
                  {
                    color: colors.textSecondary,
                  },
                ]}
              >
                Recover expenses, employee data, and saved attachments
                from a backup file.
              </Text>
            </View>

            <MaterialIcons
              name="chevron-right"
              size={24}
              color={colors.textMuted}
            />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  scrollContent: {
    paddingBottom: 32,
  },

  headerInfo: {
    alignItems: 'center',
    marginBottom: 28,
    marginTop: 12,
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 6,
  },

  headerDesc: {
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 18,
  },

  backupStatusCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderWidth: 1,
    marginBottom: 20,
  },

  backupStatusText: { flex: 1 },
  backupStatusTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  backupStatusDesc: { fontSize: 12, lineHeight: 17 },
  backupOverdueHint: { fontSize: 12, lineHeight: 17, marginTop: 5, fontWeight: '600' },

  actionsContainer: {
    gap: 14,
  },

  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1,
  },

  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },

  actionTextContainer: {
    flex: 1,
  },

  actionTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },

  actionDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
});
