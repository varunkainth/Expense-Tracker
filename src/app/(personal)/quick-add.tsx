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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { personalExpenseRepository } from '../../repositories/personal/expense.repository';
import { categoryRepository } from '../../repositories/personal/category.repository';
import { Category, PaymentMethod } from '../../types/personal';
import { PAYMENT_METHODS } from '../../constants/payment-methods';
import { DEFAULT_CATEGORY_METAS } from '../../constants/categories';
import { rupeesToPaise } from '../../utils/currency';
import { validateAmount } from '../../utils/validation';

export default function QuickAddScreen() {
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const router = useRouter();

  const [amountStr, setAmountStr] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>('UPI');
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadCategories() {
      try {
        const list = await categoryRepository.getAll();
        setCategories(list);
        if (list.length > 0) {
          setSelectedCategoryId(list[0].id);
        }
      } catch (err) {
        console.error('Error loading categories:', err);
      }
    }
    loadCategories();
  }, []);

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

      await personalExpenseRepository.quickAddExpense({
        amount: amountInPaise,
        payment_method: selectedPaymentMethod,
        category_id: selectedCategoryId,
      });

      router.back();
    } catch (err) {
      console.error('Failed to quick add expense:', err);
      Alert.alert('Error', 'Failed to save expense. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={[styles.scrollContent, { padding: spacing.base }]}>
          {/* Step 1: Amount */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Enter Amount</Text>
            <View
              style={[
                styles.amountInputContainer,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderRadius: borderRadius.lg,
                  ...shadows.sm,
                },
              ]}
            >
              <Text style={[styles.rupeeSymbol, { color: colors.primary }]}>₹</Text>
              <TextInput
                style={[styles.amountInput, { color: colors.text }]}
                placeholder="0"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
                value={amountStr}
                onChangeText={setAmountStr}
                autoFocus
              />
            </View>
          </View>

          {/* Step 2: Payment Method */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Payment Method</Text>
            <View style={styles.paymentMethodRow}>
              {PAYMENT_METHODS.map((method) => {
                const isSelected = selectedPaymentMethod === method.key;
                return (
                  <TouchableOpacity
                    key={method.key}
                    style={[
                      styles.paymentMethodBtn,
                      {
                        backgroundColor: isSelected ? colors.primary : colors.card,
                        borderColor: isSelected ? colors.primary : colors.border,
                        borderRadius: borderRadius.md,
                      },
                    ]}
                    onPress={() => setSelectedPaymentMethod(method.key)}
                    activeOpacity={0.8}
                  >
                    <MaterialIcons
                      name={method.icon as any}
                      size={20}
                      color={isSelected ? '#ffffff' : colors.text}
                    />
                    <Text
                      style={[
                        styles.paymentMethodText,
                        { color: isSelected ? '#ffffff' : colors.text },
                      ]}
                    >
                      {method.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Step 3: Category */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Select Category</Text>
            <View style={styles.categoryGrid}>
              {categories.map((cat) => {
                const isSelected = selectedCategoryId === cat.id;
                const meta = DEFAULT_CATEGORY_METAS[cat.name] || DEFAULT_CATEGORY_METAS.Other;

                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.categoryTile,
                      {
                        backgroundColor: isSelected ? colors.primaryLight : colors.card,
                        borderColor: isSelected ? colors.primary : colors.border,
                        borderRadius: borderRadius.md,
                      },
                    ]}
                    onPress={() => setSelectedCategoryId(cat.id)}
                    activeOpacity={0.8}
                  >
                    <View
                      style={[
                        styles.categoryIconCircle,
                        { backgroundColor: isSelected ? colors.primary : meta.bgColor },
                      ]}
                    >
                      <MaterialIcons
                        name={meta.icon as any}
                        size={20}
                        color={isSelected ? '#ffffff' : meta.color}
                      />
                    </View>
                    <Text
                      style={[
                        styles.categoryTileText,
                        { color: isSelected ? colors.primary : colors.text },
                      ]}
                      numberOfLines={1}
                    >
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </ScrollView>

        {/* Bottom Save Button */}
        <View style={[styles.bottomBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
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
            <MaterialIcons name="check" size={22} color="#ffffff" />
            <Text style={styles.saveBtnText}>{loading ? 'Saving...' : 'Record Expense'}</Text>
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
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
    marginLeft: 4,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
  },
  rupeeSymbol: {
    fontSize: 32,
    fontWeight: '700',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 32,
    fontWeight: '700',
    padding: 0,
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
    paddingVertical: 12,
    borderWidth: 1,
    gap: 6,
  },
  paymentMethodText: {
    fontSize: 13,
    fontWeight: '600',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryTile: {
    width: '31%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderWidth: 1,
    gap: 8,
  },
  categoryIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryTileText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
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
