import { MaterialIcons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import Pdf from 'react-native-pdf';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../hooks/useTheme';
import {
  addExpenseAttachment,
  CompanyExpenseAttachment,
  deleteExpenseAttachment,
  getExpenseAttachmentErrorMessage,
  getExpenseAttachmentFile,
  listExpenseAttachments,
  pickExpenseImages,
  pickExpensePdfs,
  takeExpensePhoto,
} from '../services/company-expense-attachments.service';
import { CompanyExpenseAttachmentType } from '../types/company';

interface Props {
  visible: boolean;
  expenseType: CompanyExpenseAttachmentType;
  expenseId: string;
  title: string;
  onClose: () => void;
}

export default function CompanyExpenseAttachmentsModal({
  visible,
  expenseType,
  expenseId,
  title,
  onClose,
}: Props) {
  const { colors, spacing, borderRadius } = useTheme();
  const [attachments, setAttachments] = useState<CompanyExpenseAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [pdfPreview, setPdfPreview] = useState<{ uri: string; name: string } | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfPage, setPdfPage] = useState(1);
  const [pdfPageCount, setPdfPageCount] = useState(0);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setAttachments(await listExpenseAttachments(expenseType, expenseId));
    } catch (error) {
      Alert.alert('Attachments unavailable', error instanceof Error ? error.message : 'Could not load attachments.');
    } finally {
      setLoading(false);
    }
  }, [expenseId, expenseType]);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    void listExpenseAttachments(expenseType, expenseId)
      .then((items) => {
        if (active) setAttachments(items);
      })
      .catch((error) => {
        if (active) {
          Alert.alert('Attachments unavailable', error instanceof Error ? error.message : 'Could not load attachments.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [visible, expenseId, expenseType]);

  const addPicked = async (
    picker: () => Promise<Awaited<ReturnType<typeof pickExpenseImages>>>,
  ) => {
    try {
      const picked = await picker();
      if (picked.length === 0) return;
      setBusy(true);
      for (const item of picked) {
        await addExpenseAttachment(expenseType, expenseId, item);
      }
      await refresh();
    } catch (error) {
      Alert.alert('Could not add attachment', getExpenseAttachmentErrorMessage(error));
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const addPhoto = async () => {
    try {
      const photo = await takeExpensePhoto();
      if (!photo) return;
      setBusy(true);
      await addExpenseAttachment(expenseType, expenseId, photo);
      await refresh();
    } catch (error) {
      Alert.alert('Could not add photo', getExpenseAttachmentErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = (item: CompanyExpenseAttachment) => {
    Alert.alert('Remove attachment?', item.file_name, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteExpenseAttachment(item.id);
            await refresh();
          } catch (error) {
            Alert.alert('Could not remove attachment', error instanceof Error ? error.message : 'Please try again.');
          }
        },
      },
    ]);
  };

  const share = async (item: CompanyExpenseAttachment) => {
    const available = await Sharing.isAvailableAsync();
    if (!available) {
      Alert.alert('Sharing unavailable', 'File sharing is not supported on this device.');
      return;
    }
    await Sharing.shareAsync(getExpenseAttachmentFile(item.storage_name).uri, {
      mimeType: item.mime_type,
      dialogTitle: item.file_name,
      UTI: item.mime_type === 'application/pdf' ? 'com.adobe.pdf' : 'public.jpeg',
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => {
        if (pdfPreview) setPdfPreview(null);
        else onClose();
      }}
    >
      <View style={styles.scrim}>
        <View style={[styles.sheet, { backgroundColor: colors.background, padding: spacing.base }]}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{title}</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Receipt attachments</Text>
            </View>
            <TouchableOpacity onPress={onClose} accessibilityLabel="Close attachments">
              <MaterialIcons name="close" size={25} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.action, { backgroundColor: colors.primary, borderRadius: borderRadius.md }]}
              onPress={addPhoto}
              disabled={busy}
            >
              <MaterialIcons name="photo-camera" size={18} color={colors.textInverse} />
              <Text style={[styles.actionText, { color: colors.textInverse }]}>Take photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.action, { backgroundColor: colors.surfaceVariant, borderRadius: borderRadius.md }]}
              onPress={() => addPicked(pickExpenseImages)}
              disabled={busy}
            >
              <MaterialIcons name="image" size={18} color={colors.primary} />
              <Text style={[styles.actionText, { color: colors.text }]}>Images</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.action, { backgroundColor: colors.surfaceVariant, borderRadius: borderRadius.md }]}
              onPress={() => addPicked(pickExpensePdfs)}
              disabled={busy}
            >
              <MaterialIcons name="picture-as-pdf" size={18} color={colors.danger} />
              <Text style={[styles.actionText, { color: colors.text }]}>PDFs</Text>
            </TouchableOpacity>
          </View>

          {busy && <ActivityIndicator style={styles.spinner} color={colors.primary} />}
          {loading ? (
            <ActivityIndicator style={styles.spinner} color={colors.primary} />
          ) : attachments.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No attachments yet. Add receipt photos or PDF documents.</Text>
          ) : (
            <ScrollView contentContainerStyle={styles.list}>
              {attachments.map((item) => {
                const fileUri = getExpenseAttachmentFile(item.storage_name).uri;
                return (
                  <View key={item.id} style={[styles.attachment, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    {item.mime_type === 'image/jpeg' ? (
                      <TouchableOpacity onPress={() => setPreview(fileUri)}>
                        <Image source={{ uri: fileUri }} style={styles.thumbnail} resizeMode="cover" />
                      </TouchableOpacity>
                    ) : (
                      <View style={[styles.pdfIcon, { backgroundColor: `${colors.danger}18` }]}>
                        <MaterialIcons name="picture-as-pdf" size={26} color={colors.danger} />
                      </View>
                    )}
                    <View style={styles.fileInfo}>
                      <Text style={[styles.fileName, { color: colors.text }]} numberOfLines={2}>{item.file_name}</Text>
                      <Text style={[styles.fileMeta, { color: colors.textSecondary }]}>
                        {item.mime_type === 'application/pdf' ? 'PDF' : 'Compressed image'} · {(item.size_bytes / 1024).toFixed(0)} KB
                      </Text>
                      {item.mime_type === 'application/pdf' && (
                        <View style={styles.pdfActions}>
                          <TouchableOpacity
                            onPress={() => {
                              setPdfError(null);
                              setPdfLoading(true);
                              setPdfPage(1);
                              setPdfPageCount(0);
                              setPdfPreview({ uri: fileUri, name: item.file_name });
                            }}
                            style={styles.openButton}
                          >
                            <Text style={[styles.openText, { color: colors.primary }]}>View PDF</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => share(item)} style={styles.openButton}>
                            <Text style={[styles.openText, { color: colors.textSecondary }]}>Share</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                    <TouchableOpacity onPress={() => confirmDelete(item)} accessibilityLabel={`Remove ${item.file_name}`}>
                      <MaterialIcons name="delete-outline" size={22} color={colors.danger} />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
      {preview !== null && (
        <View style={[styles.previewScrim, StyleSheet.absoluteFill]}>
          <TouchableOpacity style={styles.previewClose} onPress={() => setPreview(null)}>
            <MaterialIcons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          {preview && <Image source={{ uri: preview }} style={styles.fullImage} resizeMode="contain" />}
        </View>
      )}
      {pdfPreview && (
        <View style={[styles.previewScrim, StyleSheet.absoluteFill]}>
          <View style={[styles.pdfHeader, { backgroundColor: colors.background, paddingTop: spacing.base + 28 }]}>
            <TouchableOpacity
              onPress={() => setPdfPreview(null)}
              accessibilityLabel="Close PDF viewer"
              style={styles.pdfClose}
            >
              <MaterialIcons name="arrow-back" size={23} color={colors.text} />
            </TouchableOpacity>
            <View style={styles.pdfHeaderText}>
              <Text style={[styles.pdfTitle, { color: colors.text }]} numberOfLines={1}>{pdfPreview.name}</Text>
              {pdfPageCount > 0 && (
                <Text style={[styles.pdfSubtitle, { color: colors.textSecondary }]}>{pdfPage} / {pdfPageCount}</Text>
              )}
            </View>
          </View>
          {pdfError ? (
            <View style={styles.pdfError}>
              <MaterialIcons name="error-outline" size={36} color={colors.danger} />
              <Text style={[styles.pdfErrorText, { color: colors.text }]}>{pdfError}</Text>
            </View>
          ) : (
            <Pdf
              key={pdfPreview.uri}
              source={{ uri: pdfPreview.uri }}
              style={styles.pdfPage}
              fitPolicy={0}
              spacing={10}
              enableDoubleTapZoom
              onLoadComplete={(pages) => {
                setPdfPageCount(pages);
                setPdfLoading(false);
              }}
              onPageChanged={(page) => setPdfPage(page)}
              onError={(error) => {
                setPdfError(error.message || 'This PDF could not be opened.');
                setPdfLoading(false);
              }}
            />
          )}
          {pdfLoading && !pdfError && (
            <View style={styles.pdfLoading} pointerEvents="none">
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          )}
        </View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#0008' },
  sheet: { maxHeight: '88%', minHeight: '50%', borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  headerText: { flex: 1, paddingRight: 12 },
  title: { fontSize: 18, fontWeight: '700' },
  subtitle: { fontSize: 13, marginTop: 3 },
  actions: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  action: { flex: 1, minHeight: 42, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5, paddingHorizontal: 5 },
  actionText: { fontSize: 12, fontWeight: '600' },
  spinner: { marginVertical: 18 },
  emptyText: { paddingVertical: 28, textAlign: 'center', lineHeight: 20 },
  list: { gap: 10, paddingBottom: 22 },
  attachment: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderWidth: 1, borderRadius: 12 },
  thumbnail: { width: 64, height: 76, borderRadius: 8, backgroundColor: '#ddd' },
  pdfIcon: { width: 64, height: 76, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  fileInfo: { flex: 1 },
  fileName: { fontSize: 13, fontWeight: '600' },
  fileMeta: { fontSize: 11, marginTop: 4 },
  openButton: { alignSelf: 'flex-start', marginTop: 6 },
  openText: { fontSize: 12, fontWeight: '600' },
  previewScrim: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  previewClose: { position: 'absolute', top: 55, right: 20, zIndex: 1, padding: 8 },
  fullImage: { width: '100%', height: '85%' },
  pdfHeader: { minHeight: 78, paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  pdfClose: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  pdfHeaderText: { flex: 1 },
  pdfTitle: { fontSize: 14, fontWeight: '700' },
  pdfSubtitle: { fontSize: 12, marginTop: 3 },
  pdfPage: { flex: 1, width: '100%', backgroundColor: '#e6e8eb' },
  pdfLoading: { ...StyleSheet.absoluteFill, top: 78, alignItems: 'center', justifyContent: 'center' },
  pdfError: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  pdfErrorText: { textAlign: 'center', fontSize: 14, lineHeight: 20 },
  pdfActions: { flexDirection: 'row', gap: 18 },
});
