import { MaterialIcons } from '@expo/vector-icons';
import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';
import { listInvestmentPlans } from '../../repositories/investment.repository';
import { listRecurringExpenses } from '../../repositories/recurring-expense.repository';
import { listSubscriptions } from '../../repositories/subscription.repository';
import { formatPaiseToRupees } from '../../utils/currency';
import { formatDate } from '../../utils/date';
import { nextMonthlyDate } from '../../utils/recurring';

type Kind = 'subscription' | 'recurring' | 'investment';
type ScheduledItem = { id: string; kind: Kind; name: string; amount: number; due: number };
const kindLabels: Record<Kind, string> = { subscription: 'Subscription', recurring: 'Recurring expense', investment: 'SIP' };

export default function UpcomingPaymentsScreen() {
  const { colors } = useTheme();
  const [items, setItems] = useState<ScheduledItem[]>([]);
  const [filter, setFilter] = useState<Kind | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [subscriptions, recurring, investments] = await Promise.all([
        listSubscriptions(), listRecurringExpenses(), listInvestmentPlans(),
      ]);
      const now = new Date();
      const horizon = new Date(now.getFullYear(), now.getMonth() + 2, now.getDate()).getTime();
      const next: ScheduledItem[] = [];
      const addSchedule = (kind: Kind, id: string, name: string, amount: number, firstDue: number, day: number) => {
        let due = firstDue;
        if (due < todayStart) {
          next.push({ kind, id, name, amount, due });
          while (due < todayStart) due = nextMonthlyDate(due, day);
        }
        for (let count = 0; count < 3 && due <= horizon; count += 1) {
          next.push({ kind, id, name, amount, due });
          due = nextMonthlyDate(due, day);
        }
      };
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      subscriptions.forEach((item) => addSchedule('subscription', item.id, item.name, item.amount, item.next_due, item.day_of_month));
      recurring.forEach((item) => addSchedule('recurring', item.id, item.description || item.category_name || 'Recurring expense', item.amount, item.next_due, item.day_of_month));
      investments.filter((item) => item.frequency === 'monthly' && item.active).forEach((item) =>
        addSchedule('investment', item.id, item.name, item.amount, item.next_due, item.day_of_month));
      setItems(next.sort((a, b) => a.due - b.due || a.name.localeCompare(b.name)));
      setError(false);
    } catch (cause) {
      console.warn('Could not load upcoming payments:', cause);
      setError(true);
    } finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  const visible = filter === 'all' ? items : items.filter((item) => item.kind === filter);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const open = (item: ScheduledItem) => {
    if (item.kind === 'investment') router.push({ pathname: '/settings/investments/[id]', params: { id: item.id } });
    else if (item.kind === 'subscription') router.push({ pathname: '/settings/subscriptions/[id]', params: { id: item.id } });
    else router.push({ pathname: '/settings/recurring/[id]', params: { id: item.id } });
  };
  return <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
    <Stack.Screen options={{ title: 'Upcoming payments' }} />
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 45, gap: 14 }}>
      <Text style={{ color: colors.textSecondary, lineHeight: 20 }}>SIPs, subscriptions, and recurring expenses due in the next two months. Tap an item to review it.</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {(['all', 'investment', 'subscription', 'recurring'] as const).map((kind) => <TouchableOpacity key={kind} accessibilityRole="button" accessibilityState={{ selected: filter === kind }} onPress={() => setFilter(kind)}
          style={{ paddingHorizontal: 13, minHeight: 38, borderRadius: 99, backgroundColor: filter === kind ? colors.primary : colors.surfaceVariant, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: filter === kind ? colors.textInverse : colors.textSecondary, fontWeight: '700', fontSize: 12 }}>{kind === 'all' ? 'All' : kindLabels[kind]}</Text>
        </TouchableOpacity>)}
      </ScrollView>
      {loading && <Text style={{ color: colors.textSecondary }}>Loading upcoming payments…</Text>}
      {error && <TouchableOpacity accessibilityRole="button" onPress={() => { void refresh(); }}><Text style={{ color: colors.danger }}>Could not load payments. Tap to retry.</Text></TouchableOpacity>}
      {!loading && !error && visible.length === 0 && <View style={{ padding: 20, borderRadius: 16, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }}>
        <Text style={{ color: colors.text, fontWeight: '700' }}>Nothing scheduled</Text>
        <Text style={{ color: colors.textSecondary, marginTop: 4 }}>No matching payment is due in the next two months.</Text>
      </View>}
      {!loading && !error && visible.map((item) => <TouchableOpacity key={`${item.kind}-${item.id}-${item.due}`} accessibilityRole="button" onPress={() => open(item)}
        style={{ borderRadius: 16, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' }}>
          <MaterialIcons name={item.kind === 'investment' ? 'trending-up' : item.kind === 'subscription' ? 'subscriptions' : 'repeat'} size={21} color={colors.primary} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ color: colors.text, fontWeight: '800' }} numberOfLines={1}>{item.name}</Text>
          <Text style={{ color: item.due < today.getTime() ? colors.warning : colors.textSecondary, fontSize: 12 }}>{kindLabels[item.kind]} · {item.due < today.getTime() ? 'Overdue · ' : ''}{formatDate(item.due)}</Text>
        </View>
        <Text style={{ color: colors.text, fontWeight: '800' }} numberOfLines={1}>{formatPaiseToRupees(item.amount)}</Text>
      </TouchableOpacity>)}
    </ScrollView>
  </SafeAreaView>;
}
