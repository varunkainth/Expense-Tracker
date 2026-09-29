import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { miscellaneousRepository } from '../../repositories/company/miscellaneous.repository';
import { employeeRepository } from '../../repositories/company/employee.repository';
import { EmployeeDetails, MiscellaneousExpense } from '../../types/company';
import { formatPaiseToRupees, rupeesToPaise } from '../../utils/currency';
import { formatDate } from '../../utils/date';
import { validateAmount, validateRequiredText } from '../../utils/validation';
import { DateField, todayMidnight } from '../../components/datafield';

export default function MiscellaneousExpenseScreen() {
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const router = useRouter();

  const [employee, setEmployee] = useState<EmployeeDetails | null>(null);
  const [records, setRecords] = useState<MiscellaneousExpense[]>([]);
  const [showForm, setShowForm] = useState(false);

  // Form State
  const [date, setDate] = useState<number>(todayMidnight);
  const [particulars, setParticulars] = useState('');
  const [billNo, setBillNo] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const emps = await employeeRepository.getAll();
      if (emps.length > 0) {
        setEmployee(emps[0]);
        const list = await miscellaneousRepository.getAll(emps[0].id);
        setRecords(list);
      } else {
        setEmployee(null);
        setRecords([]);
      }
    } catch (err) {
      console.error('Error loading miscellaneous expenses:', err);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleSave = async () => {
    if (!employee) {
      Alert.alert('Employee Required', 'Please set up an employee profile first.', [
        { text: 'Set Up', onPress: () => router.push('/(company)/employee') },
      ]);
      return;
    }

    const vPart = validateRequiredText(particulars, 'Particulars');
    if (!vPart.isValid) {
      Alert.alert('Validation Error', vPart.error);
      return;
    }

    const vBill = validateRequiredText(billNo, 'Bill No');
    if (!vBill.isValid) {
      Alert.alert('Validation Error', vBill.error);
      return;
    }

    if (!amountStr || parseFloat(amountStr) <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid amount.');
      return;
    }

    try {
      setLoading(true);
      const amountPaise = rupeesToPaise(amountStr);
      const vAmt = validateAmount(amountPaise);
      if (!vAmt.isValid) {
        Alert.alert('Validation Error', vAmt.error);
        return;
      }

      await miscellaneousRepository.create({
        employee_id: employee.id,
        date,
        particulars: particulars.trim(),
        bill_no: billNo.trim(),
        amount: amountPaise,
      });

      setParticulars('');
      setBillNo('');
      setAmountStr('');
      setDate(todayMidnight());
      setShowForm(false);
      await loadData();
    } catch (err) {
      console.error('Failed to save miscellaneous expense:', err);
      Alert.alert('Error', 'Failed to save record.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Record', 'Are you sure you want to delete this expense?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await miscellaneousRepository.delete(id);
            await loadData();
          } catch (err) {
            console.error('Failed to delete miscellaneous expense:', err);
            Alert.alert('Error', 'Failed to delete record.');
          }
        },
      },
    ]);
  };

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
          <View style={styles.topActionRow}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Miscellaneous Expenses</Text>
            <TouchableOpacity
              style={[styles.toggleBtn, { backgroundColor: showForm ? colors.surfaceVariant : colors.primary }]}
              onPress={() => setShowForm(!showForm)}
            >
              <MaterialIcons name={showForm ? 'close' : 'add'} size={20} color={showForm ? colors.text : '#fff'} />
              <Text style={[styles.toggleBtnText, { color: showForm ? colors.text : '#fff' }]}>
                {showForm ? 'Cancel' : 'Add Expense'}
              </Text>
            </TouchableOpacity>
          </View>

          {showForm && (
            <View
              style={[
                styles.formCard,
                { backgroundColor: colors.card, borderColor: colors.border, borderRadius: borderRadius.lg, ...shadows.sm },
              ]}
            >
              <Text style={[styles.formTitle, { color: colors.text }]}>New Miscellaneous Expense</Text>

              <DateField
                label="Expense Date *"
                value={date}
                onChange={setDate}
                maximumDate={new Date()}
              />

              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Particulars *</Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: colors.surfaceVariant, color: colors.text }]}
                  placeholder="e.g. Wire, cables, connectors for equipment setup"
                  placeholderTextColor={colors.textMuted}
                  value={particulars}
                  onChangeText={setParticulars}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Bill / Cash Memo No *</Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: colors.surfaceVariant, color: colors.text }]}
                  placeholder="e.g. CM-4491"
                  placeholderTextColor={colors.textMuted}
                  value={billNo}
                  onChangeText={setBillNo}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Amount (₹) *</Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: colors.surfaceVariant, color: colors.text, fontSize: 18, fontWeight: '700' }]}
                  placeholder="0.00"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad"
                  value={amountStr}
                  onChangeText={setAmountStr}
                />
              </View>

              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: colors.primary, borderRadius: borderRadius.md }]}
                onPress={handleSave}
                disabled={loading}
              >
                <Text style={styles.submitBtnText}>{loading ? 'Saving...' : 'Save Expense'}</Text>
              </TouchableOpacity>
            </View>
          )}

          {records.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.card, borderRadius: borderRadius.md }]}>
              <MaterialIcons name="category" size={40} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No miscellaneous expenses recorded.</Text>
            </View>
          ) : (
            records.map((item) => (
              <View
                key={item.id}
                style={[
                  styles.recordCard,
                  { backgroundColor: colors.card, borderColor: colors.border, borderRadius: borderRadius.md, ...shadows.sm },
                ]}
              >
                <View style={styles.recordMain}>
                  <Text style={[styles.recordParticulars, { color: colors.text }]}>{item.particulars}</Text>
                  <Text style={[styles.recordMeta, { color: colors.textSecondary }]}>
                    {formatDate(item.date)} • Bill: {item.bill_no}
                  </Text>
                </View>

                <View style={styles.recordRight}>
                  <Text style={[styles.recordAmount, { color: colors.text }]}>{formatPaiseToRupees(item.amount)}</Text>
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
  recordRight: { alignItems: 'flex-end', gap: 6 },
  recordAmount: { fontSize: 15, fontWeight: '700' },
  deleteBtn: { padding: 2 },
});