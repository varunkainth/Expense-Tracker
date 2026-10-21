import { useCallback, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { getLastSuccessfulBackup } from '../services/backup-status.service';
import { isBackupOverdue } from '../services/backup-data';

let lastReminderDay: string | null = null;

export function BackupReminderSnackbar({ suppressed = false }: { suppressed?: boolean }) {
  const { colors, shadows } = useTheme();
  const [visible, setVisible] = useState(false);
  useFocusEffect(useCallback(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (suppressed) return () => { active = false; };
    void getLastSuccessfulBackup()
      .then((status) => {
        if (!active || !isBackupOverdue(status)) return;
        const today = new Date().toDateString();
        if (lastReminderDay === today) return;
        lastReminderDay = today;
        setVisible(true);
        timer = setTimeout(() => setVisible(false), 8000);
      })
      .catch((error) => console.warn('Could not check backup status:', error));
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      setVisible(false);
    };
  }, [suppressed]));

  if (!visible || suppressed) return null;
  return <View
    accessibilityRole="alert"
    style={{
      position: 'absolute', left: 16, right: 16, bottom: 96,
      minHeight: 58, paddingHorizontal: 14, borderWidth: 1, borderRadius: 14,
      flexDirection: 'row', alignItems: 'center', gap: 10, zIndex: 100, elevation: 10,
      backgroundColor: colors.card, borderColor: colors.border, ...shadows.lg,
    }}
  >
    <MaterialIcons name="backup" size={21} color={colors.warning} />
    <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600', flex: 1 }}>Backup due</Text>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Open backup settings" onPress={() => { setVisible(false); router.push('/settings/backup'); }} hitSlop={8}>
      <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '800', paddingVertical: 8 }}>BACK UP</Text>
    </TouchableOpacity>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Dismiss backup reminder" onPress={() => setVisible(false)} hitSlop={8} style={{ padding: 5 }}>
      <MaterialIcons name="close" size={18} color={colors.textSecondary} />
    </TouchableOpacity>
  </View>;
}
