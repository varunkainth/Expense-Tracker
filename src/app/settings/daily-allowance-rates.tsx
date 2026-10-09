import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';
import { DailyAllowanceRatesService } from '../../services/daily-allowance-rates.service';
import {
  DAILY_ALLOWANCE_RATES,
  DailyAllowanceRates,
} from '../../types/company';
import {
  formatPaiseToRupees,
  paiseToRupees,
  rupeesToPaise,
} from '../../utils/currency';

export default function DailyAllowanceRatesScreen() {
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const router = useRouter();

  const [travelInput, setTravelInput] = useState('');
  const [foodInput, setFoodInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadRates() {
      try {
        const rates = await DailyAllowanceRatesService.getRates();
        setTravelInput(String(paiseToRupees(rates.TRAVEL_ALLOWANCE_PAISE)));
        setFoodInput(String(paiseToRupees(rates.FOOD_ALLOWANCE_PAISE)));
      } catch (err) {
        console.error('Failed to load rates:', err);
      } finally {
        setLoading(false);
      }
    }

    loadRates();
  }, []);

  const parsedTravel = parseFloat(travelInput) || 0;
  const parsedFood = parseFloat(foodInput) || 0;
  const travelPaise = rupeesToPaise(parsedTravel);
  const foodPaise = rupeesToPaise(parsedFood);
  const totalDailyPaise = travelPaise + foodPaise;

  const handleSave = async () => {
    if (parsedTravel <= 0) {
      Alert.alert('Validation Error', 'Travel Allowance must be greater than ₹0.');
      return;
    }
    if (parsedFood <= 0) {
      Alert.alert('Validation Error', 'Food Allowance must be greater than ₹0.');
      return;
    }

    try {
      setSaving(true);
      await DailyAllowanceRatesService.setRates(travelPaise, foodPaise);
      Alert.alert(
        'Rates Saved',
        `Daily Allowance rates updated to:\n• Travel: ₹${parsedTravel}/day\n• Food: ₹${parsedFood}/day\n• Total: ₹${parsedTravel + parsedFood}/day`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (err) {
      Alert.alert(
        'Error Saving Rates',
        err instanceof Error ? err.message : 'Could not save rates.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    Alert.alert(
      'Reset Rates',
      `Reset daily allowance rates to default values (Travel: ₹${paiseToRupees(
        DAILY_ALLOWANCE_RATES.TRAVEL_ALLOWANCE_PAISE
      )}, Food: ₹${paiseToRupees(DAILY_ALLOWANCE_RATES.FOOD_ALLOWANCE_PAISE)})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset to Defaults',
          style: 'destructive',
          onPress: async () => {
            try {
              setSaving(true);
              const defaults = await DailyAllowanceRatesService.resetToDefaults();
              setTravelInput(String(paiseToRupees(defaults.TRAVEL_ALLOWANCE_PAISE)));
              setFoodInput(String(paiseToRupees(defaults.FOOD_ALLOWANCE_PAISE)));
              Alert.alert('Reset Complete', 'Daily Allowance rates restored to defaults.');
            } catch (err) {
              Alert.alert('Error', 'Failed to reset rates.');
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView
      edges={['bottom', 'left', 'right']}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { padding: spacing.base }]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header Info */}
          <View style={styles.headerInfo}>
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: colors.primaryLight },
              ]}
            >
              <MaterialIcons name="monetization-on" size={32} color={colors.primary} />
            </View>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              Daily Allowance Rates
            </Text>
            <Text style={[styles.headerDesc, { color: colors.textSecondary }]}>
              Configure your standard daily allowance rates for outstation tours. New claims
              and Excel exports will use these rates.
            </Text>
          </View>

          {/* Rate Inputs Card */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: borderRadius.lg,
                ...shadows.sm,
              },
            ]}
          >
            <Text style={[styles.cardHeaderTitle, { color: colors.text }]}>
              Standard Rates (Per Day)
            </Text>

            {/* Travel Allowance */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.text }]}>
                Travel Allowance Rate (₹ / Day)
              </Text>
              <View
                style={[
                  styles.inputContainer,
                  {
                    backgroundColor: colors.surfaceVariant,
                    borderColor: colors.border,
                    borderRadius: borderRadius.md,
                  },
                ]}
              >
                <Text style={[styles.currencyPrefix, { color: colors.textSecondary }]}>
                  ₹
                </Text>
                <TextInput
                  value={travelInput}
                  onChangeText={setTravelInput}
                  placeholder="400"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  style={[styles.input, { color: colors.text }]}
                  editable={!loading && !saving}
                />
              </View>
              <Text style={[styles.fieldHint, { color: colors.textMuted }]}>
                Default: ₹{paiseToRupees(DAILY_ALLOWANCE_RATES.TRAVEL_ALLOWANCE_PAISE)}/day
              </Text>
            </View>

            {/* Food Allowance */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.text }]}>
                Food Allowance Rate (₹ / Day)
              </Text>
              <View
                style={[
                  styles.inputContainer,
                  {
                    backgroundColor: colors.surfaceVariant,
                    borderColor: colors.border,
                    borderRadius: borderRadius.md,
                  },
                ]}
              >
                <Text style={[styles.currencyPrefix, { color: colors.textSecondary }]}>
                  ₹
                </Text>
                <TextInput
                  value={foodInput}
                  onChangeText={setFoodInput}
                  placeholder="600"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  style={[styles.input, { color: colors.text }]}
                  editable={!loading && !saving}
                />
              </View>
              <Text style={[styles.fieldHint, { color: colors.textMuted }]}>
                Default: ₹{paiseToRupees(DAILY_ALLOWANCE_RATES.FOOD_ALLOWANCE_PAISE)}/day
              </Text>
            </View>
          </View>

          {/* Live Preview Card */}
          <View
            style={[
              styles.previewCard,
              {
                backgroundColor: `${colors.primary}10`,
                borderColor: colors.primary,
                borderRadius: borderRadius.lg,
              },
            ]}
          >
            <View style={styles.previewHeaderRow}>
              <MaterialIcons name="calculate" size={20} color={colors.primary} />
              <Text style={[styles.previewTitle, { color: colors.primary }]}>
                Calculated Preview
              </Text>
            </View>

            <View style={styles.previewBreakdown}>
              <View style={styles.previewRow}>
                <Text style={[styles.previewLabel, { color: colors.textSecondary }]}>
                  1 Day Total:
                </Text>
                <Text style={[styles.previewValue, { color: colors.text }]}>
                  {formatPaiseToRupees(totalDailyPaise)}
                </Text>
              </View>

              <View style={styles.previewRow}>
                <Text style={[styles.previewLabel, { color: colors.textSecondary }]}>
                  3 Days Tour:
                </Text>
                <Text style={[styles.previewValue, { color: colors.text }]}>
                  {formatPaiseToRupees(totalDailyPaise * 3)}
                </Text>
              </View>

              <View style={styles.previewRow}>
                <Text style={[styles.previewLabel, { color: colors.textSecondary }]}>
                  7 Days Tour:
                </Text>
                <Text
                  style={[
                    styles.previewValue,
                    { color: colors.primary, fontWeight: '700' },
                  ]}
                >
                  {formatPaiseToRupees(totalDailyPaise * 7)}
                </Text>
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[
                styles.saveButton,
                {
                  backgroundColor: colors.primary,
                  borderRadius: borderRadius.md,
                  opacity: saving ? 0.7 : 1,
                },
              ]}
              onPress={handleSave}
              disabled={saving || loading}
              activeOpacity={0.8}
            >
              <MaterialIcons name="check" size={22} color="#ffffff" />
              <Text style={styles.saveButtonText}>
                {saving ? 'Saving Rates...' : 'Save Allowance Rates'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.resetButton,
                {
                  borderColor: colors.border,
                  borderRadius: borderRadius.md,
                },
              ]}
              onPress={handleReset}
              disabled={saving || loading}
              activeOpacity={0.7}
            >
              <MaterialIcons name="restore" size={20} color={colors.textSecondary} />
              <Text style={[styles.resetButtonText, { color: colors.textSecondary }]}>
                Reset to Defaults (₹400 / ₹600)
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  headerInfo: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 8,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 6,
  },
  headerDesc: {
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 16,
    lineHeight: 18,
  },
  card: {
    padding: 16,
    borderWidth: 1,
    marginBottom: 18,
  },
  cardHeaderTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 16,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 48,
  },
  currencyPrefix: {
    fontSize: 16,
    fontWeight: '700',
    marginRight: 6,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    height: '100%',
  },
  fieldHint: {
    fontSize: 11,
    marginTop: 4,
    marginLeft: 2,
  },
  previewCard: {
    padding: 16,
    borderWidth: 1,
    marginBottom: 24,
  },
  previewHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  previewBreakdown: {
    gap: 8,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewLabel: {
    fontSize: 13,
  },
  previewValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  actions: {
    gap: 12,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 46,
    borderWidth: 1,
  },
  resetButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
