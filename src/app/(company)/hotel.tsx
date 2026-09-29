import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
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
import { useTheme } from '../../hooks/useTheme';
import { employeeRepository } from '../../repositories/company/employee.repository';
import { hotelRepository } from '../../repositories/company/hotel.repository';
import { EmployeeDetails, HotelExpense } from '../../types/company';
import { formatPaiseToRupees, rupeesToPaise } from '../../utils/currency';
import { formatDate } from '../../utils/date';
import { validateHotelStay, validateRequiredText } from '../../utils/validation';

function normalizeToMidnight(input: number | Date): number {
  const d = input instanceof Date ? new Date(input) : new Date(input);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function todayMidnight(): number {
  return normalizeToMidnight(Date.now());
}

export default function HotelScreen() {
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const router = useRouter();

  const [employee, setEmployee] = useState<EmployeeDetails | null>(null);
  const [records, setRecords] = useState<HotelExpense[]>([]);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [hotelName, setHotelName] = useState('');
  const [billNo, setBillNo] = useState('');
  const [ratePerDayStr, setRatePerDayStr] = useState('');
  const [foodAmountStr, setFoodAmountStr] = useState('');
  const [startDate, setStartDate] = useState<number>(todayMidnight);
  const [endDate, setEndDate] = useState<number>(todayMidnight);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [loading, setLoading] = useState(false);

  // Derived: number of days is inclusive of both check-in and check-out days.
  const derivedDays = useMemo(() => {
    const MS_PER_DAY = 1000 * 60 * 60 * 24;
    const diff = Math.round((endDate - startDate) / MS_PER_DAY) + 1;
    return diff > 0 ? diff : 1;
  }, [startDate, endDate]);

  const loadData = useCallback(async () => {
    try {
      const emps = await employeeRepository.getAll();
      if (emps.length > 0) {
        setEmployee(emps[0]);
        const list = await hotelRepository.getAll(emps[0].id);
        setRecords(list);
      } else {
        setEmployee(null);
        setRecords([]);
      }
    } catch (err) {
      console.error('Error loading hotel expenses:', err);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onStartDateChange = (
    event: DateTimePickerEvent,
    selected?: Date
  ) => {
    if (Platform.OS !== 'ios') setShowStartPicker(false);
    if (event.type === 'dismissed') return;
    if (!selected) return;

    const ts = normalizeToMidnight(selected);
    setStartDate(ts);
    // Keep endDate >= startDate
    if (endDate < ts) setEndDate(ts);
  };

  const onEndDateChange = (
    event: DateTimePickerEvent,
    selected?: Date
  ) => {
    if (Platform.OS !== 'ios') setShowEndPicker(false);
    if (event.type === 'dismissed') return;
    if (!selected) return;

    const ts = normalizeToMidnight(selected);
    // Clamp in case picker sends something before startDate
    setEndDate(ts < startDate ? startDate : ts);
  };

  const resetForm = () => {
    const today = todayMidnight();
    setHotelName('');
    setBillNo('');
    setRatePerDayStr('');
    setFoodAmountStr('');
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

    const vName = validateRequiredText(hotelName, 'Hotel Name');
    if (!vName.isValid) {
      Alert.alert('Validation Error', vName.error);
      return;
    }

    const days = derivedDays;

    const ratePaise = ratePerDayStr ? rupeesToPaise(ratePerDayStr) : 0;
    if (!Number.isFinite(ratePaise) || ratePaise <= 0) {
      Alert.alert('Validation Error', 'Rate per day must be greater than ₹0.');
      return;
    }

    const foodPaise = foodAmountStr ? rupeesToPaise(foodAmountStr) : 0;
    if (!Number.isFinite(foodPaise) || foodPaise < 0) {
      Alert.alert('Validation Error', 'Food amount cannot be negative.');
      return;
    }

    const totalAmountPaise = ratePaise * days + foodPaise;

    const vStay = validateHotelStay(
      startDate,
      endDate,
      days,
      ratePaise,
      totalAmountPaise
    );
    if (!vStay.isValid) {
      Alert.alert('Validation Error', vStay.error);
      return;
    }

    try {
      setLoading(true);
      await hotelRepository.create({
        employee_id: employee.id,
        hotel_name: hotelName.trim(),
        bill_no: billNo.trim() || null,
        start_date: startDate,
        end_date: endDate,
        no_of_days: days,
        rate_per_day: ratePaise,
        food_amount: foodPaise > 0 ? foodPaise : null,
        amount: totalAmountPaise,
      });

      resetForm();
      setShowForm(false);
      await loadData();
    } catch (err) {
      console.error('Failed to save hotel expense:', err);
      Alert.alert('Error', 'Failed to save hotel expense.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      'Delete Record',
      'Are you sure you want to delete this hotel stay record?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await hotelRepository.delete(id);
              await loadData();
            } catch (err) {
              console.error('Failed to delete hotel expense:', err);
              Alert.alert('Error', 'Failed to delete hotel stay record.');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView
      edges={['bottom', 'left', 'right']}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { padding: spacing.base }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.topActionRow}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Hotel & Stay
            </Text>
            <TouchableOpacity
              style={[
                styles.toggleBtn,
                {
                  backgroundColor: showForm ? colors.surfaceVariant : colors.primary,
                },
              ]}
              onPress={() => setShowForm(!showForm)}
            >
              <MaterialIcons
                name={showForm ? 'close' : 'add'}
                size={20}
                color={showForm ? colors.text : '#fff'}
              />
              <Text
                style={[
                  styles.toggleBtnText,
                  { color: showForm ? colors.text : '#fff' },
                ]}
              >
                {showForm ? 'Cancel' : 'Add Hotel'}
              </Text>
            </TouchableOpacity>
          </View>

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
              <Text style={[styles.formTitle, { color: colors.text }]}>
                New Hotel Expense
              </Text>

              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                  Hotel Name *
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    { backgroundColor: colors.surfaceVariant, color: colors.text },
                  ]}
                  placeholder="e.g. Hotel Grand Residency"
                  placeholderTextColor={colors.textMuted}
                  value={hotelName}
                  onChangeText={setHotelName}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                  Bill / Invoice No. (Optional)
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    { backgroundColor: colors.surfaceVariant, color: colors.text },
                  ]}
                  placeholder="e.g. INV-2024-883"
                  placeholderTextColor={colors.textMuted}
                  value={billNo}
                  onChangeText={setBillNo}
                />
              </View>

              {/* Check-in / Check-out */}
              <View style={styles.rowFields}>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                    Check-in *
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.textInput,
                      styles.dateInput,
                      { backgroundColor: colors.surfaceVariant },
                    ]}
                    onPress={() => setShowStartPicker(true)}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons
                      name="calendar-today"
                      size={16}
                      color={colors.primary}
                    />
                    <Text style={[styles.dateText, { color: colors.text }]}>
                      {formatDate(startDate)}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                    Check-out *
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.textInput,
                      styles.dateInput,
                      { backgroundColor: colors.surfaceVariant },
                    ]}
                    onPress={() => setShowEndPicker(true)}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons name="event" size={16} color={colors.primary} />
                    <Text style={[styles.dateText, { color: colors.text }]}>
                      {formatDate(endDate)}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {showStartPicker && (
                <DateTimePicker
                  value={new Date(startDate)}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  onValueChange={(event, selectedDate) => {
                    if (!selectedDate) return;
                    const ts = normalizeToMidnight(selectedDate);
                    setStartDate(ts);
                    if (endDate < ts) setEndDate(ts);
                  }}
                  onDismiss={() => setShowStartPicker(false)}
                  maximumDate={new Date()}
                />
              )}

              {showEndPicker && (
                <DateTimePicker
                  value={new Date(endDate)}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  onValueChange={(event, selectedDate) => {
                    if (!selectedDate) return;
                    const ts = normalizeToMidnight(selectedDate);
                    setEndDate(ts < startDate ? startDate : ts);
                  }}
                  onDismiss={() => setShowEndPicker(false)}
                  minimumDate={new Date(startDate)}
                  maximumDate={new Date()}
                />
              )}

              <View style={styles.rowFields}>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                    No. of Days
                  </Text>
                  <View
                    style={[
                      styles.textInput,
                      styles.readOnlyField,
                      { backgroundColor: colors.surfaceVariant },
                    ]}
                  >
                    <Text style={[styles.readOnlyText, { color: colors.text }]}>
                      {derivedDays}
                    </Text>
                  </View>
                </View>

                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                    Rate / Day (₹) *
                  </Text>
                  <TextInput
                    style={[
                      styles.textInput,
                      { backgroundColor: colors.surfaceVariant, color: colors.text },
                    ]}
                    placeholder="0.00"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="decimal-pad"
                    value={ratePerDayStr}
                    onChangeText={setRatePerDayStr}
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                  Food Amount (₹, Optional)
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    { backgroundColor: colors.surfaceVariant, color: colors.text },
                  ]}
                  placeholder="0.00"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad"
                  value={foodAmountStr}
                  onChangeText={setFoodAmountStr}
                />
              </View>

              <TouchableOpacity
                style={[
                  styles.submitBtn,
                  { backgroundColor: colors.primary, borderRadius: borderRadius.md },
                ]}
                onPress={handleSave}
                disabled={loading}
              >
                <Text style={styles.submitBtnText}>
                  {loading ? 'Saving...' : 'Save Hotel Stay'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {records.length === 0 ? (
            <View
              style={[
                styles.emptyCard,
                { backgroundColor: colors.card, borderRadius: borderRadius.md },
              ]}
            >
              <MaterialIcons name="hotel" size={40} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No hotel stay records yet.
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
                  <Text style={[styles.recordParticulars, { color: colors.text }]}>
                    {item.hotel_name}
                  </Text>
                  <Text style={[styles.recordMeta, { color: colors.textSecondary }]}>
                    {formatDate(item.start_date)} → {formatDate(item.end_date)} •{' '}
                    {item.no_of_days} {item.no_of_days === 1 ? 'day' : 'days'} @{' '}
                    {formatPaiseToRupees(item.rate_per_day)}/day
                    {item.food_amount
                      ? ` • Food: ${formatPaiseToRupees(item.food_amount)}`
                      : ''}
                  </Text>
                  {item.bill_no && (
                    <Text style={[styles.recordBill, { color: colors.textMuted }]}>
                      Bill: {item.bill_no}
                    </Text>
                  )}
                </View>

                <View style={styles.recordRight}>
                  <Text style={[styles.recordAmount, { color: colors.text }]}>
                    {formatPaiseToRupees(item.amount)}
                  </Text>
                  <TouchableOpacity
                    onPress={() => handleDelete(item.id)}
                    style={styles.deleteBtn}
                  >
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
  topActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 20, fontWeight: '700' },
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
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: { fontSize: 14 },
  readOnlyField: {
    justifyContent: 'center',
    minHeight: 40,
  },
  readOnlyText: { fontSize: 14, fontWeight: '600' },
  rowFields: { flexDirection: 'row', gap: 12 },
  submitBtn: { alignItems: 'center', paddingVertical: 12, marginTop: 6 },
  submitBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  emptyCard: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  emptyText: { marginTop: 8, fontSize: 13 },
  recordCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
  },
  recordMain: { flex: 1, paddingRight: 12 },
  recordParticulars: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  recordMeta: { fontSize: 12 },
  recordBill: { fontSize: 11, marginTop: 2 },
  recordRight: { alignItems: 'flex-end', gap: 6 },
  recordAmount: { fontSize: 15, fontWeight: '700' },
  deleteBtn: { padding: 2 },
});