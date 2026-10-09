import { MaterialIcons } from '@expo/vector-icons';
import { useMemo } from 'react';
import {
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../hooks/useTheme';
import {
  MonthPeriod,
  buildMonthOptions,
  formatPeriodLabel,
} from '../types/period';

interface Props {
  visible: boolean;
  /** Currently selected period (for highlighting). */
  selected: MonthPeriod;
  /** Show an "All time" entry at the top. */
  includeAllTime?: boolean;
  /** Number of months to show, including the current month. */
  monthsBack?: number;
  onSelect: (period: MonthPeriod) => void;
  onClose: () => void;
}

export default function MonthPickerModal({
  visible,
  selected,
  includeAllTime = true,
  monthsBack = 18,
  onSelect,
  onClose,
}: Props) {
  const { colors, borderRadius, shadows } = useTheme();

  const options = useMemo<MonthPeriod[]>(() => {
    const months = buildMonthOptions(monthsBack);
    return includeAllTime ? [{ kind: 'all' }, ...months] : months;
  }, [includeAllTime, monthsBack]);

  const isSelected = (p: MonthPeriod) => {
    if (p.kind === 'all' && selected.kind === 'all') return true;
    if (p.kind === 'month' && selected.kind === 'month') {
      return p.year === selected.year && p.monthIndex === selected.monthIndex;
    }
    return false;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
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
          // prevent press-through
          onStartShouldSetResponder={() => true}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>
              Select month
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <MaterialIcons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <FlatList
            data={options}
            keyExtractor={(item) =>
              item.kind === 'all'
                ? 'all'
                : `${item.year}-${item.monthIndex}`
            }
            style={{ maxHeight: 420 }}
            renderItem={({ item }) => {
              const active = isSelected(item);
              return (
                <TouchableOpacity
                  onPress={() => {
                    onSelect(item);
                    onClose();
                  }}
                  style={[
                    styles.row,
                    {
                      borderBottomColor: colors.border,
                      backgroundColor: active ? `${colors.primary}15` : 'transparent',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.rowText,
                      {
                        color: active ? colors.primary : colors.text,
                        fontWeight: active ? '700' : '500',
                      },
                    ]}
                  >
                    {formatPeriodLabel(item)}
                  </Text>
                  {active && (
                    <MaterialIcons name="check" size={18} color={colors.primary} />
                  )}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  sheet: { paddingVertical: 8 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: { fontSize: 16, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowText: { fontSize: 14 },
});
