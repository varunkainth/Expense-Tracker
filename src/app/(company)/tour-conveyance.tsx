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
import { tourConveyanceRepository } from '../../repositories/company/tour-conveyance.repository';
import { employeeRepository } from '../../repositories/company/employee.repository';
import { EmployeeDetails, TourConveyance } from '../../types/company';
import { formatPaiseToRupees, rupeesToPaise } from '../../utils/currency';
import { formatDate } from '../../utils/date';
import { validateAmount, validateRequiredText } from '../../utils/validation';
import { DateField, todayMidnight } from '../../components/datafield';

export default function TourConveyanceScreen() {
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const router = useRouter();

  const [employee, setEmployee] = useState<EmployeeDetails | null>(null);
  const [records, setRecords] = useState<TourConveyance[]>([]);
  const [showForm, setShowForm] = useState(false);

  // Form State
  const [date, setDate] = useState<number>(todayMidnight);
  const [fromLocation, setFromLocation] = useState('');
  const [toLocation, setToLocation] = useState('');
  const [mode, setMode] = useState('Cab');
  const [fareStr, setFareStr] = useState('');
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const emps = await employeeRepository.getAll();
      if (emps.length > 0) {
        setEmployee(emps[0]);
        const list = await tourConveyanceRepository.getAll(emps[0].id);
        setRecords(list);
      } else {
        setEmployee(null);
        setRecords([]);
      }
    } catch (err) {
      console.error('Error loading tour conveyance:', err);
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

    const vFrom = validateRequiredText(fromLocation, 'From Location');
    if (!vFrom.isValid) {
      Alert.alert('Validation Error', vFrom.error);
      return;
    }

    const vTo = validateRequiredText(toLocation, 'To Location');
    if (!vTo.isValid) {
      Alert.alert('Validation Error', vTo.error);
      return;
    }

    if (!fareStr || parseFloat(fareStr) <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid fare.');
      return;
    }

    try {
      setLoading(true);
      const farePaise = rupeesToPaise(fareStr);
      const vAmt = validateAmount(farePaise);
      if (!vAmt.isValid) {
        Alert.alert('Validation Error', vAmt.error);
        return;
      }

      await tourConveyanceRepository.create({
        employee_id: employee.id,
        date,
        from_location: fromLocation.trim(),
        to_location: toLocation.trim(),
        mode: mode.trim(),
        fare: farePaise,
      });

      setFromLocation('');
      setToLocation('');
      setFareStr('');
      setDate(todayMidnight());
      setShowForm(false);
      await loadData();
    } catch (err) {
      console.error('Failed to save tour conveyance:', err);
      Alert.alert('Error', 'Failed to save record.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Record', 'Are you sure you want to delete this tour conveyance record?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await tourConveyanceRepository.delete(id);
            await loadData();
          } catch (err) {
            console.error('Failed to delete tour conveyance:', err);
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
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Tour Conveyance</Text>
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

          {showForm && (
            <View
              style={[
                styles.formCard,
                { backgroundColor: colors.card, borderColor: colors.border, borderRadius: borderRadius.lg, ...shadows.sm },
              ]}
            >
              <Text style={[styles.formTitle, { color: colors.text }]}>New Tour Travel Entry</Text>

              <DateField
                label="Date *"
                value={date}
                onChange={setDate}
                maximumDate={new Date()}
              />

              <View style={styles.rowFields}>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>From *</Text>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: colors.surfaceVariant, color: colors.text }]}
                    placeholder="e.g. Hotel"
                    placeholderTextColor={colors.textMuted}
                    value={fromLocation}
                    onChangeText={setFromLocation}
                  />
                </View>

                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>To *</Text>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: colors.surfaceVariant, color: colors.text }]}
                    placeholder="e.g. Client Clinic"
                    placeholderTextColor={colors.textMuted}
                    value={toLocation}
                    onChangeText={setToLocation}
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Mode *</Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: colors.surfaceVariant, color: colors.text }]}
                  placeholder="e.g. Auto / Cab / Bus"
                  placeholderTextColor={colors.textMuted}
                  value={mode}
                  onChangeText={setMode}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Fare (₹) *</Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: colors.surfaceVariant, color: colors.text, fontSize: 18, fontWeight: '700' }]}
                  placeholder="0.00"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad"
                  value={fareStr}
                  onChangeText={setFareStr}
                />
              </View>

              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: colors.primary, borderRadius: borderRadius.md }]}
                onPress={handleSave}
                disabled={loading}
              >
                <Text style={styles.submitBtnText}>{loading ? 'Saving...' : 'Save Tour Entry'}</Text>
              </TouchableOpacity>
            </View>
          )}

          {records.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.card, borderRadius: borderRadius.md }]}>
              <MaterialIcons name="commute" size={40} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No tour conveyance records yet.</Text>
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
                  <Text style={[styles.recordParticulars, { color: colors.text }]}>
                    {item.from_location} → {item.to_location}
                  </Text>
                  <Text style={[styles.recordMeta, { color: colors.textSecondary }]}>
                    {formatDate(item.date)} • {item.mode}
                  </Text>
                </View>

                <View style={styles.recordRight}>
                  <Text style={[styles.recordAmount, { color: colors.text }]}>{formatPaiseToRupees(item.fare)}</Text>
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