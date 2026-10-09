import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DEFAULT_CATEGORY_METAS } from '../constants/categories';
import { useTheme } from '../hooks/useTheme';
import { categoryRepository } from '../repositories/personal/category.repository';
import { personalExpenseRepository } from '../repositories/personal/expense.repository';
import { Category, PersonalExpenseWithCategory } from '../types/personal';
import { formatPaiseToRupees } from '../utils/currency';
import { formatDate } from '../utils/date';

type PeriodMonths = 3 | 6 | 12;
type MonthPoint = { key: string; label: string; year: string; total: number };
type CategoryPoint = {
  id: string;
  name: string;
  total: number;
  expenses: PersonalExpenseWithCategory[];
};

const PERIODS: PeriodMonths[] = [3, 6, 12];

function safeAmount(value: unknown): number {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

function sumBetween(
  expenses: PersonalExpenseWithCategory[],
  start: number,
  end: number,
): number {
  return expenses.reduce((sum, expense) => {
    if (expense.expense_date < start || expense.expense_date > end) return sum;
    return sum + safeAmount(expense.amount);
  }, 0);
}

function getCompactAmount(paise: number): string {
  const rupees = paise / 100;
  if (rupees >= 10000000) return `₹${(rupees / 10000000).toFixed(1)}Cr`;
  if (rupees >= 100000) return `₹${(rupees / 100000).toFixed(1)}L`;
  if (rupees >= 1000) return `₹${(rupees / 1000).toFixed(1)}k`;
  return `₹${Math.round(rupees)}`;
}

export default function SpendingInsightsScreen() {
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const [periodMonths, setPeriodMonths] = useState<PeriodMonths>(6);
  const [expenses, setExpenses] = useState<PersonalExpenseWithCategory[]>([]);
  const [savedCategories, setSavedCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);
  const [showAllExpensesForCategoryId, setShowAllExpensesForCategoryId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const now = new Date();
      const rangeStart = new Date(
        now.getFullYear(),
        now.getMonth() - periodMonths + 1,
        1,
      ).getTime();
      const rangeEnd = now.getTime();

      Promise.all([
        personalExpenseRepository.getAll({ startDate: rangeStart, endDate: rangeEnd }),
        categoryRepository.getAll(),
      ])
        .then(([rows, categories]) => {
          if (active) {
            setExpenses(rows);
            setSavedCategories(categories);
          }
        })
        .catch((error) => {
          console.error('Failed to load spending insights:', error);
          if (active) {
            setExpenses([]);
            setSavedCategories([]);
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });

      return () => {
        active = false;
      };
    }, [periodMonths]),
  );

  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const currentMonthEnd = new Date(
    now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999,
  ).getTime();
  const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
  const previousMonthDays = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
  const previousMonthComparableEnd = new Date(
    now.getFullYear(),
    now.getMonth() - 1,
    Math.min(now.getDate(), previousMonthDays),
    23,
    59,
    59,
    999,
  ).getTime();

  const currentMonthTotal = sumBetween(expenses, currentMonthStart, currentMonthEnd);
  const previousMonthTotal = sumBetween(expenses, previousMonthStart, previousMonthComparableEnd);
  const periodTotal = expenses.reduce((sum, expense) => sum + safeAmount(expense.amount), 0);

  const monthPoints = (() => {
    const points: MonthPoint[] = [];
    for (let offset = periodMonths - 1; offset >= 0; offset -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const start = date.getTime();
      const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
      points.push({
        key: `${date.getFullYear()}-${date.getMonth()}`,
        label: date.toLocaleDateString('en-IN', { month: 'short' }),
        year: String(date.getFullYear()).slice(-2),
        total: sumBetween(expenses, start, Math.min(end, now.getTime())),
      });
    }
    return points;
  })();

  const categories = (() => {
    const groups = new Map<string, CategoryPoint>();
    for (const category of savedCategories) {
      if (category.is_default === 0) {
        groups.set(category.id, {
          id: category.id,
          name: category.name,
          total: 0,
          expenses: [],
        });
      }
    }
    for (const expense of expenses) {
      const id = expense.category_id || 'other';
      const name = expense.category_name || 'Other';
      const current = groups.get(id) ?? { id, name, total: 0, expenses: [] };
      current.total += safeAmount(expense.amount);
      current.expenses.push(expense);
      groups.set(id, current);
    }
    return Array.from(groups.values())
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  })();

  const paymentMethods = (() => {
    const groups = new Map<string, number>();
    for (const expense of expenses) {
      const method = expense.payment_method || 'Other';
      groups.set(method, (groups.get(method) ?? 0) + safeAmount(expense.amount));
    }
    return Array.from(groups.entries())
      .map(([name, total]) => ({ name, total }))
      .filter((method) => method.total > 0)
      .sort((a, b) => b.total - a.total);
  })();

  const maxMonthTotal = Math.max(1, ...monthPoints.map((point) => point.total));
  const comparisonDifference = currentMonthTotal - previousMonthTotal;
  const comparisonPercent = previousMonthTotal > 0
    ? Math.round((Math.abs(comparisonDifference) / previousMonthTotal) * 100)
    : null;

  const renderCategoryDetails = (category: CategoryPoint) => {
    const subcategories = new Map<string, number>();
    for (const expense of category.expenses) {
      if (!expense.subcategory_name) continue;
      subcategories.set(
        expense.subcategory_name,
        (subcategories.get(expense.subcategory_name) ?? 0) + safeAmount(expense.amount),
      );
    }

    const orderedExpenses = [...category.expenses]
      .sort((a, b) => b.expense_date - a.expense_date)
    const showAllExpenses = showAllExpensesForCategoryId === category.id;
    const visibleExpenses = showAllExpenses ? orderedExpenses : orderedExpenses.slice(0, 5);

    return (
      <View style={[styles.categoryDetails, { borderTopColor: colors.border }]}>
        {subcategories.size > 0 && (
          <View style={styles.subcategoryList}>
            {Array.from(subcategories.entries())
              .sort((a, b) => b[1] - a[1])
              .map(([name, total]) => (
                <View key={name} style={styles.subcategoryRow}>
                  <Text style={[styles.subcategoryName, { color: colors.textSecondary }]}>{name}</Text>
                  <Text style={[styles.subcategoryAmount, { color: colors.text }]}>
                    {formatPaiseToRupees(total)}
                  </Text>
                </View>
              ))}
          </View>
        )}
        {orderedExpenses.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>No expenses in this period.</Text>
        ) : (
          <>
            <Text style={[styles.detailHeading, { color: colors.textSecondary }]}>Recent expenses</Text>
            {visibleExpenses.map((expense) => (
          <View key={expense.id} style={styles.expenseRow}>
            <View style={styles.expenseText}>
              <Text numberOfLines={1} style={[styles.expenseDescription, { color: colors.text }]}>
                {expense.description?.trim() || expense.subcategory_name || category.name}
              </Text>
              <Text style={[styles.expenseDate, { color: colors.textMuted }]}>
                {formatDate(expense.expense_date)} · {expense.payment_method}
              </Text>
            </View>
            <Text style={[styles.expenseAmount, { color: colors.text }]}>
              {formatPaiseToRupees(safeAmount(expense.amount))}
            </Text>
          </View>
            ))}
          </>
        )}
        {orderedExpenses.length > 5 && (
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => setShowAllExpensesForCategoryId(showAllExpenses ? null : category.id)}
            style={styles.showAllButton}
          >
            <Text style={[styles.moreExpenses, { color: colors.primary }]}>
              {showAllExpenses ? 'Show recent expenses' : `Show all ${orderedExpenses.length} expenses`}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView edges={['bottom']} style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { padding: spacing.base, paddingBottom: spacing['3xl'] }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.intro, { color: colors.textSecondary }]}>
          A clear view of your personal spending over time.
        </Text>

        <View style={[styles.periodPicker, { backgroundColor: colors.surfaceVariant, borderRadius: borderRadius.full }]}>
          {PERIODS.map((months) => {
            const selected = months === periodMonths;
            return (
              <TouchableOpacity
                key={months}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => {
                  setPeriodMonths(months);
                  setExpandedCategoryId(null);
                  setShowAllExpensesForCategoryId(null);
                  setLoading(true);
                }}
                style={[
                  styles.periodOption,
                  selected && { backgroundColor: colors.primary, borderRadius: borderRadius.full },
                ]}
              >
                <Text style={[styles.periodText, { color: selected ? colors.textInverse : colors.textSecondary }]}>
                  {months} months
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading insights…</Text>
          </View>
        ) : (
          <>
            <View style={[styles.heroCard, { backgroundColor: colors.personalAccent, borderRadius: borderRadius.xl, ...shadows.md }]}>
              <Text style={styles.heroEyebrow}>THIS MONTH SO FAR</Text>
              <Text style={styles.heroAmount}>{formatPaiseToRupees(currentMonthTotal)}</Text>
              <View style={styles.comparisonRow}>
                <MaterialIcons
                  name={comparisonDifference > 0 ? 'trending-up' : comparisonDifference < 0 ? 'trending-down' : 'trending-flat'}
                  size={18}
                  color="#ffffff"
                />
                <Text style={styles.comparisonText}>
                  {previousMonthTotal === 0
                    ? currentMonthTotal === 0
                      ? 'No spending recorded yet'
                      : 'Compared with no spending in the same period last month'
                    : `${comparisonPercent}% ${comparisonDifference > 0 ? 'higher' : comparisonDifference < 0 ? 'lower' : 'unchanged'} than the same days last month`}
                </Text>
              </View>
              <Text style={styles.comparisonSubtext}>
                Previous period: {formatPaiseToRupees(previousMonthTotal)}
              </Text>
            </View>

            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: borderRadius.lg }]}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Spending trend</Text>
                  <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>Total: {formatPaiseToRupees(periodTotal)}</Text>
                </View>
                <MaterialIcons name="show-chart" size={22} color={colors.primary} />
              </View>
              {periodTotal === 0 ? (
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>Add expenses to see your monthly trend.</Text>
              ) : (
                <View style={styles.chart}>
                  {monthPoints.map((point, index) => {
                    const height = point.total > 0 ? Math.max(8, (point.total / maxMonthTotal) * 112) : 3;
                    return (
                      <View key={point.key} style={styles.chartColumn}>
                        <Text numberOfLines={1} style={[styles.chartAmount, { color: colors.textMuted }]}>
                          {point.total > 0 ? getCompactAmount(point.total) : ''}
                        </Text>
                        <View style={[styles.barTrack, { backgroundColor: colors.surfaceVariant }]}>
                          <View
                            style={[
                              styles.bar,
                              {
                                height,
                                backgroundColor: index === monthPoints.length - 1 ? colors.primary : colors.primaryLight,
                              },
                            ]}
                          />
                        </View>
                        <Text style={[styles.chartMonth, { color: colors.textSecondary }]}>{point.label}</Text>
                        <Text style={[styles.chartYear, { color: colors.textMuted }]}>{point.year}</Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: borderRadius.lg }]}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>By category</Text>
                  <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>Tap a category to see details</Text>
                </View>
                <MaterialIcons name="donut-large" size={22} color={colors.primary} />
              </View>
              {categories.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>No spending in this period.</Text>
              ) : categories.map((category) => {
                const expanded = expandedCategoryId === category.id;
                const percent = periodTotal > 0 ? Math.round((category.total / periodTotal) * 100) : 0;
                const meta = DEFAULT_CATEGORY_METAS[category.name] ?? DEFAULT_CATEGORY_METAS.Other;
                return (
                  <View key={category.id} style={[styles.categoryBlock, { borderTopColor: colors.border }]}>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityState={{ expanded }}
                      onPress={() => {
                        setExpandedCategoryId(expanded ? null : category.id);
                        setShowAllExpensesForCategoryId(null);
                      }}
                      style={styles.categoryRow}
                    >
                      <View style={[styles.categoryIcon, { backgroundColor: meta.bgColor, borderRadius: borderRadius.md }]}>
                        <MaterialIcons name={meta.icon as keyof typeof MaterialIcons.glyphMap} size={19} color={meta.color} />
                      </View>
                      <View style={styles.categoryInfo}>
                        <View style={styles.categoryNameRow}>
                          <Text numberOfLines={1} style={[styles.categoryName, { color: colors.text }]}>{category.name}</Text>
                          <Text style={[styles.categoryPercent, { color: colors.textSecondary }]}>{percent}%</Text>
                        </View>
                        <View style={[styles.progressTrack, { backgroundColor: colors.surfaceVariant }]}>
                          <View style={[styles.progressBar, { width: `${percent}%`, backgroundColor: meta.color }]} />
                        </View>
                      </View>
                      <View style={styles.categoryTotalWrap}>
                        <Text style={[styles.categoryTotal, { color: colors.text }]}>{formatPaiseToRupees(category.total)}</Text>
                        <MaterialIcons name={expanded ? 'expand-less' : 'expand-more'} size={20} color={colors.textMuted} />
                      </View>
                    </TouchableOpacity>
                    {expanded && renderCategoryDetails(category)}
                  </View>
                );
              })}
            </View>

            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: borderRadius.lg }]}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>By payment method</Text>
                  <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>Across the selected period</Text>
                </View>
                <MaterialIcons name="account-balance-wallet" size={22} color={colors.primary} />
              </View>
              {paymentMethods.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>No payment data in this period.</Text>
              ) : paymentMethods.map((method) => {
                const percent = periodTotal > 0 ? Math.round((method.total / periodTotal) * 100) : 0;
                return (
                  <View key={method.name} style={styles.methodRow}>
                    <View style={styles.methodTopRow}>
                      <Text style={[styles.methodName, { color: colors.text }]}>{method.name}</Text>
                      <Text style={[styles.methodTotal, { color: colors.text }]}>{formatPaiseToRupees(method.total)}</Text>
                    </View>
                    <View style={styles.methodBottomRow}>
                      <View style={[styles.progressTrack, styles.methodTrack, { backgroundColor: colors.surfaceVariant }]}>
                        <View style={[styles.progressBar, { width: `${percent}%`, backgroundColor: colors.primary }]} />
                      </View>
                      <Text style={[styles.methodPercent, { color: colors.textSecondary }]}>{percent}%</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: 16 },
  intro: { fontSize: 14, lineHeight: 20, marginBottom: 2 },
  periodPicker: { flexDirection: 'row', padding: 4 },
  periodOption: { flex: 1, minHeight: 38, justifyContent: 'center', alignItems: 'center' },
  periodText: { fontSize: 13, fontWeight: '700' },
  loading: { minHeight: 220, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { fontSize: 14 },
  heroCard: { padding: 20 },
  heroEyebrow: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '700', letterSpacing: 0.7 },
  heroAmount: { color: '#fff', fontSize: 30, fontWeight: '800', marginTop: 5 },
  comparisonRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 14 },
  comparisonText: { color: '#fff', flex: 1, fontSize: 13, fontWeight: '600' },
  comparisonSubtext: { color: 'rgba(255,255,255,0.72)', fontSize: 12, marginTop: 5 },
  card: { borderWidth: StyleSheet.hairlineWidth, padding: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  sectionSubtitle: { fontSize: 12, marginTop: 3 },
  emptyText: { fontSize: 13, lineHeight: 19, paddingVertical: 8 },
  chart: { flexDirection: 'row', gap: 8, height: 166, alignItems: 'flex-end' },
  chartColumn: { flex: 1, minWidth: 0, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  chartAmount: { fontSize: 9, height: 16, textAlign: 'center', width: '100%' },
  barTrack: { height: 116, width: '72%', borderRadius: 7, justifyContent: 'flex-end', overflow: 'hidden' },
  bar: { width: '100%', borderTopLeftRadius: 7, borderTopRightRadius: 7 },
  chartMonth: { fontSize: 10, fontWeight: '700', marginTop: 6 },
  chartYear: { fontSize: 9, marginTop: 1 },
  categoryBlock: { borderTopWidth: StyleSheet.hairlineWidth },
  categoryRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 },
  categoryIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  categoryInfo: { flex: 1, minWidth: 0, gap: 7 },
  categoryNameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 6 },
  categoryName: { flex: 1, fontSize: 13, fontWeight: '600' },
  categoryPercent: { fontSize: 11, fontWeight: '600' },
  progressTrack: { height: 5, borderRadius: 3, overflow: 'hidden' },
  progressBar: { height: '100%', borderRadius: 3 },
  categoryTotalWrap: { alignItems: 'flex-end', gap: 2 },
  categoryTotal: { fontSize: 12, fontWeight: '700' },
  categoryDetails: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 10, paddingLeft: 46 },
  subcategoryList: { gap: 8, marginBottom: 12 },
  subcategoryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  subcategoryName: { flex: 1, fontSize: 12 },
  subcategoryAmount: { fontSize: 12, fontWeight: '600' },
  detailHeading: { fontSize: 11, fontWeight: '700', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.4 },
  expenseRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingVertical: 7 },
  expenseText: { flex: 1, minWidth: 0 },
  expenseDescription: { fontSize: 12, fontWeight: '600' },
  expenseDate: { fontSize: 10, marginTop: 2 },
  expenseAmount: { fontSize: 11, fontWeight: '700' },
  moreExpenses: { fontSize: 11, marginTop: 2, fontWeight: '600' },
  showAllButton: { alignSelf: 'flex-start', paddingVertical: 6 },
  methodRow: { marginTop: 14 },
  methodTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 },
  methodName: { fontSize: 13, fontWeight: '600' },
  methodTotal: { fontSize: 12, fontWeight: '700' },
  methodBottomRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  methodTrack: { flex: 1 },
  methodPercent: { fontSize: 10, width: 32, textAlign: 'right' },
});
