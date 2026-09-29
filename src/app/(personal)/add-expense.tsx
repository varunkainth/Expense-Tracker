import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { personalExpenseRepository } from '../../repositories/personal/expense.repository';
import { categoryRepository } from '../../repositories/personal/category.repository';
import { Category, PaymentMethod } from '../../types/personal';
import { PAYMENT_METHODS } from '../../constants/payment-methods';
import { DEFAULT_CATEGORY_METAS } from '../../constants/categories';
import { rupeesToPaise } from '../../utils/currency';
import { formatDate } from '../../utils/date';
import { validateAmount } from '../../utils/validation';

/**
 * Converts a paise value to a plain numeric string for the amount input.
 * 25000  -> "250"
 * 25050  -> "250.50"
 */
function paiseToRupeesString(paise: number): string {
  if (!Number.isFinite(paise) || paise < 0) return '';
  return paise % 100 === 0 ? String(paise / 100) : (paise / 100).toFixed(2);
}

export default function AddExpenseScreen() {
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const router = useRouter();

  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEditMode = Boolean(id);

  const [amountStr, setAmountStr] = useState('');
  const [description, setDescription] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<PaymentMethod>('UPI');
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [expenseDate, setExpenseDate] = useState<number>(Date.now());
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEditMode);

  /**
   * Loads categories, and (in edit mode) the existing expense.
   */
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const list = await categoryRepository.getAll();
        if (cancelled) return;
        setCategories(list);

        if (isEditMode && id) {
          const existing = await personalExpenseRepository.getById(id);
          if (cancelled) return;

          if (!existing) {
            Alert.alert('Not Found', 'This expense no longer exists.', [
              { text: 'OK', onPress: () => router.back() },
            ]);
            return;
          }

          setAmountStr(paiseToRupeesString(existing.amount));
          setDescription(existing.description ?? '');
          setSelectedPaymentMethod(
            existing.payment_method as PaymentMethod,
          );
          setSelectedCategoryId(existing.category_id);
          setExpenseDate(new Date(existing.expense_date).getTime());
        } else if (list.length > 0) {
          setSelectedCategoryId(list[0].id);
        }
      } catch (err) {
        console.error('Error loading data:', err);
        if (!cancelled && isEditMode) {
          Alert.alert('Error', 'Could not load expense.');
        }
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [id, isEditMode, router]);

  const handleSave = async () => {
    if (!amountStr || parseFloat(amountStr) <= 0) {
      Alert.alert('Invalid Amount', 'Please enter an amount greater than ₹0.');
      return;
    }

    if (!selectedCategoryId) {
      Alert.alert('Missing Category', 'Please select a category.');
      return;
    }

    try {
      setLoading(true);
      const amountInPaise = rupeesToPaise(amountStr);
      const validation = validateAmount(amountInPaise);

      if (!validation.isValid) {
        Alert.alert('Invalid Amount', validation.error);
        setLoading(false);
        return;
      }

      const payload = {
        amount: amountInPaise,
        category_id: selectedCategoryId,
        description: description.trim() || null,
        payment_method: selectedPaymentMethod,
        expense_date: expenseDate,
      };

      if (isEditMode && id) {
        await personalExpenseRepository.update(id, payload);
      } else {
        await personalExpenseRepository.createExpense(payload);
      }

      router.back();
    } catch (err) {
      console.error(
        isEditMode ? 'Failed to update expense:' : 'Failed to create expense:',
        err,
      );
      Alert.alert(
        'Error',
        isEditMode
          ? 'Failed to update expense. Please try again.'
          : 'Failed to save expense. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  const adjustDateDays = (days: number) => {
    const d = new Date(expenseDate);
    d.setDate(d.getDate() + days);
    setExpenseDate(d.getTime());
  };

  if (initialLoading) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.background,
            justifyContent: 'center',
            alignItems: 'center',
          },
        ]}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { padding: spacing.base },
          ]}
        >
          {/* Amount Input */}
          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              Amount
            </Text>
            <View
              style={[
                styles.amountContainer,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderRadius: borderRadius.lg,
                  ...shadows.sm,
                },
              ]}
            >
              <Text style={[styles.rupeeSymbol, { color: colors.primary }]}>
                ₹
              </Text>
              <TextInput
                style={[styles.amountInput, { color: colors.text }]}
                placeholder="0.00"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
                value={amountStr}
                onChangeText={setAmountStr}
                autoFocus={!isEditMode}
              />
            </View>
          </View>

          {/* Category Selector */}
          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              Category
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryScroll}
            >
              {categories.map((cat) => {
                const isSelected = selectedCategoryId === cat.id;
                const meta =
                  DEFAULT_CATEGORY_METAS[cat.name] ||
                  DEFAULT_CATEGORY_METAS.Other;

                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.categoryChip,
                      {
                        backgroundColor: isSelected
                          ? colors.primaryLight
                          : colors.card,
                        borderColor: isSelected
                          ? colors.primary
                          : colors.border,
                        borderRadius: borderRadius.full,
                      },
                    ]}
                    onPress={() => setSelectedCategoryId(cat.id)}
                    activeOpacity={0.8}
                  >
                    <MaterialIcons
                      name={meta.icon as any}
                      size={18}
                      color={isSelected ? colors.primary : meta.color}
                    />
                    <Text
                      style={[
                        styles.categoryChipText,
                        {
                          color: isSelected ? colors.primary : colors.text,
                        },
                      ]}
                    >
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Payment Method */}
          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              Payment Method
            </Text>
            <View style={styles.paymentMethodRow}>
              {PAYMENT_METHODS.map((method) => {
                const isSelected = selectedPaymentMethod === method.key;
                return (
                  <TouchableOpacity
                    key={method.key}
                    style={[
                      styles.paymentMethodBtn,
                      {
                        backgroundColor: isSelected
                          ? colors.primary
                          : colors.card,
                        borderColor: isSelected
                          ? colors.primary
                          : colors.border,
                        borderRadius: borderRadius.md,
                      },
                    ]}
                    onPress={() => setSelectedPaymentMethod(method.key)}
                    activeOpacity={0.8}
                  >
                    <MaterialIcons
                      name={method.icon as any}
                      size={18}
                      color={isSelected ? '#ffffff' : colors.text}
                    />
                    <Text
                      style={[
                        styles.paymentMethodText,
                        {
                          color: isSelected ? '#ffffff' : colors.text,
                        },
                      ]}
                    >
                      {method.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Date Selector */}
          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              Expense Date
            </Text>
            <View
              style={[
                styles.dateCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderRadius: borderRadius.md,
                  ...shadows.sm,
                },
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.dateNavBtn,
                  { backgroundColor: colors.surfaceVariant },
                ]}
                onPress={() => adjustDateDays(-1)}
              >
                <MaterialIcons
                  name="chevron-left"
                  size={24}
                  color={colors.text}
                />
              </TouchableOpacity>

              <View style={styles.dateCenter}>
                <MaterialIcons
                  name="calendar-today"
                  size={18}
                  color={colors.primary}
                />
                <Text style={[styles.dateText, { color: colors.text }]}>
                  {formatDate(expenseDate)}
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.dateNavBtn,
                  { backgroundColor: colors.surfaceVariant },
                ]}
                onPress={() => adjustDateDays(1)}
              >
                <MaterialIcons
                  name="chevron-right"
                  size={24}
                  color={colors.text}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Description (Optional) */}
          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              Description (Optional)
            </Text>
            <TextInput
              style={[
                styles.descriptionInput,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderRadius: borderRadius.md,
                  color: colors.text,
                },
              ]}
              placeholder="e.g. Dinner with team, Netflix renewal..."
              placeholderTextColor={colors.textMuted}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
            />
          </View>
        </ScrollView>

        {/* Bottom Action */}
        <View
          style={[
            styles.bottomBar,
            {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
            },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.saveBtn,
              {
                backgroundColor: colors.primary,
                borderRadius: borderRadius.md,
                opacity: loading ? 0.7 : 1,
              },
            ]}
            onPress={handleSave}
            disabled={loading}
            activeOpacity={0.8}
          >
            <MaterialIcons
              name={isEditMode ? 'save' : 'check'}
              size={22}
              color="#ffffff"
            />
            <Text style={styles.saveBtnText}>
              {loading
                ? isEditMode
                  ? 'Updating...'
                  : 'Saving...'
                : isEditMode
                ? 'Save Changes'
                : 'Save Expense'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
  },
  rupeeSymbol: {
    fontSize: 28,
    fontWeight: '700',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 28,
    fontWeight: '700',
    padding: 0,
  },
  categoryScroll: {
    gap: 8,
    paddingVertical: 4,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    gap: 6,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  paymentMethodRow: {
    flexDirection: 'row',
    gap: 8,
  },
  paymentMethodBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderWidth: 1,
    gap: 6,
  },
  paymentMethodText: {
    fontSize: 13,
    fontWeight: '600',
  },
  dateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 8,
    borderWidth: 1,
  },
  dateNavBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateText: {
    fontSize: 15,
    fontWeight: '600',
  },
  descriptionInput: {
    padding: 14,
    borderWidth: 1,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  bottomBar: {
    padding: 16,
    borderTopWidth: 1,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});