import { useCallback, useState } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../../hooks/useTheme';
import {
  confirmSubscriptionPayment, listSubscriptions, remindSubscriptionTomorrow,
  skipSubscriptionThisMonth, Subscription,
} from '../../../repositories/subscription.repository';
import { syncReminderNotifications } from '../../../services/reminder-notifications.service';
import { formatPaiseToRupees } from '../../../utils/currency';
import { formatDate } from '../../../utils/date';

export default function SubscriptionReviewScreen() {
  const { id, dueAt } = useLocalSearchParams<{ id: string; dueAt?: string }>();
  const { colors } = useTheme();
  const [item, setItem] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const refresh = useCallback(async () => {
    const records = await listSubscriptions();
    setItem(records.find((record) => record.id === id) ?? null);
    setLoading(false);
  }, [id]);
  useFocusEffect(useCallback(() => {
    void refresh().catch((cause) => { console.warn('Could not load subscription:', cause); setLoading(false); });
  }, [refresh]));

  const act = async (action: (subscription: Subscription) => Promise<void>, success: string) => {
    if (!item || busy) return;
    setBusy(true);
    try {
      await action(item);
      await syncReminderNotifications().catch((cause) => console.warn('Could not update subscription reminders:', cause));
      await refresh();
      setMessage(success);
      setCompleted(true);
    } catch (cause) {
      console.warn('Could not update subscription:', cause);
      Alert.alert('Could not update subscription', 'Please try again.');
    } finally { setBusy(false); }
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueLabel = item && item.next_due < today.getTime() ? 'Overdue' :
    item && item.next_due < today.getTime() + 86400000 ? 'Due today' : 'Upcoming';
  const reminderUpdated = !!dueAt && !!item && item.next_due !== Number(dueAt);

  return <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
    <Stack.Screen options={{ title: item?.name || 'Subscription' }} />
    <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
      {loading ? <Text style={{ color: colors.textSecondary }}>Loading subscription…</Text> : !item ?
        <Text style={{ color: colors.textSecondary }}>This subscription is no longer available.</Text> : <>
        <View style={{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 20, padding: 20, gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' }}>
              <MaterialIcons name="subscriptions" size={24} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '700' }}>SUBSCRIPTION</Text>
              <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800' }}>{item.name}</Text>
            </View>
          </View>
          <Text style={{ color: colors.text, fontSize: 34, fontWeight: '800' }}>{formatPaiseToRupees(item.amount)}</Text>
          <View style={{ alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99, backgroundColor: colors.warningBackground }}>
            <Text style={{ color: colors.warning, fontWeight: '700' }}>{dueLabel}</Text>
          </View>
          <Text style={{ color: colors.textSecondary }}>Payment day: {formatDate(item.next_due)} · {item.payment_method}</Text>
          <Text style={{ color: colors.textSecondary }}>Category: {item.category_name}</Text>
        </View>
        {message && <View style={{ backgroundColor: colors.successBackground, padding: 14, borderRadius: 12 }}><Text style={{ color: colors.success, fontWeight: '700' }}>{message}</Text></View>}
        {reminderUpdated && <View style={{ backgroundColor: colors.surfaceVariant, padding: 14, borderRadius: 12 }}><Text style={{ color: colors.textSecondary }}>This reminder has already changed. The next payment date is shown above.</Text></View>}
        {!reminderUpdated && !completed && <>
        <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => { void act(confirmSubscriptionPayment, 'Payment recorded. Next month is scheduled.'); }}
          style={{ minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.primary, opacity: busy ? 0.6 : 1 }}>
          <Text style={{ color: colors.textInverse, fontWeight: '800', fontSize: 16 }}>{busy ? 'Updating…' : 'Mark as paid'}</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => { void act((record) => remindSubscriptionTomorrow(record.id), 'We will remind you tomorrow.'); }}
          style={{ minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>Remind me tomorrow</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => { void act(skipSubscriptionThisMonth, 'Skipped this month.'); }}
          style={{ minHeight: 46, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>Skip this month</Text>
        </TouchableOpacity>
        </>}
      </>}
    </ScrollView>
  </SafeAreaView>;
}
