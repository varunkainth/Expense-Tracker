import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import InvestmentDateField from '../../../../components/InvestmentDateField';
import { useTheme } from '../../../../hooks/useTheme';
import { deleteInvestmentContribution, getInvestmentContribution, getInvestmentPlan, updateInvestmentContribution } from '../../../../repositories/investment.repository';
import { rupeesToPaise } from '../../../../utils/currency';

export default function EditInvestmentContributionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => Date.now());
  const [isOneTime, setIsOneTime] = useState(false);
  const [name, setName] = useState('');
  const [exists, setExists] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  useFocusEffect(useCallback(() => {
    let active = true;
    void getInvestmentContribution(id).then(async (entry) => {
      if (!active) return;
      if (entry) {
        const plan = await getInvestmentPlan(entry.plan_id);
        if (!active) return;
        setAmount((entry.amount / 100).toFixed(2));
        setDate(entry.invested_at);
        setIsOneTime(plan?.frequency === 'one_time');
        setName(plan?.name ?? '');
        setExists(true);
      }
      setLoaded(true);
    }).catch((cause) => { console.warn('Could not load contribution:', cause); if (active) setLoaded(true); });
    return () => { active = false; };
  }, [id]));
  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await updateInvestmentContribution(id, rupeesToPaise(amount), date, isOneTime ? name : undefined);
      router.back();
    } catch (cause) { Alert.alert('Could not update contribution', cause instanceof Error ? cause.message : 'Please try again.'); }
    finally { setBusy(false); }
  };
  const remove = () => Alert.alert('Delete this investment entry?', isOneTime
    ? 'This one-time investment and its entry will be removed from your outflow totals.'
    : 'This entry will be removed from outflow totals. The monthly SIP schedule will stay the same.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: () => {
      if (busy) return;
      setBusy(true);
      void deleteInvestmentContribution(id).then(() => {
        if (isOneTime) router.replace('/settings/investments');
        else router.back();
      }).catch((cause) => Alert.alert('Could not delete entry', cause instanceof Error ? cause.message : 'Please try again.'))
        .finally(() => setBusy(false));
    } },
  ]);
  return <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
    <Stack.Screen options={{ title: 'Edit investment entry' }} />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 20 }}>
      {!loaded ? <Text style={{ color: colors.textSecondary }}>Loading entry…</Text> : !exists ? <Text style={{ color: colors.textSecondary }}>This entry is unavailable.</Text> : <>
        {isOneTime && <View style={{ gap: 6 }}><Text style={{ color: colors.text, fontWeight: '700' }}>Investment name</Text>
          <TextInput value={name} onChangeText={setName} placeholder="Investment name" placeholderTextColor={colors.textMuted}
            style={{ minHeight: 52, borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, color: colors.text, paddingHorizontal: 14, fontSize: 16 }} /></View>}
        <View style={{ gap: 6 }}><Text style={{ color: colors.text, fontWeight: '700' }}>Amount invested (₹)</Text>
          <TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="Amount in rupees" placeholderTextColor={colors.textMuted}
            style={{ minHeight: 52, borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, color: colors.text, paddingHorizontal: 14, fontSize: 16 }} /></View>
        <InvestmentDateField value={date} onChange={setDate} />
        <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => { void save(); }}
          style={{ minHeight: 52, borderRadius: 14, backgroundColor: colors.primary, opacity: busy ? 0.6 : 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: colors.textInverse, fontWeight: '800', fontSize: 16 }}>{busy ? 'Saving…' : 'Save changes'}</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={remove} style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: colors.danger, fontWeight: '700' }}>Delete entry</Text>
        </TouchableOpacity>
      </>}
    </ScrollView>
  </SafeAreaView>;
}
