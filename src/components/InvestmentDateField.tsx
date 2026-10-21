import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { formatDate } from '../utils/date';

function dayStart(value: Date): number {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
}

function parseLocalDate(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date.getTime() : null;
}

function isoLocalDate(value: number): string {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function InvestmentDateField({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [webDraft, setWebDraft] = useState<string | null>(null);
  if (Platform.OS === 'web') {
    return <View style={{ gap: 6 }}>
      <Text style={{ color: colors.text, fontWeight: '700' }}>Payment date</Text>
      <TextInput value={webDraft ?? isoLocalDate(value)} onChangeText={setWebDraft}
        onBlur={() => { const parsed = parseLocalDate(webDraft ?? isoLocalDate(value)); if (parsed !== null && parsed <= Date.now()) onChange(parsed); setWebDraft(null); }}
        placeholder="YYYY-MM-DD" accessibilityLabel="Payment date in year-month-day format"
        style={{ minHeight: 50, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, color: colors.text, paddingHorizontal: 14 }} />
      <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Use YYYY-MM-DD. Today or an earlier date.</Text>
    </View>;
  }
  const show = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({ value: new Date(value), mode: 'date', maximumDate: new Date(),
        onValueChange: (_event, selected) => { if (selected) onChange(dayStart(selected)); } });
    } else setOpen(!open);
  };
  return <View style={{ gap: 6 }}>
    <Text style={{ color: colors.text, fontWeight: '700' }}>Payment date</Text>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Payment date ${formatDate(value)}`} onPress={show}
      style={{ minHeight: 50, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, justifyContent: 'center', paddingHorizontal: 14 }}>
      <Text style={{ color: colors.text, fontSize: 16 }}>{formatDate(value)}</Text>
    </TouchableOpacity>
    {Platform.OS === 'ios' && open && <DateTimePicker value={new Date(value)} mode="date" maximumDate={new Date()} display="spinner"
      onValueChange={(_event, selected) => { if (selected) onChange(dayStart(selected)); }} />}
  </View>;
}
