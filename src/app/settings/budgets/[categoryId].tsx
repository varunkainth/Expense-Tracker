import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Text, TouchableOpacity, View } from 'react-native';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import CategoryIcon from '../../../components/CategoryIcon';
import { useTheme } from '../../../hooks/useTheme';
import { categoryRepository } from '../../../repositories/personal/category.repository';
import { personalExpenseRepository } from '../../../repositories/personal/expense.repository';
import { getCategoryBudget } from '../../../services/category-budget.service';
import { Category, PersonalExpenseWithCategory } from '../../../types/personal';
import { formatPaiseToRupees } from '../../../utils/currency';
import { formatDate } from '../../../utils/date';

const SLICE_COLORS = ['#6366f1', '#14b8a6', '#f59e0b', '#f43f5e', '#8b5cf6'];
const monthAt = (start: number, offset: number) => {
  const date = new Date(start);
  return new Date(date.getFullYear(), date.getMonth() + offset, 1).getTime();
};
const monthLabel = (start: number, short = false) => new Intl.DateTimeFormat('en-IN', {
  month: short ? 'short' : 'long', year: short ? undefined : 'numeric',
}).format(new Date(start));
const compactAmount = (paise: number) => `₹${new Intl.NumberFormat('en-IN', {
  notation: 'compact', maximumFractionDigits: 1,
}).format(paise / 100)}`;
const inMonth = (expense: PersonalExpenseWithCategory, start: number) =>
  expense.expense_date >= start && expense.expense_date < monthAt(start, 1);
const sum = (items: PersonalExpenseWithCategory[]) => items.reduce((total, item) => total + item.amount, 0);

type Breakdown = { name: string; amount: number; count: number };

export default function CategoryBudgetInsightsScreen() {
  const { categoryId } = useLocalSearchParams<{ categoryId: string }>();
  const { colors } = useTheme();
  const [month, setMonth] = useState(() => monthAt(Date.now(), 0));
  const [requestedMonth, setRequestedMonth] = useState(() => monthAt(Date.now(), 0));
  const [currentMonth] = useState(() => monthAt(Date.now(), 0));
  const [category, setCategory] = useState<Category | null>(null);
  const [budget, setBudget] = useState<number | null>(null);
  const [expenses, setExpenses] = useState<PersonalExpenseWithCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const hasLoaded = useRef(false);
  const displayedMonth = useRef(month);
  const contentOpacity = useSharedValue(1);
  const contentShift = useSharedValue(0);
  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ translateX: contentShift.value }],
  }));

  const changeMonth = (offset: number) => {
    if (switching) return;
    const next = monthAt(displayedMonth.current, offset);
    if (next > currentMonth) return;
    setSwitching(true);
    setSwitchError(false);
    if (next === requestedMonth) setRetryCount((count) => count + 1);
    else setRequestedMonth(next);
  };

  useFocusEffect(useCallback(() => {
    let active = true;
    if (!categoryId) {
      setLoading(false);
      setError('Category not found.');
      return () => { active = false; };
    }
    if (hasLoaded.current) setSwitching(true);
    else setLoading(true);
    setSwitchError(false);
    Promise.all([
      categoryRepository.getById(categoryId),
      getCategoryBudget(categoryId),
      personalExpenseRepository.getAll({
        categoryId,
        startDate: monthAt(requestedMonth, -6),
        endDate: monthAt(requestedMonth, 1) - 1,
      }),
    ]).then(([nextCategory, nextBudget, nextExpenses]) => {
      if (!active) return;
      if (hasLoaded.current && requestedMonth !== displayedMonth.current) {
        contentOpacity.value = 0.55;
        contentShift.value = requestedMonth < displayedMonth.current ? 12 : -12;
      }
      setCategory(nextCategory);
      setBudget(nextBudget);
      setExpenses(nextExpenses);
      setMonth(requestedMonth);
      displayedMonth.current = requestedMonth;
      setError(nextCategory ? null : 'Category not found.');
      hasLoaded.current = true;
      requestAnimationFrame(() => {
        if (active) {
          contentOpacity.value = withTiming(1, { duration: 260 });
          contentShift.value = withTiming(0, { duration: 260 });
        }
      });
    }).catch((cause) => {
      console.error('Could not load category insights:', { retryCount, cause });
      if (active) {
        if (hasLoaded.current) setSwitchError(true);
        else setError('Could not load insights. Please try again.');
      }
    }).finally(() => {
      if (active) { setLoading(false); setSwitching(false); }
    });
    return () => { active = false; };
  }, [categoryId, requestedMonth, retryCount, contentOpacity, contentShift]));

  const selectedExpenses = useMemo(() => expenses.filter((item) => inMonth(item, month)), [expenses, month]);
  const spent = useMemo(() => sum(selectedExpenses), [selectedExpenses]);
  const previousSpent = useMemo(() => sum(expenses.filter((item) => inMonth(item, monthAt(month, -1)))), [expenses, month]);
  const trend = useMemo(() => Array.from({ length: 6 }, (_, index) => {
    const start = monthAt(month, index - 5);
    return { start, amount: sum(expenses.filter((item) => inMonth(item, start))) };
  }), [expenses, month]);
  const breakdown = useMemo(() => {
    const rows = new Map<string, Breakdown>();
    selectedExpenses.forEach((item) => {
      const name = item.subcategory_name?.trim() || 'Other expenses';
      const row = rows.get(name) || { name, amount: 0, count: 0 };
      row.amount += item.amount;
      row.count += 1;
      rows.set(name, row);
    });
    return [...rows.values()].sort((a, b) => b.amount - a.amount);
  }, [selectedExpenses]);
  const slices = useMemo(() => {
    if (breakdown.length <= 5) return breakdown;
    const first = breakdown.slice(0, 4);
    const rest = breakdown.slice(4);
    return [...first, { name: 'Others', amount: rest.reduce((total, row) => total + row.amount, 0), count: rest.reduce((total, row) => total + row.count, 0) }];
  }, [breakdown]);
  const highest = useMemo(() => selectedExpenses.reduce<PersonalExpenseWithCategory | null>((best, item) =>
    !best || item.amount > best.amount ? item : best, null), [selectedExpenses]);
  const canGoNext = month < currentMonth;
  const overBudget = budget !== null && spent > budget;
  const delta = spent - previousSpent;
  const maxTrend = Math.max(...trend.map((item) => item.amount), 1);
  const card = { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 20, padding: 18, gap: 14 } as const;
  const sectionTitle = { color: colors.text, fontSize: 17, fontWeight: '800' as const };

  const header = <View style={{ padding: 20, paddingBottom: 8, gap: 16 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surfaceVariant, borderRadius: 14, padding: 5 }}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Previous month" disabled={switching} onPress={() => changeMonth(-1)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: switching ? 0.4 : 1 }}>
        <MaterialIcons name="chevron-left" size={27} color={colors.text} />
      </TouchableOpacity>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>{monthLabel(month)}</Text>
        {switching && <ActivityIndicator size="small" color={colors.primary} />}
      </View>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Next month" disabled={!canGoNext || switching} onPress={() => changeMonth(1)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: canGoNext && !switching ? 1 : 0.35 }}>
        <MaterialIcons name="chevron-right" size={27} color={colors.text} />
      </TouchableOpacity>
    </View>

    {switchError && <TouchableOpacity accessibilityRole="button" onPress={() => { setSwitching(true); setRetryCount((count) => count + 1); }} style={{ backgroundColor: colors.warningBackground, borderRadius: 12, padding: 12 }}>
      <Text style={{ color: colors.text, fontWeight: '700' }}>Couldn’t load that month. Tap to retry.</Text>
    </TouchableOpacity>}

    <Animated.View style={[{ gap: 16 }, contentStyle]}>

    <View style={{ ...card, backgroundColor: colors.primaryLight, borderColor: colors.primaryLight, padding: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }}>
          <CategoryIcon icon={category?.icon} size={26} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 }}>CATEGORY SPENDING</Text>
          <Text style={{ color: colors.text, fontSize: 19, fontWeight: '800' }}>{category?.name || 'Category'}</Text>
        </View>
      </View>
      <Text style={{ color: colors.text, fontSize: 34, fontWeight: '800', letterSpacing: -1 }} adjustsFontSizeToFit numberOfLines={1}>{formatPaiseToRupees(spent)}</Text>
      {budget !== null ? <>
        <View style={{ height: 9, backgroundColor: colors.card, borderRadius: 6, overflow: 'hidden' }}>
          <View style={{ width: `${Math.min(spent / budget * 100, 100)}%`, height: 9, backgroundColor: overBudget ? colors.danger : colors.primary, borderRadius: 6 }} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
          <Text style={{ color: overBudget ? colors.danger : colors.textSecondary, fontWeight: '700', flex: 1 }}>
            {formatPaiseToRupees(Math.abs(budget - spent))} {overBudget ? 'over limit' : 'left to spend'}
          </Text>
          <Text style={{ color: colors.textSecondary }}>Limit {formatPaiseToRupees(budget)}</Text>
        </View>
      </> : <Text style={{ color: colors.textSecondary }}>No monthly limit set</Text>}
    </View>

    <View style={{ flexDirection: 'row', gap: 10 }}>
      <View style={{ ...card, flex: 1, padding: 15, gap: 5 }}>
        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>vs previous month</Text>
        <Text style={{ color: delta > 0 ? colors.danger : delta < 0 ? colors.success : colors.text, fontSize: 18, fontWeight: '800' }} adjustsFontSizeToFit numberOfLines={1}>
          {delta > 0 ? '+' : delta < 0 ? '−' : ''}{formatPaiseToRupees(Math.abs(delta))}
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
          {previousSpent === 0 ? 'No spending last month' : `${Math.round(Math.abs(delta) / previousSpent * 100)}% ${delta > 0 ? 'more' : delta < 0 ? 'less' : 'change'}`}
        </Text>
      </View>
      <View style={{ ...card, flex: 1, padding: 15, gap: 5 }}>
        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Transactions</Text>
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>{selectedExpenses.length}</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Avg {formatPaiseToRupees(selectedExpenses.length ? Math.round(spent / selectedExpenses.length) : 0)}</Text>
      </View>
    </View>

    <View style={card}>
      <Text style={sectionTitle}>Six-month trend</Text>
      <View style={{ height: 126, flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
        {trend.map((item, index) => <View key={item.start} style={{ flex: 1, alignItems: 'center', gap: 7 }}>
          <Text style={{ color: index === 5 ? colors.primary : colors.textSecondary, fontSize: 10, fontWeight: '700' }} numberOfLines={1} adjustsFontSizeToFit>{item.amount ? compactAmount(item.amount) : '—'}</Text>
          <View style={{ width: '100%', height: Math.max(5, item.amount / maxTrend * 74), backgroundColor: index === 5 ? colors.primary : colors.primaryLight, borderRadius: 7 }} />
          <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{monthLabel(item.start, true)}</Text>
        </View>)}
      </View>
    </View>

    <View style={card}>
      <Text style={sectionTitle}>Where it went</Text>
      {spent === 0 ? <Text style={{ color: colors.textSecondary }}>No spending in this category for {monthLabel(month)}.</Text> : <>
        <View style={{ alignItems: 'center', justifyContent: 'center', height: 176 }} accessibilityLabel={`Spending pie chart for ${category?.name}`}>
          <Svg width={168} height={168} viewBox="0 0 168 168" accessibilityRole="image">
            {(() => {
              const circumference = 2 * Math.PI * 62;
              let offset = 0;
              return slices.map((slice, index) => {
                const arc = slice.amount / spent * circumference;
                const circle = <Circle key={slice.name} cx="84" cy="84" r="62" fill="none" stroke={SLICE_COLORS[index]} strokeWidth="25" strokeDasharray={`${arc} ${circumference - arc}`} strokeDashoffset={-offset} rotation="-90" origin="84, 84" />;
                offset += arc;
                return circle;
              });
            })()}
          </Svg>
          <View pointerEvents="none" style={{ position: 'absolute', alignItems: 'center' }}>
            <Text style={{ color: colors.textSecondary, fontSize: 11 }}>TOTAL</Text>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800', maxWidth: 105 }} adjustsFontSizeToFit numberOfLines={1}>{compactAmount(spent)}</Text>
          </View>
        </View>
        <View style={{ gap: 10 }}>
          {slices.map((slice, index) => <View key={slice.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: SLICE_COLORS[index] }} />
            <Text style={{ color: colors.textSecondary, flex: 1 }} numberOfLines={1}>{slice.name}</Text>
            <Text style={{ color: colors.text, fontWeight: '700' }}>{Math.round(slice.amount / spent * 100)}%</Text>
          </View>)}
        </View>
      </>}
    </View>

    {breakdown.length > 0 && <View style={card}>
      <Text style={sectionTitle}>Subcategory breakdown</Text>
      <View style={{ flexDirection: 'row', borderBottomColor: colors.border, borderBottomWidth: 1, paddingBottom: 9 }}>
        <Text style={{ color: colors.textSecondary, fontSize: 11, flex: 1 }}>SUBCATEGORY</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 11, width: 42, textAlign: 'center' }}>COUNT</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 11, width: 105, textAlign: 'right' }}>SPENT</Text>
      </View>
      {breakdown.map((row) => <View key={row.name} style={{ gap: 5, paddingVertical: 5 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ color: colors.text, flex: 1, fontWeight: '600' }} numberOfLines={1}>{row.name}</Text>
          <Text style={{ color: colors.textSecondary, width: 42, textAlign: 'center' }}>{row.count}</Text>
          <Text style={{ color: colors.text, width: 105, textAlign: 'right', fontWeight: '700' }} numberOfLines={1} adjustsFontSizeToFit>{formatPaiseToRupees(row.amount)}</Text>
        </View>
        <View style={{ height: 4, backgroundColor: colors.surfaceVariant, borderRadius: 3 }}><View style={{ height: 4, width: `${row.amount / spent * 100}%`, backgroundColor: colors.primary, borderRadius: 3 }} /></View>
      </View>)}
    </View>}

    {highest && <View style={card}>
      <Text style={sectionTitle}>Largest expense</Text>
      <TouchableOpacity accessibilityRole="button" onPress={() => router.push(`/(personal)/expense/${highest.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: colors.warningBackground, alignItems: 'center', justifyContent: 'center' }}>
          <MaterialIcons name="north-east" size={22} color={colors.warning} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: '700' }} numberOfLines={1}>{highest.description || highest.subcategory_name || category?.name}</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{formatDate(highest.expense_date)}</Text>
        </View>
        <Text style={{ color: colors.text, fontWeight: '800' }}>{formatPaiseToRupees(highest.amount)}</Text>
      </TouchableOpacity>
    </View>}

    <View style={{ paddingTop: 4, gap: 4 }}>
      <Text style={sectionTitle}>All transactions</Text>
      <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{selectedExpenses.length} in {monthLabel(month)} · tap to view details</Text>
    </View>
    </Animated.View>
  </View>;

  return <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
    <Stack.Screen options={{ title: category?.name || 'Budget Insights' }} />
    {loading ? <ActivityIndicator size="large" color={colors.primary} style={{ flex: 1 }} /> : error ?
      <View style={{ padding: 24, gap: 14 }}><Text style={{ color: colors.danger }}>{error}</Text><TouchableOpacity onPress={() => router.back()}><Text style={{ color: colors.primary, fontWeight: '700' }}>Go back</Text></TouchableOpacity></View> :
      <FlatList
        data={selectedExpenses}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingBottom: 28 }}
        ListEmptyComponent={<Animated.View style={contentStyle}><Text style={{ color: colors.textSecondary, paddingHorizontal: 20, paddingVertical: 14 }}>No transactions this month.</Text></Animated.View>}
        renderItem={({ item }) => <Animated.View style={contentStyle}><TouchableOpacity accessibilityRole="button" accessibilityLabel={`View ${item.description || item.subcategory_name || category?.name} expense, ${formatPaiseToRupees(item.amount)}`} onPress={() => router.push(`/(personal)/expense/${item.id}`)}
          style={{ marginHorizontal: 20, marginBottom: 9, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: colors.surfaceVariant, alignItems: 'center', justifyContent: 'center' }}>
            <MaterialIcons name="receipt-long" size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ color: colors.text, fontWeight: '700' }} numberOfLines={1}>{item.description || item.subcategory_name || category?.name}</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{formatDate(item.expense_date)} · {item.payment_method}{item.subcategory_name ? ` · ${item.subcategory_name}` : ''}</Text>
          </View>
          <Text style={{ color: colors.text, fontWeight: '800' }}>{formatPaiseToRupees(item.amount)}</Text>
        </TouchableOpacity></Animated.View>}
      />}
  </SafeAreaView>;
}
