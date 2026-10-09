import { MaterialIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import {
  pickExpenseImages,
  pickExpensePdfs,
  PickedExpenseAttachment,
  takeExpensePhoto,
} from '../services/company-expense-attachments.service';

interface Props {
  value: PickedExpenseAttachment[];
  onChange: (attachments: PickedExpenseAttachment[]) => void;
  disabled?: boolean;
}

export default function ExpenseAttachmentDrafts({ value, onChange, disabled }: Props) {
  const { colors, borderRadius } = useTheme();
  const [busy, setBusy] = useState(false);

  const append = async (pick: () => Promise<PickedExpenseAttachment[]>) => {
    try {
      setBusy(true);
      const picked = await pick();
      if (picked.length) onChange([...value, ...picked]);
    } catch (error) {
      Alert.alert('Could not add attachments', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const addCameraPhoto = async () => {
    try {
      setBusy(true);
      const photo = await takeExpensePhoto();
      if (photo) onChange([...value, photo]);
    } catch (error) {
      Alert.alert('Could not take photo', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>Attachments (optional)</Text>
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.surfaceVariant, borderRadius: borderRadius.md }]}
          onPress={addCameraPhoto}
          disabled={disabled || busy}
        >
          <MaterialIcons name="photo-camera" size={17} color={colors.primary} />
          <Text style={[styles.buttonText, { color: colors.text }]}>Photo</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.surfaceVariant, borderRadius: borderRadius.md }]}
          onPress={() => append(pickExpenseImages)}
          disabled={disabled || busy}
        >
          <MaterialIcons name="image" size={17} color={colors.primary} />
          <Text style={[styles.buttonText, { color: colors.text }]}>Images</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.surfaceVariant, borderRadius: borderRadius.md }]}
          onPress={() => append(pickExpensePdfs)}
          disabled={disabled || busy}
        >
          <MaterialIcons name="picture-as-pdf" size={17} color={colors.danger} />
          <Text style={[styles.buttonText, { color: colors.text }]}>PDFs</Text>
        </TouchableOpacity>
      </View>
      <Text style={[styles.hint, { color: colors.textMuted }]}>Images are compressed when saved; PDFs are kept unchanged.</Text>
      {value.map((item, index) => (
        <View key={`${item.uri}-${index}`} style={[styles.fileRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {item.mimeType.startsWith('image/') ? (
            <Image source={{ uri: item.uri }} style={styles.thumbnail} resizeMode="cover" />
          ) : (
            <View style={[styles.pdfIcon, { backgroundColor: `${colors.danger}18` }]}>
              <MaterialIcons name="picture-as-pdf" size={22} color={colors.danger} />
            </View>
          )}
          <Text style={[styles.fileName, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
          <TouchableOpacity
            onPress={() => onChange(value.filter((_, selectedIndex) => selectedIndex !== index))}
            disabled={disabled || busy}
            accessibilityLabel={`Remove ${item.name}`}
          >
            <MaterialIcons name="close" size={20} color={colors.danger} />
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  label: { fontSize: 12, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 8 },
  button: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4, paddingVertical: 9, paddingHorizontal: 5 },
  buttonText: { fontSize: 12, fontWeight: '600' },
  hint: { fontSize: 11 },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderRadius: 10, padding: 7 },
  thumbnail: { width: 40, height: 46, borderRadius: 6 },
  pdfIcon: { width: 40, height: 46, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  fileName: { flex: 1, fontSize: 12 },
});
