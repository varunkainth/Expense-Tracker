import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../hooks/useTheme';

interface Props {
  /** 1-based day numbers to render (e.g. 1..31). */
  totalDays: number;
  /** Days that are auto-excluded (Sundays) — shown disabled. */
  disabledDays?: number[];
  /** Currently selected days. */
  selected: number[];
  onToggle: (day: number) => void;
  /** Optional accent color override. */
  accent?: string;
}

export default function DayChipGrid({
  totalDays,
  disabledDays = [],
  selected,
  onToggle,
  accent,
}: Props) {
  const { colors, borderRadius } = useTheme();
  const accentColor = accent ?? colors.primary;

  const disabledSet = useMemo(() => new Set(disabledDays), [disabledDays]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  return (
    <View style={styles.grid}>
      {Array.from({ length: totalDays }, (_, i) => i + 1).map((day) => {
        const isDisabled = disabledSet.has(day);
        const isSelected = selectedSet.has(day);
        return (
          <TouchableOpacity
            key={day}
            onPress={() => !isDisabled && onToggle(day)}
            activeOpacity={0.7}
            disabled={isDisabled}
            style={[
              styles.chip,
              {
                borderRadius: borderRadius.md,
                borderColor: isSelected ? accentColor : colors.border,
                backgroundColor: isDisabled
                  ? colors.border
                  : isSelected
                  ? `${accentColor}20`
                  : colors.card,
              },
            ]}
          >
            <Text
              style={[
                styles.chipText,
                {
                  color: isDisabled
                    ? colors.textSecondary
                    : isSelected
                    ? accentColor
                    : colors.text,
                  fontWeight: isSelected ? '700' : '500',
                },
              ]}
            >
              {day}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  chipText: { fontSize: 13 },
});