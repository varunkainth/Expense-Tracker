import { MaterialIcons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { MonthPeriod } from '../types/period';
import DayChipGrid from './DayChipGrid';

export type SaturdayOffRule = 'none' | '1st-3rd' | '2nd-4th';

export interface AttendanceExtras {
  googleReviews: string;
  serviceCallsTat: string;
  saturdayOff: SaturdayOffRule;
  holidayDays: number[];
  absentDays: number[];
}

interface Props {
  visible: boolean;
  period: MonthPeriod;
  onCancel: () => void;
  onConfirm: (extras: AttendanceExtras) => void;
}

function daysInMonth(period: MonthPeriod): number {
  const now = new Date();
  const year = period.kind === 'month' ? period.year : now.getFullYear();
  const monthIndex = period.kind === 'month' ? period.monthIndex : now.getMonth();
  return new Date(year, monthIndex + 1, 0).getDate();
}

function sundaysOf(period: MonthPeriod): number[] {
  const now = new Date();
  const year = period.kind === 'month' ? period.year : now.getFullYear();
  const monthIndex = period.kind === 'month' ? period.monthIndex : now.getMonth();
  const total = daysInMonth(period);
  const out: number[] = [];
  for (let d = 1; d <= total; d++) {
    if (new Date(year, monthIndex, d).getDay() === 0) out.push(d);
  }
  return out;
}

export default function AttendanceExtrasDialog({
  visible,
  period,
  onCancel,
  onConfirm,
}: Props) {
  const { colors, spacing, borderRadius, shadows } = useTheme();

  const [googleReviews, setGoogleReviews] = useState('');
  const [serviceCallsTat, setServiceCallsTat] = useState('');
  const [saturdayOff, setSaturdayOff] = useState<SaturdayOffRule>('none');
  const [holidayDays, setHolidayDays] = useState<number[]>([]);
  const [absentDays, setAbsentDays] = useState<number[]>([]);

  const totalDays = useMemo(() => daysInMonth(period), [period]);
  const sundays = useMemo(() => sundaysOf(period), [period]);

  // Reset on open
  useEffect(() => {
    if (visible) {
      setGoogleReviews('');
      setServiceCallsTat('');
      setSaturdayOff('none');
      setHolidayDays([]);
      setAbsentDays([]);
    }
  }, [visible]);

  const toggleIn = (arr: number[], set: (v: number[]) => void, day: number) => {
    set(arr.includes(day) ? arr.filter((d) => d !== day) : [...arr, day].sort((a, b) => a - b));
  };

  const satOptions: { value: SaturdayOffRule; label: string }[] = [
    { value: 'none', label: 'None' },
    { value: '1st-3rd', label: '1st & 3rd Sat' },
    { value: '2nd-4th', label: '2nd & 4th Sat' },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              borderRadius: borderRadius.lg,
              ...shadows.md,
            },
          ]}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>
              Attendance details
            </Text>
            <TouchableOpacity onPress={onCancel} hitSlop={12}>
              <MaterialIcons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: spacing.base, gap: 16 }}>
            {/* Google Reviews */}
            <View>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                Google Reviews
              </Text>
              <TextInput
                value={googleReviews}
                onChangeText={setGoogleReviews}
                placeholder="e.g. 12"
                placeholderTextColor={colors.textSecondary}
                keyboardType="number-pad"
                style={[
                  styles.input,
                  {
                    color: colors.text,
                    borderColor: colors.border,
                    borderRadius: borderRadius.md,
                  },
                ]}
              />
            </View>

            {/* Service Calls / TAT */}
            <View>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                Number of Service Call / TAT
              </Text>
              <TextInput
                value={serviceCallsTat}
                onChangeText={setServiceCallsTat}
                placeholder="e.g. 8 / 2h"
                placeholderTextColor={colors.textSecondary}
                style={[
                  styles.input,
                  {
                    color: colors.text,
                    borderColor: colors.border,
                    borderRadius: borderRadius.md,
                  },
                ]}
              />
            </View>

            {/* Saturday off rule */}
            <View>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                Saturdays off
              </Text>
              <View style={styles.chipRow}>
                {satOptions.map((opt) => {
                  const active = saturdayOff === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      onPress={() => setSaturdayOff(opt.value)}
                      style={[
                        styles.optionChip,
                        {
                          borderRadius: borderRadius.md,
                          borderColor: active ? colors.primary : colors.border,
                          backgroundColor: active ? `${colors.primary}20` : colors.card,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color: active ? colors.primary : colors.text,
                          fontWeight: active ? '700' : '500',
                          fontSize: 12,
                        }}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Holidays */}
            <View>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                Holidays (H) — {holidayDays.length} selected
              </Text>
              <DayChipGrid
                totalDays={totalDays}
                disabledDays={sundays}
                selected={holidayDays}
                onToggle={(d) => toggleIn(holidayDays, setHolidayDays, d)}
                accent="#1d4ed8"
              />
            </View>

            {/* Absents */}
            <View>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                Absent days (A) — {absentDays.length} selected
              </Text>
              <DayChipGrid
                totalDays={totalDays}
                disabledDays={sundays}
                selected={absentDays}
                onToggle={(d) => toggleIn(absentDays, setAbsentDays, d)}
                accent="#b91c1c"
              />
            </View>
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              onPress={onCancel}
              style={[styles.btn, { borderColor: colors.border, borderRadius: borderRadius.md }]}
            >
              <Text style={{ color: colors.text, fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() =>
                onConfirm({
                  googleReviews,
                  serviceCallsTat,
                  saturdayOff,
                  holidayDays,
                  absentDays,
                })
              }
              style={[
                styles.btn,
                {
                  backgroundColor: colors.primary,
                  borderColor: colors.primary,
                  borderRadius: borderRadius.md,
                },
              ]}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>Generate</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  sheet: {
    maxHeight: '90%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: { fontSize: 16, fontWeight: '700' },
  label: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  input: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  btn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderWidth: 1,
    minWidth: 100,
    alignItems: 'center',
  },
});