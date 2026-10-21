import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import InvestmentDateField from '../../../components/InvestmentDateField';
import { useTheme } from '../../../hooks/useTheme';
import { createOneTimeInvestment } from '../../../repositories/investment.repository';
import { rupeesToPaise } from '../../../utils/currency';

export default function OneTimeInvestmentScreen() {
  const { colors } = useTheme();
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => Date.now());
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const id = await createOneTimeInvestment(name, rupeesToPaise(amount), date);
      router.replace({ pathname: '/settings/investments/[id]', params: { id } });
    } catch (cause) {
      Alert.alert('Could not save investment', cause instanceof Error ? cause.message : 'Please try again.');
    } finally { setSaving(false); }
  };
  return <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
    <Stack.Screen options={{ title: 'One-time investment' }} />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 20 }}>
      <Text style={{ color: colors.textSecondary, lineHeight: 21 }}>Record an investment you made once. It will count toward outflow in the month you paid, with no monthly reminders.</Text>
      <View style={{ gap: 6 }}><Text style={{ color: colors.text, fontWeight: '700' }}>Investment name</Text>
        <TextInput value={name} onChangeText={setName} placeholder="e.g. Index fund" placeholderTextColor={colors.textMuted}
          style={{ minHeight: 52, borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, color: colors.text, paddingHorizontal: 14, fontSize: 16 }} /></View>
      <View style={{ gap: 6 }}><Text style={{ color: colors.text, fontWeight: '700' }}>Amount invested (₹)</Text>
        <TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="e.g. 5000" placeholderTextColor={colors.textMuted}
          style={{ minHeight: 52, borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, color: colors.text, paddingHorizontal: 14, fontSize: 16 }} /></View>
      <InvestmentDateField value={date} onChange={setDate} />
      <TouchableOpacity accessibilityRole="button" disabled={saving} onPress={() => { void save(); }}
        style={{ minHeight: 52, borderRadius: 14, backgroundColor: colors.primary, opacity: saving ? 0.6 : 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.textInverse, fontWeight: '800', fontSize: 16 }}>{saving ? 'Saving…' : 'Record investment'}</Text>
      </TouchableOpacity>
    </ScrollView>
  </SafeAreaView>;
}
