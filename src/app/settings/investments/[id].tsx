import { MaterialIcons } from '@expo/vector-icons';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../hooks/useTheme';
import InvestmentDateField from '../../../components/InvestmentDateField';
import {
  getInvestmentPlan, InvestmentContribution, InvestmentPlan, listInvestmentContributions,
  recordInvestmentContribution, setInvestmentPlanActive, skipInvestmentMonth,
} from '../../../repositories/investment.repository';
import { syncReminderNotifications } from '../../../services/reminder-notifications.service';
import { formatPaiseToRupees, rupeesToPaise } from '../../../utils/currency';
import { formatDate } from '../../../utils/date';

export default function InvestmentDetailScreen() {
  const { id, dueAt } = useLocalSearchParams<{ id: string; dueAt?: string }>();
  const { colors } = useTheme();
  const [plan, setPlan] = useState<InvestmentPlan | null>(null);
  const [contributions, setContributions] = useState<InvestmentContribution[]>([]);
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    if (!id) return;
    const [nextPlan, nextContributions] = await Promise.all([getInvestmentPlan(id), listInvestmentContributions(id)]);
    setPlan(nextPlan);
    setContributions(nextContributions);
    if (nextPlan) setAmount((nextPlan.amount / 100).toFixed(2));
    setLoading(false);
  }, [id]);
  useFocusEffect(useCallback(() => {
    void refresh().catch((cause) => { console.warn('Could not load SIP:', cause); setLoading(false); });
  }, [refresh]));

  const finishAction = async (action: () => Promise<void>, errorTitle: string, successMessage: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await action();
      await refresh();
      await syncReminderNotifications().catch((cause) => console.warn('Could not update investment reminders:', cause));
      setActionMessage(successMessage);
    } catch (cause) {
      Alert.alert(errorTitle, cause instanceof Error ? cause.message : 'Please try again.');
    } finally { setBusy(false); }
  };

  const record = () => {
    let paise: number;
    try { paise = rupeesToPaise(amount); }
    catch { Alert.alert('Invalid amount', 'Enter the amount actually invested.'); return; }
    if (paise <= 0) { Alert.alert('Invalid amount', 'Enter the amount actually invested.'); return; }
    void finishAction(async () => { await recordInvestmentContribution(id, paise, paymentDate); setPaymentDate(Date.now()); }, 'Could not record contribution', 'Investment recorded. The next installment is scheduled.');
  };
  const skip = () => Alert.alert('Skip this installment?', 'No investment will be recorded. The plan will move to its next monthly date.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Skip installment', onPress: () => { void finishAction(() => skipInvestmentMonth(id), 'Could not skip installment', 'Installment skipped. No contribution was recorded.'); } },
  ]);
  const toggleActive = () => Alert.alert(plan?.active ? 'Pause SIP plan?' : 'Resume SIP plan?',
    plan?.active ? 'Reminders will stop. Your contribution history will stay here.' : 'The next reminder will use the next upcoming due date.', [
      { text: 'Cancel', style: 'cancel' },
      { text: plan?.active ? 'Pause plan' : 'Resume plan', onPress: () => { void finishAction(() => setInvestmentPlanActive(id, !plan?.active), 'Could not update SIP plan', plan?.active ? 'SIP plan paused.' : 'SIP plan resumed.'); } },
    ]);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = plan && plan.next_due <= today.getTime();
  const reminderUpdated = !!dueAt && !!plan && plan.next_due !== Number(dueAt);
  const oneTime = plan?.frequency === 'one_time';

  return <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
    <Stack.Screen options={{ title: plan?.name || 'Investment' }} />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingBottom: 45, gap: 16 }}>
      {loading ? <Text style={{ color: colors.textSecondary }}>Loading investment…</Text> : !plan ? <Text style={{ color: colors.textSecondary }}>This investment plan is unavailable.</Text> : <>
        <View style={{ backgroundColor: colors.primaryLight, borderRadius: 20, padding: 20, gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 45, height: 45, borderRadius: 14, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }}><MaterialIcons name="trending-up" size={25} color={colors.primary} /></View>
            <View style={{ flex: 1 }}><Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '800' }}>{oneTime ? 'ONE-TIME INVESTMENT' : 'MONTHLY SIP'}</Text><Text style={{ color: colors.text, fontSize: 19, fontWeight: '800' }}>{plan.name}</Text></View>
          </View>
          <Text style={{ color: colors.text, fontSize: 30, fontWeight: '800' }} adjustsFontSizeToFit numberOfLines={1}>{formatPaiseToRupees(plan.amount)}</Text>
          <Text style={{ color: colors.textSecondary }}>{oneTime ? `Invested ${formatDate(plan.next_due)}` : plan.active ? `${due ? 'Due' : 'Next due'} ${formatDate(plan.next_due)} · day ${plan.day_of_month} each month` : 'Paused · reminders off'}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 15, padding: 15, gap: 4 }}><Text style={{ color: colors.textSecondary, fontSize: 12 }}>Total contributed</Text><Text style={{ color: colors.text, fontSize: 17, fontWeight: '800' }} numberOfLines={1} adjustsFontSizeToFit>{formatPaiseToRupees(plan.total_invested)}</Text></View>
          <View style={{ flex: 1, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 15, padding: 15, gap: 4 }}><Text style={{ color: colors.textSecondary, fontSize: 12 }}>Installments</Text><Text style={{ color: colors.text, fontSize: 17, fontWeight: '800' }}>{plan.contribution_count}</Text></View>
        </View>
        {actionMessage && <View style={{ backgroundColor: colors.successBackground, borderRadius: 12, padding: 14 }}><Text style={{ color: colors.success, fontWeight: '700' }}>{actionMessage}</Text></View>}
        {reminderUpdated && !actionMessage && <View style={{ backgroundColor: colors.surfaceVariant, borderRadius: 12, padding: 14 }}><Text style={{ color: colors.textSecondary }}>This reminder is no longer current. The plan’s next installment is shown above.</Text></View>}
        {!oneTime && plan.active && !reminderUpdated && <View style={{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: 16, gap: 12 }}>
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: '800' }}>Record an installment</Text>
          <Text style={{ color: colors.textSecondary, lineHeight: 19 }}>Enter the amount actually invested. This stays in Investments and does not change expense budgets.</Text>
          <View style={{ gap: 5 }}><Text style={{ color: colors.textSecondary, fontWeight: '700', fontSize: 12 }}>AMOUNT INVESTED (₹)</Text><TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="Amount in rupees" placeholderTextColor={colors.textMuted}
            accessibilityLabel="Amount invested in rupees" style={{ minHeight: 50, backgroundColor: colors.surfaceVariant, borderRadius: 12, paddingHorizontal: 14, color: colors.text, fontSize: 17 }} /></View>
          <InvestmentDateField value={paymentDate} onChange={setPaymentDate} />
          <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={record} style={{ minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.primary, opacity: busy ? 0.6 : 1 }}><Text style={{ color: colors.textInverse, fontWeight: '800' }}>{busy ? 'Updating…' : 'Record investment'}</Text></TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={skip} style={{ minHeight: 42, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.textSecondary, fontWeight: '700' }}>Skip installment</Text></TouchableOpacity>
        </View>}
        {!oneTime && <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity accessibilityRole="button" onPress={() => router.push({ pathname: '/settings/investments/form', params: { id } })} style={{ flex: 1, minHeight: 46, borderColor: colors.border, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.primary, fontWeight: '700' }}>Edit plan</Text></TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={toggleActive} style={{ flex: 1, minHeight: 46, borderColor: colors.border, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.text, fontWeight: '700' }}>{plan.active ? 'Pause plan' : 'Resume plan'}</Text></TouchableOpacity>
        </View>}
        <View style={{ gap: 8, marginTop: 5 }}><Text style={{ color: colors.text, fontSize: 19, fontWeight: '800' }}>Contribution history</Text><Text style={{ color: colors.textSecondary }}>{contributions.length} recorded installments</Text></View>
        {contributions.length === 0 && <Text style={{ color: colors.textSecondary }}>Your contributions will appear here after you record them.</Text>}
        {contributions.map((item) => <TouchableOpacity key={item.id} accessibilityRole="button" accessibilityLabel={`Edit investment entry from ${formatDate(item.invested_at)}`} onPress={() => router.push({ pathname: '/settings/investments/contribution/[id]', params: { id: item.id } })} style={{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 13, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: colors.successBackground, alignItems: 'center', justifyContent: 'center' }}><MaterialIcons name="check" size={20} color={colors.success} /></View>
          <View style={{ flex: 1 }}><Text style={{ color: colors.text, fontWeight: '700' }}>Invested {formatDate(item.invested_at)}</Text><Text style={{ color: colors.textSecondary, fontSize: 12 }}>Scheduled {formatDate(item.due_at)}</Text></View>
          <Text style={{ color: colors.text, fontWeight: '800' }}>{formatPaiseToRupees(item.amount)}</Text>
          <MaterialIcons name="chevron-right" size={20} color={colors.textMuted} />
        </TouchableOpacity>)}
      </>}
    </ScrollView>
  </SafeAreaView>;
}
