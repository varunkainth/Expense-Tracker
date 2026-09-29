import { MaterialIcons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AttendanceExtrasDialog, {
  AttendanceExtras,
} from '../../components/AttendanceExtrasDialog';
import MonthPickerModal from '../../components/monthpicker';
import { useTheme } from '../../hooks/useTheme';
import { employeeRepository } from '../../repositories/company/employee.repository';
import { buildAttendancePdf } from '../../services/export-attendance-pdf.service';
import { buildCompanyExcel } from '../../services/export-company-excel.service';
import { MonthPeriod, formatPeriodLabel } from '../../types/period';

type ExportKind = 'excel' | 'attendance';
type Exporting = ExportKind | null;
type PendingKind = ExportKind | null;

export default function DataExportScreen() {
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const [exporting, setExporting] = useState<Exporting>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pendingKind, setPendingKind] = useState<PendingKind>(null);
  const [extrasVisible, setExtrasVisible] = useState(false);
  const [period, setPeriod] = useState<MonthPeriod>(() => {
    const now = new Date();
    return { kind: 'month', year: now.getFullYear(), monthIndex: now.getMonth() };
  });

  // ------------------------------------------------------------
  // Excel export
  // ------------------------------------------------------------
  const handleExcelExport = useCallback(
    async (selectedPeriod: MonthPeriod) => {
      try {
        setExporting('excel');
        const employees = await employeeRepository.getAll();
        if (employees.length === 0) {
          Alert.alert('No Employee', 'Set up an employee profile before exporting.');
          return;
        }
        const employee = employees[0];

        const result = await buildCompanyExcel(employee.id, selectedPeriod);

        const canShare = await Sharing.isAvailableAsync();
        if (!canShare) {
          Alert.alert('Sharing Unavailable', 'Sharing is not supported on this device.');
          return;
        }
        await Sharing.shareAsync(result.uri, {
          mimeType:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          dialogTitle: 'Save Excel',
          UTI: 'org.openxmlformats.spreadsheetml.sheet',
        });
      } catch (err) {
        Alert.alert(
          'Export Failed',
          err instanceof Error ? err.message : 'Something went wrong.'
        );
      } finally {
        setExporting(null);
      }
    },
    []
  );

  // ------------------------------------------------------------
  // Attendance export
  // ------------------------------------------------------------
  const onAttendanceConfirmed = useCallback(
    async (extras: AttendanceExtras) => {
      setExtrasVisible(false);
      try {
        setExporting('attendance');
        const employees = await employeeRepository.getAll();
        if (employees.length === 0) {
          Alert.alert('No Employee', 'Set up an employee profile before exporting.');
          return;
        }
        const result = await buildAttendancePdf(employees[0].id, period, extras);

        const canShare = await Sharing.isAvailableAsync();
        if (!canShare) {
          Alert.alert('Sharing Unavailable', 'Sharing is not supported on this device.');
          return;
        }
        await Sharing.shareAsync(result.uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Save Attendance Form',
          UTI: 'com.adobe.pdf',
        });
      } catch (err) {
        Alert.alert(
          'Export Failed',
          err instanceof Error ? err.message : 'Something went wrong.'
        );
      } finally {
        setExporting(null);
      }
    },
    [period]
  );

  // ------------------------------------------------------------
  // Picker flow
  // ------------------------------------------------------------
  const onExportPressed = useCallback((kind: ExportKind) => {
    setPendingKind(kind);
    setPickerVisible(true);
  }, []);

  const onMonthSelected = useCallback(
    (p: MonthPeriod) => {
      setPeriod(p);
      const kind = pendingKind;
      setPendingKind(null);

      if (kind === 'excel') {
        setTimeout(() => handleExcelExport(p), 150);
      } else if (kind === 'attendance') {
        setTimeout(() => setExtrasVisible(true), 150);
      }
    },
    [pendingKind, handleExcelExport]
  );

  const onPickerClose = useCallback(() => {
    setPickerVisible(false);
    setPendingKind(null);
  }, []);

  const onExtrasCancel = useCallback(() => {
    setExtrasVisible(false);
  }, []);

  const isBusy = exporting !== null;

  return (
    <SafeAreaView
      edges={['bottom', 'left', 'right']}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { padding: spacing.base }]}
      >
        <View style={styles.headerInfo}>
          <MaterialIcons name="import-export" size={48} color={colors.primary} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>Data Export</Text>
          <Text style={[styles.headerDesc, { color: colors.textSecondary }]}>
            Export company expense claims as an Excel workbook or a monthly
            attendance form.
          </Text>
          <View
            style={[
              styles.periodChip,
              {
                backgroundColor: `${colors.primary}15`,
                borderColor: colors.primary,
                borderRadius: borderRadius.lg,
              },
            ]}
          >
            <MaterialIcons name="event" size={14} color={colors.primary} />
            <Text style={[styles.periodChipText, { color: colors.primary }]}>
              {formatPeriodLabel(period)}
            </Text>
          </View>
        </View>

        <View style={styles.actionsContainer}>
          {/* Excel */}
          <TouchableOpacity
            style={[
              styles.actionCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: borderRadius.lg,
                ...shadows.sm,
                opacity: isBusy ? 0.6 : 1,
              },
            ]}
            onPress={() => onExportPressed('excel')}
            disabled={isBusy}
            activeOpacity={0.8}
          >
            <View style={[styles.iconCircle, { backgroundColor: '#22c55e20' }]}>
              {exporting === 'excel' ? (
                <ActivityIndicator color="#22c55e" />
              ) : (
                <MaterialIcons name="table-chart" size={24} color="#22c55e" />
              )}
            </View>
            <View style={styles.actionTextContainer}>
              <Text style={[styles.actionTitle, { color: colors.text }]}>
                {exporting === 'excel' ? 'Generating Excel...' : 'Export as Excel (.xlsx)'}
              </Text>
              <Text style={[styles.actionDesc, { color: colors.textSecondary }]}>
                Three sheets mirroring the claim form — same sections, same totals,
                editable in Excel.
              </Text>
            </View>
          </TouchableOpacity>

          {/* Attendance */}
          <TouchableOpacity
            style={[
              styles.actionCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: borderRadius.lg,
                ...shadows.sm,
                opacity: isBusy ? 0.6 : 1,
              },
            ]}
            onPress={() => onExportPressed('attendance')}
            disabled={isBusy}
            activeOpacity={0.8}
          >
            <View style={[styles.iconCircle, { backgroundColor: '#8b5cf620' }]}>
              {exporting === 'attendance' ? (
                <ActivityIndicator color="#8b5cf6" />
              ) : (
                <MaterialIcons name="assignment-turned-in" size={24} color="#8b5cf6" />
              )}
            </View>
            <View style={styles.actionTextContainer}>
              <Text style={[styles.actionTitle, { color: colors.text }]}>
                {exporting === 'attendance' ? 'Generating...' : 'Export Attendance Form'}
              </Text>
              <Text style={[styles.actionDesc, { color: colors.textSecondary }]}>
                Monthly one-page attendance + expense summary with Sundays, holidays,
                and absences.
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <MonthPickerModal
        visible={pickerVisible}
        selected={period}
        includeAllTime
        onSelect={onMonthSelected}
        onClose={onPickerClose}
      />

      <AttendanceExtrasDialog
        visible={extrasVisible}
        period={period}
        onCancel={onExtrasCancel}
        onConfirm={onAttendanceConfirmed}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 32 },
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
  periodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    marginTop: 14,
  },
  periodChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionsContainer: { gap: 14 },
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
  actionTextContainer: { flex: 1 },
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