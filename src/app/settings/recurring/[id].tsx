import { useCallback, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../../hooks/useTheme';
import { listRecurringExpenses, postDueRecurringExpenses, RecurringExpense } from '../../../repositories/recurring-expense.repository';
import { syncReminderNotifications } from '../../../services/reminder-notifications.service';
import { formatPaiseToRupees } from '../../../utils/currency';
import { formatDate } from '../../../utils/date';

export default function RecurringExpenseDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const [item, setItem] = useState<RecurringExpense | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recordedOnOpen, setRecordedOnOpen] = useState(false);
  useFocusEffect(useCallback(() => {
    let active = true;
    void postDueRecurringExpenses()
      .then(async (posted) => {
        if (posted > 0) await syncReminderNotifications();
        const records = await listRecurringExpenses();
        if (active) { setItem(records.find((record) => record.id === id) ?? null); setRecordedOnOpen(posted > 0); setError(null); }
      })
      .catch((cause) => { console.warn('Could not load recurring expense:', cause); if (active) setError('Could not load this expense. Please try again.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]));

  return <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
    <Stack.Screen options={{ title: 'Recurring Expense' }} />
    <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
      {loading ? <Text style={{ color: colors.textSecondary }}>Loading expense…</Text> : error ?
        <Text style={{ color: colors.danger }}>{error}</Text> : !item ?
        <Text style={{ color: colors.textSecondary }}>This recurring expense is no longer active.</Text> : <>
        {recordedOnOpen && <View style={{ backgroundColor: colors.successBackground, borderRadius: 12, padding: 14 }}><Text style={{ color: colors.success, fontWeight: '700' }}>Due recurring expenses were recorded.</Text></View>}
        <View style={{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 20, padding: 20, gap: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' }}>
              <MaterialIcons name="repeat" size={25} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '700' }}>MONTHLY EXPENSE</Text>
              <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800' }}>{item.description || item.category_name}</Text>
            </View>
          </View>
          <Text style={{ color: colors.text, fontSize: 34, fontWeight: '800' }}>{formatPaiseToRupees(item.amount)}</Text>
          <View style={{ height: 1, backgroundColor: colors.divider }} />
          <Text style={{ color: colors.textSecondary }}>Next scheduled date: {formatDate(item.next_due)}</Text>
          <Text style={{ color: colors.textSecondary }}>Category: {item.category_name} · {item.payment_method}</Text>
          <Text style={{ color: colors.textSecondary, lineHeight: 20 }}>Due expenses are recorded when you open the app. Dates such as the 31st use the last day of shorter months.</Text>
        </View>
        <TouchableOpacity accessibilityRole="button" onPress={() => router.push('/(tabs)/personal')}
          style={{ minHeight: 50, backgroundColor: colors.primary, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: colors.textInverse, fontWeight: '800' }}>View personal expenses</Text>
        </TouchableOpacity>
      </>}
    </ScrollView>
  </SafeAreaView>;
}
