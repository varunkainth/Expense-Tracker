import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';

export default function ExpenseAttachmentStatusButton({
  count,
  onPress,
}: {
  count: number;
  onPress: () => void;
}) {
  const { colors, borderRadius } = useTheme();
  const hasFiles = count > 0;
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.button,
        {
          backgroundColor: hasFiles ? colors.primary : colors.surfaceVariant,
          borderRadius: borderRadius.full,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={hasFiles ? `${count} attachments. Manage attachments` : 'No attachments. Add a receipt'}
    >
      <MaterialIcons name={hasFiles ? 'attach-file' : 'add'} size={17} color={hasFiles ? '#fff' : colors.textSecondary} />
      <Text style={[styles.label, { color: hasFiles ? '#fff' : colors.textSecondary }]}>
        {hasFiles ? `${count} ${count === 1 ? 'attachment' : 'attachments'}` : 'Add receipt'}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 34, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 5 },
  label: { fontSize: 12, fontWeight: '700' },
});
