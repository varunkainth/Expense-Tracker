import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../hooks/useTheme';
import { createInvestmentPlan, getInvestmentPlan, updateInvestmentPlan } from '../../../repositories/investment.repository';
import { remindersEnabled, requestReminderPermission, syncReminderNotifications } from '../../../services/reminder-notifications.service';
import { rupeesToPaise } from '../../../utils/currency';

export default function InvestmentPlanFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { colors } = useTheme();
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [day, setDay] = useState('');
  const [saving, setSaving] = useState(false);
  useFocusEffect(useCallback(() => {
    if (!id) return;
    void getInvestmentPlan(id).then((plan) => {
      if (!plan) return;
      setName(plan.name); setAmount((plan.amount / 100).toFixed(2)); setDay(String(plan.day_of_month));
    }).catch((cause) => console.warn('Could not load investment plan:', cause));
  }, [id]));
  const save = async () => {
    if (saving) return;
    let paise: number;
    try { paise = rupeesToPaise(amount); }
    catch { Alert.alert('Invalid amount', 'Enter an amount in rupees.'); return; }
    const dueDay = Number(day);
    if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) { Alert.alert('Invalid day', 'Choose a day from 1 to 31.'); return; }
    setSaving(true);
    try {
      if (id) await updateInvestmentPlan(id, name, paise, dueDay);
      else await createInvestmentPlan(name, paise, dueDay);
      try {
        if (await remindersEnabled('investment')) await requestReminderPermission();
        await syncReminderNotifications();
      } catch (cause) { console.warn('Could not update investment reminders:', cause); }
      router.back();
    } catch (cause) {
      Alert.alert('Could not save SIP', cause instanceof Error ? cause.message : 'Please try again.');
    } finally { setSaving(false); }
  };
  const field = (label: string, value: string, onChangeText: (text: string) => void, keyboardType: 'default' | 'decimal-pad' | 'number-pad', placeholder: string) =>
    <View style={{ gap: 6 }}><Text style={{ color: colors.text, fontWeight: '700' }}>{label}</Text><TextInput value={value} onChangeText={onChangeText} keyboardType={keyboardType} placeholder={placeholder} placeholderTextColor={colors.textMuted}
      style={{ minHeight: 52, borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, color: colors.text, paddingHorizontal: 14, fontSize: 16 }} /></View>;
  return <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
    <Stack.Screen options={{ title: id ? 'Edit SIP plan' : 'Add SIP plan' }} />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 20 }}>
      <Text style={{ color: colors.textSecondary, lineHeight: 21 }}>Set the planned monthly contribution. You can record a different actual amount for any installment.</Text>
      {field('Fund or investment name', name, setName, 'default', 'e.g. Nifty 50 Index Fund')}
      {field('Monthly amount (₹)', amount, setAmount, 'decimal-pad', 'e.g. 5000')}
      {field('Day of each month', day, setDay, 'number-pad', '1–31')}
      <Text style={{ color: colors.textSecondary, lineHeight: 19 }}>For a date like the 31st, shorter months use their last day. Changing the day schedules the next upcoming installment; past contributions keep their original amounts.</Text>
      <TouchableOpacity accessibilityRole="button" disabled={saving} onPress={() => { void save(); }} style={{ minHeight: 52, backgroundColor: colors.primary, borderRadius: 14, alignItems: 'center', justifyContent: 'center', opacity: saving ? 0.6 : 1 }}>
        <Text style={{ color: colors.textInverse, fontWeight: '800', fontSize: 16 }}>{saving ? 'Saving…' : id ? 'Save changes' : 'Create SIP plan'}</Text>
      </TouchableOpacity>
    </ScrollView>
  </SafeAreaView>;
}
