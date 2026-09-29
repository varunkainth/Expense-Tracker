import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DateField, todayMidnight } from '../../components/datafield';
import { useTheme } from '../../hooks/useTheme';
import { dailyAllowanceRepository } from '../../repositories/company/daily-allowance.repository';
import { employeeRepository } from '../../repositories/company/employee.repository';
import {
  DAILY_ALLOWANCE_RATES,
  DailyAllowance,
  EmployeeDetails,
} from '../../types/company';
import { formatPaiseToRupees } from '../../utils/currency';
import { formatDate } from '../../utils/date';

export default function DailyAllowanceScreen() {
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const router = useRouter();

  const [employee, setEmployee] = useState<EmployeeDetails | null>(null);
  const [records, setRecords] = useState<DailyAllowance[]>([]);
  const [loading, setLoading] = useState(false);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [noOfDaysStr, setNoOfDaysStr] = useState('1');
  const [startDate, setStartDate] = useState<number>(todayMidnight);
  const [endDate, setEndDate] = useState<number>(todayMidnight);

  const noOfDays = useMemo(() => {
    const n = parseInt(noOfDaysStr, 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [noOfDaysStr]);

  const previewTravel = DAILY_ALLOWANCE_RATES.TRAVEL_ALLOWANCE_PAISE * noOfDays;
  const previewFood = DAILY_ALLOWANCE_RATES.FOOD_ALLOWANCE_PAISE * noOfDays;
  const previewTotal = previewTravel + previewFood;

  const loadData = useCallback(async () => {
    try {
      const emps = await employeeRepository.getAll();
      if (emps.length > 0) {
        setEmployee(emps[0]);
        const list = await dailyAllowanceRepository.getAll(emps[0].id);
        setRecords(list);
      } else {
        setEmployee(null);
        setRecords([]);
      }
    } catch (err) {
      console.error('Error loading daily allowance:', err);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const resetForm = () => {
    const today = todayMidnight();
    setNoOfDaysStr('1');
    setStartDate(today);
    setEndDate(today);
  };

  const handleSave = async () => {
    if (!employee) {
      Alert.alert('Employee Required', 'Please set up an employee profile first.', [
        { text: 'Set Up', onPress: () => router.push('/(company)/employee') },
      ]);
      return;
    }

    if (noOfDays <= 0) {
      Alert.alert('Validation Error', 'Number of days must be at least 1.');
      return;
    }

    if (endDate < startDate) {
      Alert.alert('Validation Error', 'End date cannot be before start date.');
      return;
    }

    try {
      setLoading(true);
      await dailyAllowanceRepository.create({
        employee_id: employee.id,
        no_of_days: noOfDays,
        start_date: startDate,
        end_date: endDate,
      });

      resetForm();
      setShowForm(false);
      await loadData();
    } catch (err) {
      console.error('Failed to save daily allowance:', err);
      Alert.alert('Error', 'Failed to record daily allowance.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Record', 'Are you sure you want to delete this allowance record?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await dailyAllowanceRepository.delete(id);
            await loadData();
          } catch (err) {
            console.error('Failed to delete daily allowance:', err);
            Alert.alert('Error', 'Failed to delete record.');
          }
        },
      },
    ]);
  };

  const totalClaimedPaise = records.reduce((sum, item) => sum + item.total_amount, 0);

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { padding: spacing.base }]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Summary Card */}
          <View
            style={[
              styles.summaryCard,
              {
                backgroundColor: colors.companyAccent,
                borderRadius: borderRadius.lg,
                ...shadows.md,
              },
            ]}
          >
            <Text style={styles.summaryLabel}>Total Daily Allowance</Text>
            <Text style={styles.summaryAmount}>{formatPaiseToRupees(totalClaimedPaise)}</Text>
            <Text style={styles.summarySub}>{records.length} {records.length === 1 ? 'entry' : 'entries'} recorded</Text>
          </View>

          {/* Standard Rate Rule Card */}
          <View
            style={[
              styles.ruleCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: borderRadius.md,
                ...shadows.sm,
              },
            ]}
          >
            <View style={styles.ruleRow}>
              <MaterialIcons name="info-outline" size={20} color={colors.primary} />
              <Text style={[styles.ruleTitle, { color: colors.text }]}>Company Defined Daily Rates</Text>
            </View>
            <View style={styles.rateBreakdown}>
              <View style={styles.rateItem}>
                <Text style={[styles.rateLabel, { color: colors.textSecondary }]}>Travel DA</Text>
                <Text style={[styles.rateValue, { color: colors.text }]}>
                  {formatPaiseToRupees(DAILY_ALLOWANCE_RATES.TRAVEL_ALLOWANCE_PAISE)}
                </Text>
              </View>
              <Text style={[styles.plusSymbol, { color: colors.textMuted }]}>+</Text>
              <View style={styles.rateItem}>
                <Text style={[styles.rateLabel, { color: colors.textSecondary }]}>Food DA</Text>
                <Text style={[styles.rateValue, { color: colors.text }]}>
                  {formatPaiseToRupees(DAILY_ALLOWANCE_RATES.FOOD_ALLOWANCE_PAISE)}
                </Text>
              </View>
              <Text style={[styles.plusSymbol, { color: colors.textMuted }]}>=</Text>
              <View style={styles.rateItem}>
                <Text style={[styles.rateLabel, { color: colors.textSecondary }]}>Total / Day</Text>
                <Text style={[styles.rateValueTotal, { color: colors.success }]}>
                  {formatPaiseToRupees(DAILY_ALLOWANCE_RATES.TOTAL_ALLOWANCE_PAISE)}
                </Text>
              </View>
            </View>
          </View>

          {/* Add Entry Toggle */}
          <View style={styles.topActionRow}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Daily Allowance Entries</Text>
            <TouchableOpacity
              style={[styles.toggleBtn, { backgroundColor: showForm ? colors.surfaceVariant : colors.primary }]}
              onPress={() => setShowForm(!showForm)}
            >
              <MaterialIcons name={showForm ? 'close' : 'add'} size={20} color={showForm ? colors.text : '#fff'} />
              <Text style={[styles.toggleBtnText, { color: showForm ? colors.text : '#fff' }]}>
                {showForm ? 'Cancel' : 'Add Entry'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Form */}
          {showForm && (
            <View
              style={[
                styles.formCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderRadius: borderRadius.lg,
                  ...shadows.sm,
                },
              ]}
            >
              <Text style={[styles.formTitle, { color: colors.text }]}>New Daily Allowance</Text>

              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>No. of Days *</Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: colors.surfaceVariant, color: colors.text }]}
                  placeholder="1"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                  value={noOfDaysStr}
                  onChangeText={setNoOfDaysStr}
                />
              </View>

              <DateField
                label="Start Date *"
                value={startDate}
                onChange={setStartDate}
                maximumDate={new Date()}
              />

              <DateField
                label="End Date *"
                value={endDate}
                onChange={setEndDate}
                minimumDate={new Date(startDate)}
                maximumDate={new Date()}
              />

              {/* Live preview */}
              <View style={[styles.previewBox, { backgroundColor: colors.surfaceVariant, borderRadius: borderRadius.md }]}>
                <View style={styles.previewRow}>
                  <Text style={[styles.previewLabel, { color: colors.textSecondary }]}>
                    Travel ({noOfDays} × {formatPaiseToRupees(DAILY_ALLOWANCE_RATES.TRAVEL_ALLOWANCE_PAISE)})
                  </Text>
                  <Text style={[styles.previewValue, { color: colors.text }]}>
                    {formatPaiseToRupees(previewTravel)}
                  </Text>
                </View>
                <View style={styles.previewRow}>
                  <Text style={[styles.previewLabel, { color: colors.textSecondary }]}>
                    Food ({noOfDays} × {formatPaiseToRupees(DAILY_ALLOWANCE_RATES.FOOD_ALLOWANCE_PAISE)})
                  </Text>
                  <Text style={[styles.previewValue, { color: colors.text }]}>
                    {formatPaiseToRupees(previewFood)}
                  </Text>
                </View>
                <View style={[styles.previewRow, styles.previewTotalRow, { borderTopColor: colors.border }]}>
                  <Text style={[styles.previewTotalLabel, { color: colors.text }]}>Total</Text>
                  <Text style={[styles.previewTotalValue, { color: colors.success }]}>
                    {formatPaiseToRupees(previewTotal)}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: colors.primary, borderRadius: borderRadius.md }]}
                onPress={handleSave}
                disabled={loading}
              >
                <Text style={styles.submitBtnText}>{loading ? 'Saving...' : 'Save Entry'}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Records list */}
          {records.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.card, borderRadius: borderRadius.md }]}>
              <MaterialIcons name="monetization-on" size={40} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No daily allowances recorded yet.
              </Text>
            </View>
          ) : (
            records.map((item) => (
              <View
                key={item.id}
                style={[
                  styles.recordCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    borderRadius: borderRadius.md,
                    ...shadows.sm,
                  },
                ]}
              >
                <View style={styles.recordMain}>
                  <Text style={[styles.recordDateText, { color: colors.text }]}>
                    {formatDate(item.start_date)}
                    {item.start_date !== item.end_date ? ` → ${formatDate(item.end_date)}` : ''}
                  </Text>
                  <Text style={[styles.recordMeta, { color: colors.textSecondary }]}>
                    {item.no_of_days} {item.no_of_days === 1 ? 'day' : 'days'} •{' '}
                    Travel: {formatPaiseToRupees(item.travel_allowance)} •{' '}
                    Food: {formatPaiseToRupees(item.food_allowance)}
                  </Text>
                </View>

                <View style={styles.recordRight}>
                  <Text style={[styles.recordTotalText, { color: colors.text }]}>
                    {formatPaiseToRupees(item.total_amount)}
                  </Text>
                  <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.deleteBtn}>
                    <MaterialIcons name="delete-outline" size={20} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardView: { flex: 1 },
  scrollContent: { paddingBottom: 32 },

  summaryCard: {
    padding: 20,
    marginBottom: 16,
  },
  summaryLabel: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 4,
  },
  summaryAmount: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  summarySub: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
  },

  ruleCard: {
    padding: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  ruleTitle: { fontSize: 13, fontWeight: '600' },
  rateBreakdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  rateItem: { alignItems: 'center' },
  rateLabel: { fontSize: 11, marginBottom: 2 },
  rateValue: { fontSize: 14, fontWeight: '600' },
  rateValueTotal: { fontSize: 15, fontWeight: '700' },
  plusSymbol: { fontSize: 18, fontWeight: '600' },

  topActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  toggleBtnText: { fontSize: 13, fontWeight: '600' },

  formCard: {
    padding: 16,
    borderWidth: 1,
    marginBottom: 20,
    gap: 12,
  },
  formTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  fieldGroup: { gap: 4 },
  fieldLabel: { fontSize: 12, fontWeight: '600' },
  textInput: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    fontSize: 14,
  },

  previewBox: {
    padding: 12,
    gap: 6,
    marginTop: 4,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewLabel: { fontSize: 12 },
  previewValue: { fontSize: 13, fontWeight: '600' },
  previewTotalRow: {
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  previewTotalLabel: { fontSize: 13, fontWeight: '700' },
  previewTotalValue: { fontSize: 14, fontWeight: '800' },

  submitBtn: { alignItems: 'center', paddingVertical: 12, marginTop: 6 },
  submitBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },

  emptyCard: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  emptyText: { marginTop: 8, fontSize: 13, textAlign: 'center' },

  recordCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
  },
  recordMain: { flex: 1, paddingRight: 12 },
  recordDateText: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  recordMeta: { fontSize: 12, lineHeight: 16 },
  recordRight: { alignItems: 'flex-end', gap: 6 },
  recordTotalText: { fontSize: 15, fontWeight: '700' },
  deleteBtn: { padding: 2 },
});