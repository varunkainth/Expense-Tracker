import React, { useMemo, useState } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { MonthPeriod, formatPeriodLabel } from '../types/period';
import MonthPickerModal from './monthpicker';

export default function CompanyExpenseMonthFilter({
  period,
  onSelect,
  count,
  oldestDate,
}: {
  period: MonthPeriod;
  onSelect: (period: MonthPeriod) => void;
  count: number;
  oldestDate?: number;
}) {
  const { colors, borderRadius } = useTheme();
  const [pickerVisible, setPickerVisible] = useState(false);
  const monthsBack = useMemo(() => {
    if (oldestDate === undefined) return 18;
    const oldest = new Date(oldestDate);
    const now = new Date();
    return Math.max(18, (now.getFullYear() - oldest.getFullYear()) * 12 + now.getMonth() - oldest.getMonth() + 1);
  }, [oldestDate]);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={() => setPickerVisible(true)}
        style={[styles.button, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: borderRadius.md }]}
        accessibilityRole="button"
        accessibilityLabel={`Filter expenses by month. Currently ${formatPeriodLabel(period)}`}
      >
        <MaterialIcons name="calendar-month" size={19} color={colors.primary} />
        <Text style={[styles.label, { color: colors.text }]}>{formatPeriodLabel(period)}</Text>
        <MaterialIcons name="expand-more" size={20} color={colors.textSecondary} />
      </TouchableOpacity>
      <Text style={[styles.count, { color: colors.textSecondary }]}>
        {count} {count === 1 ? 'entry' : 'entries'}
      </Text>
      <MonthPickerModal
        visible={pickerVisible}
        selected={period}
        includeAllTime
        monthsBack={monthsBack}
        onSelect={onSelect}
        onClose={() => setPickerVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  button: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderWidth: 1 },
  label: { fontSize: 13, fontWeight: '700' },
  count: { fontSize: 12, fontWeight: '600' },
});
