import { useCallback, useState } from 'react';
import { Alert, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { router, Stack, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';
import { listRecurringExpenses, RecurringExpense, stopRecurringExpense } from '../../repositories/recurring-expense.repository';
import { formatPaiseToRupees } from '../../utils/currency';
import { formatDate } from '../../utils/date';
import { syncReminderNotifications } from '../../services/reminder-notifications.service';

export default function RecurringExpensesScreen() {
  const { colors } = useTheme();
  const [records, setRecords] = useState<RecurringExpense[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [scheduleToStop, setScheduleToStop] = useState<RecurringExpense | null>(null);
  const [stopping, setStopping] = useState(false);
  const refresh = useCallback(async () => {
    try { setRecords(await listRecurringExpenses()); setError(null); }
    catch { setError('Could not load recurring expenses. Please reopen this screen.'); }
  }, []);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  const confirmStop = async () => {
    if (!scheduleToStop || stopping) return;
    setStopping(true);
    try {
      await stopRecurringExpense(scheduleToStop.id);
      await syncReminderNotifications().catch((cause) => console.warn('Could not update recurring reminders:', cause));
      setScheduleToStop(null);
      await refresh();
    } catch {
      Alert.alert('Could not stop expense', 'Please try again.');
    } finally {
      setStopping(false);
    }
  };
  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ title: 'Recurring Expenses' }} />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        <Text style={{ color: colors.textSecondary, lineHeight: 22 }}>Monthly expenses are recorded when you open Personal, including missed months. Dates such as the 31st use the last day of shorter months. Stop a schedule before its next date if you no longer pay it.</Text>
        <TouchableOpacity accessibilityRole="button" onPress={() => router.push({ pathname: '/(personal)/add-expense', params: { recurring: 'true' } })}
          style={{ backgroundColor: colors.primary, padding: 15, borderRadius: 12 }}>
          <Text style={{ color: colors.textInverse, textAlign: 'center', fontWeight: '700' }}>Add monthly expense</Text>
        </TouchableOpacity>
        {error && <Text style={{ color: colors.danger }}>{error}</Text>}
        {!error && records.length === 0 && <Text style={{ color: colors.textSecondary }}>No recurring expenses yet. Use this for rent, subscriptions, or regular bills.</Text>}
        {records.map((record) => <View key={record.id} style={{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 16, gap: 8 }}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>{record.description || record.category_name}</Text>
          <Text style={{ color: colors.text }}>{formatPaiseToRupees(record.amount)} · {record.payment_method}</Text>
          <Text style={{ color: colors.textSecondary }}>Next: {formatDate(record.next_due)} · day {record.day_of_month} each month</Text>
          <TouchableOpacity accessibilityRole="button" onPress={() => router.push({ pathname: '/settings/recurring/[id]', params: { id: record.id } })} style={{ paddingVertical: 8 }}>
            <Text style={{ color: colors.primary, fontWeight: '700' }}>View details →</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" onPress={() => setScheduleToStop(record)} style={{ paddingVertical: 10 }}>
            <Text style={{ color: colors.danger }}>Stop repeating</Text>
          </TouchableOpacity>
        </View>)}
      </ScrollView>

      <Modal
        visible={scheduleToStop !== null}
        transparent
        animationType="fade"
        onRequestClose={() => !stopping && setScheduleToStop(null)}
      >
        <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0, 0, 0, 0.48)' }}>
          <View style={{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 20, padding: 20, gap: 16 }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.dangerBackground }}>
              <Text style={{ color: colors.danger, fontSize: 24, fontWeight: '700' }}>×</Text>
            </View>
            <View style={{ gap: 6 }}>
              <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700' }}>Stop recurring expense?</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 21 }}>
                {scheduleToStop && `${scheduleToStop.description || scheduleToStop.category_name} will no longer be added automatically each month.`}
              </Text>
            </View>
            <View style={{ padding: 12, borderRadius: 12, backgroundColor: colors.surfaceVariant, gap: 3 }}>
              <Text style={{ color: colors.text, fontWeight: '700' }}>{scheduleToStop && formatPaiseToRupees(scheduleToStop.amount)}</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Past expenses will remain in your history.</Text>
            </View>
            <View style={{ gap: 10 }}>
              <TouchableOpacity
                accessibilityRole="button"
                disabled={stopping}
                onPress={confirmStop}
                style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.danger, opacity: stopping ? 0.65 : 1 }}
              >
                <Text style={{ color: colors.textInverse, fontWeight: '700' }}>{stopping ? 'Stopping…' : 'Stop repeating'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                disabled={stopping}
                onPress={() => setScheduleToStop(null)}
                style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: colors.border }}
              >
                <Text style={{ color: colors.text, fontWeight: '700' }}>Keep recurring</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
