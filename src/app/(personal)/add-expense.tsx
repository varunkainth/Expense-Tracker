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
import DateTimePicker from '@react-native-community/datetimepicker';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { personalExpenseRepository } from '../../repositories/personal/expense.repository';
import { categoryRepository } from '../../repositories/personal/category.repository';
import { Category, PaymentMethod, Subcategory } from '../../types/personal';
import { PAYMENT_METHODS } from '../../constants/payment-methods';
import { DEFAULT_CATEGORY_METAS } from '../../constants/categories';
import { rupeesToPaise } from '../../utils/currency';
import { formatDate, isFutureDate } from '../../utils/date';
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

function getSubcategoryIcon(name: string): string {
  const value = name.toLowerCase();
  if (value.includes('bus')) return 'directions-bus';
  if (value.includes('train')) return 'train';
  if (value.includes('flight') || value.includes('air')) return 'flight';
  if (value.includes('cab') || value.includes('uber') || value.includes('ola')) return 'local-taxi';
  if (value.includes('rapido') || value.includes('bike')) return 'two-wheeler';
  if (value.includes('netflix') || value.includes('prime') || value.includes('subscription') || value.includes('spotify')) return 'subscriptions';
  if (value.includes('recharge') || value.includes('mobile')) return 'phone-android';
  if (value.includes('electric')) return 'bolt';
  if (value.includes('water')) return 'water-drop';
  if (value.includes('card') || value.includes('bill')) return 'receipt-long';
  if (value.includes('internet')) return 'wifi';
  if (value.includes('gas')) return 'local-gas-station';
  return 'sell';
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
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [subcategoriesForCategoryId, setSubcategoriesForCategoryId] = useState<string | null>(null);
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string | null>(null);
  const [expenseDate, setExpenseDate] = useState<number>(() => Date.now());
  const [showExpenseDatePicker, setShowExpenseDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEditMode);

  /**
   * Loads categories, and (in edit mode) the existing expense.
   */
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const list = await categoryRepository.getAllByUsage();
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
          setSelectedSubcategoryId(existing.subcategory_id ?? null);
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

  useEffect(() => {
    let cancelled = false;
    if (!selectedCategoryId) return;
    categoryRepository.getSubcategories(selectedCategoryId).then((items) => {
      if (!cancelled) {
        setSubcategories(items);
        setSubcategoriesForCategoryId(selectedCategoryId);
      }
    }).catch((error) => console.error('Could not load subcategories:', error));
    return () => { cancelled = true; };
  }, [selectedCategoryId]);

  const handleSave = async () => {
    if (isFutureDate(expenseDate)) {
      Alert.alert('Future date not allowed', 'Personal expenses can only be dated today or earlier.');
      return;
    }
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
        subcategory_id: selectedSubcategoryId,
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
    if (isFutureDate(d.getTime())) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      setExpenseDate(today.getTime());
      return;
    }
    setExpenseDate(d.getTime());
  };

  const nextExpenseDate = new Date(expenseDate);
  nextExpenseDate.setDate(nextExpenseDate.getDate() + 1);
  const canAdvanceDate = !isFutureDate(nextExpenseDate.getTime());

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
                const categoryIcon = cat.is_default === 1 ? meta.icon : cat.icon || meta.icon;

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
                    onPress={() => {
                      if (selectedCategoryId !== cat.id) setSelectedSubcategoryId(null);
                      setSelectedCategoryId(cat.id);
                    }}
                    activeOpacity={0.8}
                  >
                    <MaterialIcons
                      name={categoryIcon as any}
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

          {subcategoriesForCategoryId === selectedCategoryId && subcategories.length > 0 && (
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Subcategory (Optional)</Text>
              <View style={styles.subcategoryGrid}>
                <TouchableOpacity
                  style={[styles.subcategoryChip, { backgroundColor: selectedSubcategoryId === null ? colors.primaryLight : colors.card, borderColor: selectedSubcategoryId === null ? colors.primary : colors.border, borderRadius: borderRadius.full }]}
                  onPress={() => setSelectedSubcategoryId(null)}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="remove-circle-outline" size={15} color={selectedSubcategoryId === null ? colors.primary : colors.textSecondary} />
                  <Text style={[styles.subcategoryText, { color: selectedSubcategoryId === null ? colors.primary : colors.text }]}>None</Text>
                </TouchableOpacity>
                {subcategories.map((item) => {
                  const selected = selectedSubcategoryId === item.id;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.subcategoryChip, { backgroundColor: selected ? colors.primaryLight : colors.card, borderColor: selected ? colors.primary : colors.border, borderRadius: borderRadius.full }]}
                      onPress={() => setSelectedSubcategoryId(item.id)}
                      activeOpacity={0.8}
                    >
                      <MaterialIcons name={getSubcategoryIcon(item.name) as any} size={15} color={selected ? colors.primary : colors.textSecondary} />
                      <Text style={[styles.subcategoryText, { color: selected ? colors.primary : colors.text }]}>{item.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Payment Method */}
          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              Payment Method
            </Text>
            <View style={styles.paymentMethodGrid}>
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

              <TouchableOpacity
                style={styles.dateCenter}
                onPress={() => setShowExpenseDatePicker(true)}
                accessibilityRole="button"
                accessibilityLabel={`Choose expense date, currently ${formatDate(expenseDate)}`}
                activeOpacity={0.7}
              >
                <MaterialIcons
                  name="calendar-today"
                  size={18}
                  color={colors.primary}
                />
                <Text style={[styles.dateText, { color: colors.text }]}>
                  {formatDate(expenseDate)}
                </Text>
                <MaterialIcons name="edit-calendar" size={18} color={colors.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.dateNavBtn,
                  { backgroundColor: colors.surfaceVariant, opacity: canAdvanceDate ? 1 : 0.45 },
                ]}
                onPress={() => adjustDateDays(1)}
                disabled={!canAdvanceDate}
              >
                <MaterialIcons
                  name="chevron-right"
                  size={24}
                  color={colors.text}
                />
              </TouchableOpacity>
            </View>
            {showExpenseDatePicker && (
              <DateTimePicker
                value={new Date(expenseDate)}
                mode="date"
                display={Platform.OS === 'ios' ? 'compact' : 'default'}
                maximumDate={new Date()}
                onValueChange={(_, selectedDate) => {
                  setExpenseDate(selectedDate.getTime());
                  setShowExpenseDatePicker(false);
                }}
                onDismiss={() => setShowExpenseDatePicker(false)}
              />
            )}
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
  subcategoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  subcategoryChip: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 13, paddingVertical: 8, borderWidth: 1 },
  subcategoryText: { fontSize: 12, fontWeight: '600' },
  paymentMethodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 8,
  },
  paymentMethodBtn: {
    width: '31.5%',
    minHeight: 66,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: 8,
    borderWidth: 1,
    gap: 4,
  },
  paymentMethodText: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
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
