import { MaterialIcons } from '@expo/vector-icons';
import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';
import { InvestmentPlan, listInvestmentPlans } from '../../repositories/investment.repository';
import { formatPaiseToRupees } from '../../utils/currency';
import { formatDate } from '../../utils/date';

export default function InvestmentsScreen() {
  const { colors } = useTheme();
  const [plans, setPlans] = useState<InvestmentPlan[]>([]);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    try { setPlans(await listInvestmentPlans()); setError(null); }
    catch (cause) { console.warn('Could not load investments:', cause); setError('Could not load investments. Please try again.'); }
  }, []);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  const totalInvested = plans.reduce((total, plan) => total + plan.total_invested, 0);
  const monthlyScheduled = plans.filter((plan) => plan.active).reduce((total, plan) => total + plan.amount, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
    <Stack.Screen options={{ title: 'Investments' }} />
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 16 }}>
      <View style={{ backgroundColor: colors.primaryLight, borderRadius: 20, padding: 20, gap: 6 }}>
        <Text style={{ color: colors.textSecondary, fontWeight: '700', fontSize: 12, letterSpacing: 0.5 }}>TOTAL CONTRIBUTED</Text>
        <Text style={{ color: colors.text, fontSize: 30, fontWeight: '800' }} adjustsFontSizeToFit numberOfLines={1}>{formatPaiseToRupees(totalInvested)}</Text>
        <Text style={{ color: colors.textSecondary }}>Scheduled each month: {formatPaiseToRupees(monthlyScheduled)}</Text>
      </View>
      <Text style={{ color: colors.textSecondary, lineHeight: 20 }}>Record monthly SIPs or one-time investments. Contributions appear in your total outflow, while expense budgets stay focused on spending.</Text>
      <TouchableOpacity accessibilityRole="button" onPress={() => router.push('/settings/investments/form')}
        style={{ minHeight: 50, backgroundColor: colors.primary, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <MaterialIcons name="add" size={22} color={colors.textInverse} />
        <Text style={{ color: colors.textInverse, fontWeight: '800', fontSize: 15 }}>Add SIP plan</Text>
      </TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" onPress={() => router.push('/settings/investments/one-time')}
        style={{ minHeight: 50, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <MaterialIcons name="add-circle-outline" size={22} color={colors.primary} />
        <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 15 }}>Record one-time investment</Text>
      </TouchableOpacity>
      {error && <TouchableOpacity accessibilityRole="button" onPress={() => { void refresh(); }}><Text style={{ color: colors.danger }}>{error} Tap to retry.</Text></TouchableOpacity>}
      {!error && plans.length === 0 && <View style={{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: 20, gap: 6 }}>
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>No investments yet</Text>
        <Text style={{ color: colors.textSecondary, lineHeight: 20 }}>Add a monthly SIP or record an investment you made once.</Text>
      </View>}
      {plans.map((plan) => {
        const oneTime = plan.frequency === 'one_time';
        const due = !oneTime && plan.active && plan.next_due <= today.getTime();
        return <TouchableOpacity key={plan.id} accessibilityRole="button" accessibilityLabel={`View ${plan.name} investment`} onPress={() => router.push({ pathname: '/settings/investments/[id]', params: { id: plan.id } })}
          style={{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: 16, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
            <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' }}><MaterialIcons name="trending-up" size={22} color={colors.primary} /></View>
            <View style={{ flex: 1 }}><Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }} numberOfLines={1}>{plan.name}</Text><Text style={{ color: colors.textSecondary, fontSize: 12 }}>{oneTime ? `One-time · ${formatDate(plan.next_due)}` : plan.active ? `Next ${formatDate(plan.next_due)}` : 'Paused'}</Text></View>
            <MaterialIcons name="chevron-right" size={22} color={colors.textSecondary} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
            <View><Text style={{ color: colors.textSecondary, fontSize: 11 }}>{oneTime ? 'ONE-TIME' : 'MONTHLY SIP'}</Text><Text style={{ color: colors.text, fontWeight: '800' }}>{formatPaiseToRupees(plan.amount)}</Text></View>
            <View style={{ alignItems: 'flex-end' }}><Text style={{ color: colors.textSecondary, fontSize: 11 }}>CONTRIBUTED</Text><Text style={{ color: colors.text, fontWeight: '800' }}>{formatPaiseToRupees(plan.total_invested)}</Text></View>
          </View>
          {due && <View style={{ alignSelf: 'flex-start', backgroundColor: colors.warningBackground, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99 }}><Text style={{ color: colors.warning, fontWeight: '700', fontSize: 12 }}>Installment due · tap to record</Text></View>}
        </TouchableOpacity>;
      })}
    </ScrollView>
  </SafeAreaView>;
}
