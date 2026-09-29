import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { personalExpenseRepository } from '../../repositories/personal/expense.repository';
import { categoryRepository } from '../../repositories/personal/category.repository';
import { Category, PersonalExpenseWithCategory } from '../../types/personal';
import { formatPaiseToRupees } from '../../utils/currency';
import { formatDate } from '../../utils/date';
import { DEFAULT_CATEGORY_METAS } from '../../constants/categories';

export default function HistoryScreen() {
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const router = useRouter();

  const [expenses, setExpenses] = useState<PersonalExpenseWithCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [totalPaise, setTotalPaise] = useState<number>(0);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [allExpenses, allCats] = await Promise.all([
        personalExpenseRepository.getAll(
          selectedCategoryId ? { categoryId: selectedCategoryId } : undefined
        ),
        categoryRepository.getAll(),
      ]);

      setExpenses(allExpenses);
      setCategories(allCats);
      const total = allExpenses.reduce((sum, item) => sum + item.amount, 0);
      setTotalPaise(total);
    } catch (err) {
      console.error('Error loading history:', err);
    }
  }, [selectedCategoryId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Total Filter Header Card */}
      <View
        style={[
          styles.totalCard,
          {
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
            ...shadows.sm,
          },
        ]}
      >
        <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>Total Expenses</Text>
        <Text style={[styles.totalAmount, { color: colors.text }]}>{formatPaiseToRupees(totalPaise)}</Text>
        <Text style={[styles.totalCount, { color: colors.textMuted }]}>{expenses.length} transactions</Text>
      </View>

      {/* Category Filter Chips */}
      <View style={[styles.filterBar, { borderBottomColor: colors.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          <TouchableOpacity
            style={[
              styles.filterChip,
              {
                backgroundColor: selectedCategoryId === null ? colors.primary : colors.card,
                borderColor: selectedCategoryId === null ? colors.primary : colors.border,
                borderRadius: borderRadius.full,
              },
            ]}
            onPress={() => setSelectedCategoryId(null)}
          >
            <Text
              style={[
                styles.filterChipText,
                { color: selectedCategoryId === null ? '#ffffff' : colors.text },
              ]}
            >
              All
            </Text>
          </TouchableOpacity>

          {categories.map((cat) => {
            const isSelected = selectedCategoryId === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: isSelected ? colors.primary : colors.card,
                    borderColor: isSelected ? colors.primary : colors.border,
                    borderRadius: borderRadius.full,
                  },
                ]}
                onPress={() => setSelectedCategoryId(cat.id)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    { color: isSelected ? '#ffffff' : colors.text },
                  ]}
                >
                  {cat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Expenses List */}
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { padding: spacing.base }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {expenses.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderRadius: borderRadius.lg }]}>
            <MaterialIcons name="filter-list-off" size={44} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No expenses found</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              There are no transactions recorded for the selected filter.
            </Text>
          </View>
        ) : (
          expenses.map((expense) => {
            const meta = DEFAULT_CATEGORY_METAS[expense.category_name || 'Other'] || DEFAULT_CATEGORY_METAS.Other;

            return (
              <TouchableOpacity
                key={expense.id}
                style={[
                  styles.expenseItem,
                  {
                    backgroundColor: colors.card,
                    borderRadius: borderRadius.md,
                    borderColor: colors.border,
                    ...shadows.sm,
                  },
                ]}
                onPress={() => router.push(`/(personal)/expense/${expense.id}`)}
                activeOpacity={0.7}
              >
                <View style={[styles.categoryIconCircle, { backgroundColor: meta.bgColor }]}>
                  <MaterialIcons name={meta.icon as any} size={22} color={meta.color} />
                </View>

                <View style={styles.expenseInfo}>
                  <Text style={[styles.expenseCategory, { color: colors.text }]}>
                    {expense.category_name || 'Expense'}
                  </Text>
                  <Text style={[styles.expenseMeta, { color: colors.textSecondary }]}>
                    {formatDate(expense.expense_date)} • {expense.payment_method}
                  </Text>
                  {expense.description ? (
                    <Text style={[styles.expenseDescription, { color: colors.textMuted }]} numberOfLines={1}>
                      {expense.description}
                    </Text>
                  ) : null}
                </View>

                <Text style={[styles.expenseAmount, { color: colors.text }]}>
                  -{formatPaiseToRupees(expense.amount)}
                </Text>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  totalCard: {
    padding: 16,
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  totalAmount: {
    fontSize: 28,
    fontWeight: '800',
    marginVertical: 4,
  },
  totalCount: {
    fontSize: 12,
  },
  filterBar: {
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  scrollContent: {
    paddingBottom: 32,
  },
  emptyCard: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  expenseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
  },
  categoryIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  expenseInfo: {
    flex: 1,
  },
  expenseCategory: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  expenseMeta: {
    fontSize: 12,
    fontWeight: '400',
  },
  expenseDescription: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 2,
  },
  expenseAmount: {
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
});
