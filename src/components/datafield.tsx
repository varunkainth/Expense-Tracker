import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { formatDate } from '../utils/date';

export function normalizeToMidnight(input: number | Date): number {
  const d = input instanceof Date ? new Date(input) : new Date(input);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function todayMidnight(): number {
  return normalizeToMidnight(Date.now());
}

export function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

interface DateFieldProps {
  label: string;
  value: number;
  onChange: (timestamp: number) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  icon?: keyof typeof MaterialIcons.glyphMap;
  mode?: 'date' | 'time';
  placeholder?: string;
}

export function DateField({
  label,
  value,
  onChange,
  minimumDate,
  maximumDate,
  icon,
  mode = 'date',
  placeholder = 'Select',
}: DateFieldProps) {
  const { colors } = useTheme();
  const [showPicker, setShowPicker] = useState(false);

  const displayIcon =
    icon ?? (mode === 'time' ? 'schedule' : 'calendar-today');

  const hasValue = mode === 'time' ? value > 0 : true;

  const displayText = !hasValue
    ? placeholder
    : mode === 'time'
    ? formatTime(value)
    : formatDate(value);

  // On Android, close immediately after a value is chosen and ignore
  // the subsequent onDismiss. On iOS, the picker stays visible inline
  // and is closed when the user picks a value.
  const handleValueChange = (_: unknown, selected?: Date) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
    } else {
      setShowPicker(false);
    }

    if (!selected) return;

    onChange(
      mode === 'time'
        ? selected.getTime()
        : normalizeToMidnight(selected)
    );
  };

  const handleDismiss = () => {
    // Android fires onDismiss after onValueChange. Since we already
    // closed the picker, this is a no-op. Guard anyway to avoid
    // double state updates that could re-show the picker.
    setShowPicker((prev) => (prev ? false : prev));
  };

  return (
    <View style={styles.fieldGroup}>
      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
        {label}
      </Text>
      <TouchableOpacity
        style={[
          styles.textInput,
          styles.dateInput,
          { backgroundColor: colors.surfaceVariant },
        ]}
        onPress={() => setShowPicker(true)}
        activeOpacity={0.7}
      >
        <MaterialIcons name={displayIcon} size={16} color={colors.primary} />
        <Text
          style={[
            styles.dateText,
            { color: hasValue ? colors.text : colors.textMuted },
          ]}
        >
          {displayText}
        </Text>
      </TouchableOpacity>

      {showPicker && (
        <DateTimePicker
          value={value > 0 ? new Date(value) : new Date()}
          mode={mode}
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onValueChange={handleValueChange}
          onDismiss={handleDismiss}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fieldGroup: { gap: 4 },
  fieldLabel: { fontSize: 12, fontWeight: '600' },
  textInput: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    fontSize: 14,
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: { fontSize: 14 },
});