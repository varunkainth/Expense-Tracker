import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { personalExpenseUndoService } from '@/services/personal-expense-undo.service';

import { DEFAULT_CATEGORY_METAS } from '../../constants/categories';
import { useTheme } from '../../hooks/useTheme';
import { useTabBackBehavior } from '../../hooks/useTabBackBehavior';
import { personalExpenseRepository } from '../../repositories/personal/expense.repository';
import { categoryRepository } from '../../repositories/personal/category.repository';
import { Category, PersonalExpenseWithCategory } from '../../types/personal';
import { formatPaiseToRupees } from '../../utils/currency';
import { formatDate } from '../../utils/date';

export type PersonalDateFilterType = 'all' | 'today' | 'yesterday' | 'custom' | 'range';


const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.20;
const SWIPE_VELOCITY = 700;
const CARD_EXIT_DISTANCE = SCREEN_WIDTH * 1.05;

// Pull-to-refresh
const PULL_THRESHOLD = 90;
const PULL_MAX_DISTANCE = PULL_THRESHOLD * 1.6;

const UNDO_DURATION = 3000;

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

type MonthData = {
  offset: number;
  year: number;
  month: number;
  label: string;
  startOfMonth: number;
  endOfMonth: number;
  isCurrentMonth: boolean;
};

function safeNumber(value: unknown, fallback = 0): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function getMonthData(offset: number): MonthData {
  const numericOffset = safeNumber(offset);

  /*
   * Never allow future months.
   *
   * 0  = current month
   * -1 = previous month
   * -2 = two months ago
   */
  const safeOffset = Math.min(numericOffset, 0);

  const now = new Date();
  const selectedDate = new Date(now.getFullYear(), now.getMonth() + safeOffset, 1);

  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth();

  const start = new Date(year, month, 1, 0, 0, 0, 0);
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999);

  return {
    offset: safeOffset,
    year,
    month,
    label: safeOffset === 0 ? 'This Month' : `${MONTH_NAMES[month]} ${year}`,
    startOfMonth: safeNumber(start.getTime()),
    endOfMonth: safeNumber(end.getTime()),
    isCurrentMonth: safeOffset === 0,
  };
}

type CategoryBreakdownItem = {
  name: string;
  color: string;
  bgColor: string;
  totalPaise: number;
  percent: number;
};

function computeCategoryBreakdown(
  expenses: PersonalExpenseWithCategory[],
): CategoryBreakdownItem[] {
  const totalsByCategory = new Map<string, number>();

  for (const expense of expenses) {
    const amount = safeNumber(expense.amount);

    if (amount < 0) {
      continue;
    }

    const key = expense.category_name || 'Other';
    const current = safeNumber(totalsByCategory.get(key));

    totalsByCategory.set(key, current + amount);
  }

  const grandTotal = Array.from(totalsByCategory.values()).reduce(
    (sum, value) => sum + safeNumber(value),
    0,
  );

  if (!Number.isFinite(grandTotal) || grandTotal <= 0) {
    return [];
  }

  return Array.from(totalsByCategory.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, totalPaise]) => {
      const meta =
        DEFAULT_CATEGORY_METAS[name] || DEFAULT_CATEGORY_METAS.Other;

      return {
        name,
        color: meta.color,
        bgColor: meta.bgColor,
        totalPaise: safeNumber(totalPaise),
        percent: Math.round((safeNumber(totalPaise) / grandTotal) * 100),
      };
    });
}

export default function PersonalScreen() {
  useTabBackBehavior();
  const { colors, spacing, borderRadius, shadows, typography } = useTheme();
  const router = useRouter();

  /*
   * ==============================
   * EXPENSE STATE
   * ==============================
   */

  const [expenses, setExpenses] = useState<PersonalExpenseWithCategory[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<Category[]>([]);
  const [categoryFilterId, setCategoryFilterId] = useState<string | null>(null);
  const [monthTotalPaise, setMonthTotalPaise] = useState<number>(0);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [undoExpense, setUndoExpense] =
    useState<PersonalExpenseWithCategory | null>(null);
  const [undoVisible, setUndoVisible] = useState(false);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /*
   * ==============================
   * DATE FILTER STATE
   * ==============================
   */
  const [dateFilter, setDateFilter] = useState<PersonalDateFilterType>('all');
  const [customFilterDate, setCustomFilterDate] = useState<number>(() => Date.now());
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const [showDateSelection, setShowDateSelection] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<'single' | 'range'>('single');
  const [pickerTarget, setPickerTarget] = useState<'single' | 'range-start' | 'range-end'>('single');
  const [rangeStartDate, setRangeStartDate] = useState<number>(() => Date.now());
  const [rangeEndDate, setRangeEndDate] = useState<number>(() => Date.now());

  /*
   * ==============================
   * MONTH STATE
   * ==============================
   *
   * 0  = current month
   * -1 = previous month
   * -2 = two months ago
   */

  const [monthOffset, setMonthOffset] = useState<number>(0);

  const monthData = useMemo(() => getMonthData(monthOffset), [monthOffset]);

  /*
   * ==============================
   * FILTER COMPUTATION
   * ==============================
   */
  const dateFilterInfo = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();

    if (dateFilter === 'today') {
      return { start: todayStart, end: todayEnd, label: 'Today' };
    }
    if (dateFilter === 'yesterday') {
      const yStart = todayStart - 86400000;
      const yEnd = todayEnd - 86400000;
      return { start: yStart, end: yEnd, label: 'Yesterday' };
    }
    if (dateFilter === 'custom') {
      const d = new Date(customFilterDate);
      const cStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime();
      const cEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();
      return { start: cStart, end: cEnd, label: formatDate(cStart) };
    }
    if (dateFilter === 'range') {
      const startDate = new Date(rangeStartDate);
      const endDate = new Date(rangeEndDate);
      const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 0, 0, 0, 0).getTime();
      const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59, 999).getTime();
      return { start, end, label: `${formatDate(start)} – ${formatDate(end)}` };
    }
    return { label: 'All Days' };
  }, [dateFilter, customFilterDate, rangeStartDate, rangeEndDate]);

  const filteredExpenses = useMemo(() => expenses.filter((expense) => {
    if (categoryFilterId && expense.category_id !== categoryFilterId) return false;
    if (dateFilter === 'all') return true;
    const { start, end } = dateFilterInfo;
    return start === undefined || end === undefined ||
      (expense.expense_date >= start && expense.expense_date <= end);
  }), [expenses, categoryFilterId, dateFilter, dateFilterInfo]);

  const filteredTotalPaise = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + safeNumber(e.amount), 0);
  }, [filteredExpenses]);
  const selectedCategoryName = expenseCategories.find((category) => category.id === categoryFilterId)?.name;
  const hasActiveFilter = dateFilter !== 'all' || categoryFilterId !== null;
  const activeFilterLabel = [dateFilter !== 'all' ? dateFilterInfo.label : null, selectedCategoryName]
    .filter(Boolean)
    .join(' · ');

  /*
   * ==============================
   * MONTH CARD ANIMATION
   * ==============================
   */

  const translateX = useSharedValue(0);
  const cardOpacity = useSharedValue(1);
  const isAnimating = useSharedValue(false);

  /*
   * ==============================
   * PULL-TO-REFRESH STATE
   * ==============================
   */

  const pullDistance = useSharedValue(0);
  const isRefreshingShared = useSharedValue(false);

  useEffect(() => {
    isRefreshingShared.value = refreshing;
  }, [refreshing]);

  /*
   * ==============================
   * LOAD MONTH DATA
   * ==============================
   */

  const loadData = useCallback(async (
    month: MonthData,
    filterRange?: { startDate: number; endDate: number },
  ) => {
    try {
      const startOfMonth = safeNumber(month.startOfMonth);
      const endOfMonth = safeNumber(month.endOfMonth);

      const [monthExpenses, total, categories] = await Promise.all([
        personalExpenseRepository.getAll({
          startDate: filterRange?.startDate ?? startOfMonth,
          endDate: filterRange?.endDate ?? endOfMonth,
        }),
        personalExpenseRepository.getTotalExpenses(startOfMonth, endOfMonth),
        categoryRepository.getAll(),
      ]);

      const safeExpenses = Array.isArray(monthExpenses)
        ? monthExpenses.map((expense) => ({
          ...expense,
          amount: safeNumber(expense.amount),
        }))
        : [];

      setExpenses(safeExpenses);
      setExpenseCategories(categories);
      setMonthTotalPaise(safeNumber(total));
    } catch (error) {
      console.error('Error loading personal expenses:', error);

      setExpenses([]);
      setExpenseCategories([]);
      setMonthTotalPaise(0);
    }
  }, []);

  const loadVisibleData = useCallback(async (month: MonthData) => {
    const { start, end } = dateFilterInfo;
    const filterRange = dateFilter !== 'all' && start !== undefined && end !== undefined
      ? { startDate: start, endDate: end }
      : undefined;
    await loadData(month, filterRange);
  }, [dateFilter, dateFilterInfo, loadData]);


  const clearUndoTimer = useCallback(() => {
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
  }, []);

  const hideUndoSnackbar = useCallback(() => {
    clearUndoTimer();
    personalExpenseUndoService.clear();
    setUndoExpense(null);
    setUndoVisible(false);
  }, [clearUndoTimer]);

  const showUndoSnackbar = useCallback(
    (expense: PersonalExpenseWithCategory) => {
      clearUndoTimer();
      setUndoExpense(expense);
      setUndoVisible(true);

      undoTimerRef.current = setTimeout(() => {
        personalExpenseUndoService.clear();
        setUndoExpense(null);
        setUndoVisible(false);
        undoTimerRef.current = null;
      }, UNDO_DURATION);
    },
    [clearUndoTimer],
  );

  const handleUndo = useCallback(async () => {
    if (!undoExpense) return;

    const expenseToRestore = undoExpense;
    clearUndoTimer();

    try {
      await personalExpenseRepository.restore(expenseToRestore);
      personalExpenseUndoService.clear();
      setUndoExpense(null);
      setUndoVisible(false);

      // Reload the month currently being displayed.
      await loadVisibleData(monthData);
    } catch (error) {
      console.error('Failed to undo expense deletion:', error);

      // Keep the snackbar visible if restore failed.
      setUndoExpense(expenseToRestore);
      setUndoVisible(true);
    }
  }, [undoExpense, clearUndoTimer, loadVisibleData, monthData]);

  useEffect(() => {
    const unsubscribe = personalExpenseUndoService.subscribe((expense) => {
      if (!expense) {
        clearUndoTimer();
        setUndoExpense(null);
        setUndoVisible(false);
        return;
      }
      showUndoSnackbar(expense);
    });

    // The expense may already have been deleted before this
    // screen mounted again (e.g. navigating from detail screen).
    const existing = personalExpenseUndoService.getPendingExpense();
    if (existing) {
      showUndoSnackbar(existing);
    }

    return () => {
      unsubscribe();
      clearUndoTimer();
    };
  }, [clearUndoTimer, showUndoSnackbar]);

  /*
   * Reload whenever month changes.
   */

  useEffect(() => {
    loadVisibleData(monthData);
  }, [monthData, loadVisibleData]);

  /*
   * ==============================
   * SCREEN FOCUS
   * ==============================
   *
   * Reload data whenever this screen
   * becomes active again.
   *
   * This is important after:
   * - Add Expense
   * - Editing an expense
   * - Deleting an expense
   */

  useFocusEffect(
    useCallback(() => {
      // Always return to current month
      setMonthOffset(0);

      // Reset month card animation
      translateX.value = 0;
      cardOpacity.value = 1;
      isAnimating.value = false;

      /*
       * Reload expenses from database.
       *
       * This makes newly added expenses appear when returning from Add Expense.
       */
      const currentMonth = getMonthData(0);

      loadVisibleData(currentMonth);

    }, [
      loadVisibleData,
      translateX,
      cardOpacity,
      isAnimating,
    ]),
  );

  /*
   * ==============================
   * REFRESH
   * ==============================
   *
   * NOTE: This must be defined BEFORE
   * scrollHandler, because the handler
   * calls it via runOnJS.
   */

  const onRefresh = useCallback(async () => {
    setRefreshing(true);

    try {
      await loadVisibleData(monthData);
    } finally {
      setRefreshing(false);
    }
  }, [loadVisibleData, monthData]);

  /*
   * ==============================
   * PULL-TO-REFRESH SCROLL HANDLER
   * ==============================
   *
   * Tracks how far the user pulls past
   * the top of the list and triggers
   * onRefresh when they release past
   * the threshold.
   */

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      const offsetY = event.contentOffset.y;
      // offsetY is negative when pulling down past the top
      pullDistance.value = offsetY < 0 ? -offsetY : 0;
    },
    onEndDrag: (event) => {
      const offsetY = event.contentOffset.y;

      if (
        !isRefreshingShared.value &&
        offsetY < -PULL_THRESHOLD
      ) {
        runOnJS(onRefresh)();
      }
    },
  });

  /*
   * ==============================
   * PULL-TO-REFRESH INDICATOR STYLES
   * ==============================
   */

  // The indicator pill follows the finger
  const refreshIndicatorStyle = useAnimatedStyle(() => {
    const pull = Math.min(pullDistance.value, PULL_MAX_DISTANCE);

    return {
      transform: [{ translateY: pull - 80 }],
      opacity: pull > 8 || isRefreshingShared.value ? 1 : 0,
    };
  });

  // Arrow flips when past the threshold
  const refreshArrowStyle = useAnimatedStyle(() => ({
    transform: [
      {
        rotate:
          pullDistance.value > PULL_THRESHOLD ? '180deg' : '0deg',
      },
    ],
    opacity: isRefreshingShared.value ? 0 : 1,
  }));

  // Spinner appears while refreshing
  const refreshSpinnerStyle = useAnimatedStyle(() => ({
    opacity: isRefreshingShared.value ? 1 : 0,
  }));

  /*
   * ==============================
   * PREVIOUS MONTH
   * ==============================
   *
   * ONLY LEFT SWIPE.
   */

  const changeMonth = useCallback(
    (direction: 'previous' | 'next') => {
      if (isAnimating.value) {
        return;
      }

      const currentOffset = safeNumber(monthOffset);

      // Never allow navigation into future months.
      if (direction === 'next' && currentOffset >= 0) {
        translateX.value = withSpring(0, {
          damping: 20,
          stiffness: 220,
        });
        return;
      }

      const targetOffset =
        direction === 'previous'
          ? currentOffset - 1
          : Math.min(currentOffset + 1, 0);

      isAnimating.value = true;

      const exitDirection = direction === 'previous' ? -1 : 1;

      // First move the currently visible card out.
      cardOpacity.value = withTiming(0, {
        duration: 140,
      });

      translateX.value = withTiming(
        exitDirection * CARD_EXIT_DISTANCE,
        {
          duration: 180,
        },
        (finished) => {
          if (!finished) {
            isAnimating.value = false;
            return;
          }

          // Change the month only after the old card has left.
          // This prevents the new month's data from appearing
          // inside the old card during the transition.
          runOnJS(setMonthOffset)(targetOffset);

          // Place the new month's card on the opposite side.
          translateX.value = -exitDirection * CARD_EXIT_DISTANCE;

          // Bring the new month into view.
          translateX.value = withTiming(
            0,
            {
              duration: 220,
            },
            (enterFinished) => {
              if (enterFinished) {
                isAnimating.value = false;
              }
            },
          );

          cardOpacity.value = withTiming(1, {
            duration: 220,
          });
        },
      );
    },
    [monthOffset, translateX, cardOpacity, isAnimating, setMonthOffset],
  );

  /*
   * ==============================
   * MONTH SWIPE
   * ==============================
   *
   * LEFT  = previous/older month
   * RIGHT = next/newer month
   */

  const panGesture = Gesture.Pan()
    .minDistance(10)
    .activeOffsetX([-10, 10])
    .failOffsetY([-30, 30])
    .onUpdate((event) => {
      if (isAnimating.value) {
        return;
      }

      // When already on the current month, don't allow
      // dragging the card into a future month.
      if (monthOffset >= 0 && event.translationX > 0) {
        translateX.value = 0;
        return;
      }

      translateX.value = event.translationX;
    })
    .onEnd((event) => {
      if (isAnimating.value) {
        return;
      }

      const translationX = event.translationX;
      const velocityX = event.velocityX;

      const distanceReached =
        Math.abs(translationX) >= SWIPE_THRESHOLD;

      const velocityReached =
        Math.abs(velocityX) >= SWIPE_VELOCITY;

      if (!distanceReached && !velocityReached) {
        translateX.value = withSpring(0, {
          damping: 20,
          stiffness: 220,
        });
        return;
      }

      // Prefer the actual drag direction when enough distance
      // was travelled; otherwise use the release velocity.
      const swipeDirection = distanceReached
        ? Math.sign(translationX)
        : Math.sign(velocityX);

      // LEFT -> older month.
      if (swipeDirection < 0) {
        runOnJS(changeMonth)('previous');
        return;
      }

      // RIGHT -> newer month, but only when viewing an older month.
      if (swipeDirection > 0) {
        if (monthOffset < 0) {
          runOnJS(changeMonth)('next');
        } else {
          translateX.value = withSpring(0, {
            damping: 20,
            stiffness: 220,
          });
        }
      }
    });

  /*
   * ==============================
   * MONTH CARD ANIMATION STYLE
   * ==============================
   */

  const cardAnimatedStyle = useAnimatedStyle(() => {
    const safeX = Number.isFinite(translateX.value)
      ? Math.max(
        -CARD_EXIT_DISTANCE,
        Math.min(CARD_EXIT_DISTANCE, translateX.value),
      )
      : 0;

    const safeOpacity = Number.isFinite(cardOpacity.value)
      ? cardOpacity.value
      : 1;

    return {
      transform: [{ translateX: safeX }],
      opacity: safeOpacity,
    };
  });

  /*
   * ==============================
   * CATEGORY BREAKDOWN
   * ==============================
   */

  const categoryBreakdown = useMemo(
    () => computeCategoryBreakdown(expenses),
    [expenses],
  );

  const safeMonthTotal = safeNumber(monthTotalPaise);

  /*
   * ==============================
   * UI
   * ==============================
   */

  return (
    <SafeAreaView
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
        },
      ]}
    >
      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={[
          styles.scrollContent,
          {
            padding: spacing.base,
          },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          Platform.OS === 'android' ? (
            <RefreshControl
              refreshing={false}
              onRefresh={() => { }}
              colors={['transparent']}
              progressBackgroundColor="transparent"
              // Move the native spinner fully above the viewport
              // so only our custom pill is ever visible.
              progressViewOffset={-120}
            />
          ) : undefined
        }
      >
        {/* =========================
            HEADER
        ========================== */}

        <View style={styles.headerRow}>
          <View>
            <Text
              style={[
                styles.headerGreeting,
                {
                  color: colors.textSecondary,
                },
              ]}
            >
              Personal Tracker
            </Text>

            <Text
              style={[
                styles.headerTitle,
                {
                  color: colors.text,
                },
              ]}
            >
              Expenses
            </Text>
          </View>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Open spending insights"
            onPress={() => router.push('/insights')}
            style={[
              styles.insightsButton,
              {
                backgroundColor: colors.primaryLight,
                borderRadius: borderRadius.full,
              },
            ]}
          >
            <MaterialIcons name="insights" size={18} color={colors.primary} />
            <Text style={[styles.insightsButtonText, { color: colors.primary }]}>Insights</Text>
          </TouchableOpacity>

        </View>

        {/* =========================
            MONTH
        ========================== */}

        <View style={styles.monthSelector}>
          <Text
            style={[
              styles.monthLabel,
              {
                color: colors.text,
              },
            ]}
          >
            {monthData.label}
          </Text>

          <Text
            style={[
              styles.monthHint,
              {
                color: colors.textMuted,
              },
            ]}
          >
            Swipe left for older • right for newer
          </Text>
        </View>

        {/* =========================
            SUMMARY CARD
        ========================== */}

        <GestureDetector gesture={panGesture}>
          <Animated.View
            style={[
              styles.summaryCard,
              {
                backgroundColor: colors.personalAccent,
                borderRadius: borderRadius.xl,
                ...shadows.md,
              },
              cardAnimatedStyle,
            ]}
          >
            <Text style={styles.summaryLabel}>
              {monthData.isCurrentMonth
                ? "This Month's Spending"
                : `${monthData.label} Spending`}
            </Text>

            <Text
              style={[
                typography.styles.heroAmount,
                styles.summaryAmount,
              ]}
            >
              {formatPaiseToRupees(safeMonthTotal)}
            </Text>

            {/* CATEGORY BREAKDOWN */}

            {categoryBreakdown.length > 0 && (
              <View style={styles.breakdownBar}>
                {categoryBreakdown.map((item) => (
                  <View
                    key={item.name}
                    style={{
                      flex: item.percent,
                      backgroundColor: item.color,
                      height: '100%',
                    }}
                  />
                ))}
              </View>
            )}

            {categoryBreakdown.length > 0 && (
              <View style={styles.breakdownLegend}>
                {categoryBreakdown.map((item) => (
                  <View key={item.name} style={styles.legendItem}>
                    <View
                      style={[
                        styles.legendDot,
                        {
                          backgroundColor: item.color,
                        },
                      ]}
                    />

                    <Text style={styles.legendText}>
                      {item.name} · {item.percent}%
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </Animated.View>
        </GestureDetector>

        {/* =========================
            DATE FILTER SECTION
        ========================== */}
        <View style={styles.filterSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterChipScroll}
          >
            {[
              { key: 'all' as const, label: 'All Days', icon: 'view-list' as const },
              { key: 'today' as const, label: 'Today', icon: 'today' as const },
              { key: 'yesterday' as const, label: 'Yesterday', icon: 'history' as const },
              {
                key: 'custom' as const,
                label: dateFilter === 'custom'
                  ? formatDate(customFilterDate)
                  : dateFilter === 'range' ? dateFilterInfo.label : 'Pick Date',
                icon: 'calendar-today' as const,
              },
            ].map((chip) => {
              const isSelected = dateFilter === chip.key || (chip.key === 'custom' && dateFilter === 'range');
              return (
                <TouchableOpacity
                  key={chip.key}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: isSelected ? colors.primary : colors.card,
                      borderColor: isSelected ? colors.primary : colors.border,
                      borderRadius: borderRadius.lg,
                      ...shadows.sm,
                    },
                  ]}
                  onPress={() => {
                    if (chip.key === 'custom') {
                      setShowDateSelection((visible) => !visible);
                    } else {
                      setDateFilter(chip.key);
                      setShowDateSelection(false);
                    }
                  }}
                  activeOpacity={0.75}
                >
                  <MaterialIcons
                    name={chip.icon}
                    size={15}
                    color={isSelected ? '#ffffff' : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.filterChipText,
                      {
                        color: isSelected ? '#ffffff' : colors.text,
                        fontWeight: isSelected ? '700' : '500',
                      },
                    ]}
                  >
                    {chip.label}
                  </Text>
                  {isSelected && chip.key !== 'all' && (
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        setDateFilter('all');
                        setShowDateSelection(false);
                      }}
                      hitSlop={8}
                    >
                      <MaterialIcons name="close" size={14} color="#ffffff" style={{ marginLeft: 2 }} />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={[styles.categoryFilterLabel, { color: colors.textSecondary }]}>CATEGORY</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryFilterScroll}
          >
            {[{ id: null, name: 'All categories', icon: 'apps' }, ...expenseCategories.map((category) => ({
              id: category.id,
              name: category.name,
              icon: category.is_default === 1
                ? DEFAULT_CATEGORY_METAS[category.name]?.icon || 'category'
                : category.icon || DEFAULT_CATEGORY_METAS[category.name]?.icon || 'category',
            }))].map((category) => {
              const selected = categoryFilterId === category.id;
              return (
                <TouchableOpacity
                  key={category.id || 'all-categories'}
                  style={[styles.categoryFilterChip, { backgroundColor: selected ? colors.primary : colors.card, borderColor: selected ? colors.primary : colors.border, borderRadius: borderRadius.full }]}
                  onPress={() => setCategoryFilterId(category.id)}
                  activeOpacity={0.75}
                >
                  <MaterialIcons name={category.icon as any} size={16} color={selected ? '#fff' : colors.primary} />
                  <Text style={[styles.categoryFilterText, { color: selected ? '#fff' : colors.text }]}>{category.name}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {showDateSelection && (
            <View style={[styles.dateSelectionCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: borderRadius.md }]}>
              <Text style={[styles.dateSelectionTitle, { color: colors.text }]}>Choose a date filter</Text>
              <View style={styles.dateModeRow}>
                {(['single', 'range'] as const).map((mode) => {
                  const selected = datePickerMode === mode;
                  return (
                    <TouchableOpacity
                      key={mode}
                      onPress={() => setDatePickerMode(mode)}
                      style={[styles.dateModeButton, { backgroundColor: selected ? colors.primary : colors.surfaceVariant, borderRadius: borderRadius.md }]}
                    >
                      <Text style={[styles.dateModeText, { color: selected ? '#fff' : colors.text }]}>{mode === 'single' ? 'Single day' : 'Date range'}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {datePickerMode === 'single' ? (
                <TouchableOpacity
                  style={[styles.dateChoiceButton, { borderColor: colors.border, borderRadius: borderRadius.md }]}
                  onPress={() => { setPickerTarget('single'); setShowDatePicker(true); }}
                >
                  <Text style={[styles.dateChoiceLabel, { color: colors.textSecondary }]}>Date</Text>
                  <Text style={[styles.dateChoiceValue, { color: colors.text }]}>{formatDate(customFilterDate)}</Text>
                  <MaterialIcons name="calendar-today" size={18} color={colors.primary} />
                </TouchableOpacity>
              ) : (
                <View style={styles.rangeChoiceRow}>
                  {([
                    ['range-start', 'From', rangeStartDate],
                    ['range-end', 'To', rangeEndDate],
                  ] as const).map(([target, label, timestamp]) => (
                    <TouchableOpacity
                      key={target}
                      style={[styles.dateChoiceButton, styles.rangeDateChoice, { borderColor: colors.border, borderRadius: borderRadius.md }]}
                      onPress={() => { setPickerTarget(target); setShowDatePicker(true); }}
                    >
                      <Text style={[styles.dateChoiceLabel, { color: colors.textSecondary }]}>{label}</Text>
                      <Text style={[styles.dateChoiceValue, { color: colors.text }]}>{formatDate(timestamp)}</Text>
                      <MaterialIcons name="calendar-today" size={18} color={colors.primary} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              <View style={styles.dateSelectionActions}>
                <TouchableOpacity onPress={() => setShowDateSelection(false)}>
                  <Text style={[styles.cancelDateText, { color: colors.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.applyDateButton, { backgroundColor: colors.primary, borderRadius: borderRadius.md }]}
                  onPress={() => {
                    setDateFilter(datePickerMode === 'single' ? 'custom' : 'range');
                    setShowDateSelection(false);
                  }}
                >
                  <Text style={styles.applyDateText}>Apply</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Active Filter Info Banner */}
          {(dateFilter !== 'all' || categoryFilterId !== null) && (
            <View
              style={[
                styles.activeFilterBanner,
                {
                  backgroundColor: `${colors.primary}12`,
                  borderColor: `${colors.primary}30`,
                  borderRadius: borderRadius.md,
                },
              ]}
            >
              <View style={styles.activeFilterLeft}>
                <MaterialIcons name="filter-list" size={16} color={colors.primary} />
                <Text style={[styles.activeFilterText, { color: colors.text }]}>
                  {dateFilter !== 'all' ? dateFilterInfo.label : 'Filtered'}
                  {categoryFilterId ? ` · ${selectedCategoryName || 'Category'}` : ''}:{' '}
                  <Text style={{ fontWeight: '700', color: colors.primary }}>
                    {filteredExpenses.length} {filteredExpenses.length === 1 ? 'expense' : 'expenses'} · {formatPaiseToRupees(filteredTotalPaise)}
                  </Text>
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setDateFilter('all')}
                style={styles.clearFilterButton}
              >
                <Text style={[styles.clearFilterText, { color: colors.primary }]}>Show All</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={new Date(pickerTarget === 'single' ? customFilterDate : pickerTarget === 'range-start' ? rangeStartDate : rangeEndDate)}
            maximumDate={new Date()}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            neutralButton={Platform.OS === 'android' ? { label: 'Clear' } : undefined}
            onValueChange={(_, selectedDate) => {
              const timestamp = selectedDate.getTime();
              if (pickerTarget === 'single') {
                setCustomFilterDate(timestamp);
              } else if (pickerTarget === 'range-start') {
                setRangeStartDate(timestamp);
                if (timestamp > rangeEndDate) setRangeEndDate(timestamp);
              } else {
                setRangeEndDate(timestamp);
                if (timestamp < rangeStartDate) setRangeStartDate(timestamp);
              }
              setShowDatePicker(false);
            }}
            onDismiss={() => setShowDatePicker(false)}
            onNeutralButtonPress={() => {
              setShowDatePicker(false);
              setDateFilter('all');
              setShowDateSelection(false);
            }}
          />
        )}

        {/* =========================
            EXPENSE HEADER
        ========================== */}

        <View style={styles.sectionHeader}>
          <Text
            style={[
              styles.sectionTitle,
              {
                color: colors.text,
              },
            ]}
          >
            {dateFilter !== 'all'
              ? `${dateFilterInfo.label} Expenses`
              : monthData.isCurrentMonth
              ? 'Recent Expenses'
              : `${monthData.label} Expenses`}
          </Text>
          <Text style={[styles.sectionCountText, { color: colors.textSecondary }]}>
            {filteredExpenses.length} {filteredExpenses.length === 1 ? 'item' : 'items'}
          </Text>
        </View>

        {/* =========================
            EMPTY STATE
        ========================== */}

        {filteredExpenses.length === 0 ? (
          <View
            style={[
              styles.emptyCard,
              {
                backgroundColor: colors.surface,
                borderRadius: borderRadius.lg,
              },
            ]}
          >
            <MaterialIcons
              name="receipt-long"
              size={48}
              color={colors.textMuted}
            />

            <Text
              style={[
                styles.emptyTitle,
                {
                  color: colors.text,
                },
              ]}
            >
              {hasActiveFilter
                ? `No expenses for ${activeFilterLabel}`
                : monthData.isCurrentMonth
                ? 'No expenses yet'
                : `No expenses in ${monthData.label}`}
            </Text>

            <Text
              style={[
                styles.emptySubtitle,
                {
                  color: colors.textSecondary,
                },
              ]}
            >
              {hasActiveFilter
                ? `There are no expenses recorded for ${activeFilterLabel}.`
                : monthData.isCurrentMonth
                ? 'Tap the + button to record your first expense.'
                : 'There are no recorded expenses for this month. Swipe left to check an older month.'}
            </Text>

            {hasActiveFilter && (
              <TouchableOpacity
                style={[
                  styles.emptyActionBtn,
                  {
                    backgroundColor: colors.primary,
                    borderRadius: borderRadius.md,
                  },
                ]}
                onPress={() => setDateFilter('all')}
              >
                <Text style={styles.emptyActionBtnText}>View All Month Expenses</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          /* =========================
             EXPENSE LIST
          ========================== */

          filteredExpenses.map((expense) => {

            const namedMeta = DEFAULT_CATEGORY_METAS[expense.category_name || 'Other'];
            const categoryMeta = namedMeta || {
              ...DEFAULT_CATEGORY_METAS.Other,
              icon: expense.category_icon || 'category',
            };

            const safeAmount = safeNumber(expense.amount);

            return (
              <TouchableOpacity
                key={expense.id}
                style={[
                  styles.expenseItem,
                  {
                    backgroundColor: colors.card,
                    borderRadius: borderRadius.md,
                    borderColor: colors.border,
                    borderLeftColor: categoryMeta.color,
                    ...shadows.sm,
                  },
                ]}
                onPress={() =>
                  router.push(`/(personal)/expense/${expense.id}`)
                }
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.categoryIconCircle,
                    {
                      backgroundColor: categoryMeta.bgColor,
                    },
                  ]}
                >
                  <MaterialIcons
                    name={categoryMeta.icon as any}
                    size={22}
                    color={categoryMeta.color}
                  />
                </View>

                <View style={styles.expenseInfo}>
                  <Text
                    style={[
                      styles.expenseCategory,
                      {
                        color: colors.text,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {expense.category_name || 'Expense'}
                  </Text>

                  <Text
                    style={[
                      styles.expenseMeta,
                      {
                        color: colors.textSecondary,
                      },
                    ]}
                  >
                    {formatDate(expense.expense_date)} •{' '}
                    {expense.payment_method}
                  </Text>

                  {expense.subcategory_name ? (
                    <Text style={[styles.expenseDescription, { color: colors.textSecondary }]} numberOfLines={1}>
                      {expense.subcategory_name}
                    </Text>
                  ) : null}

                  {expense.description ? (
                    <Text
                      style={[
                        styles.expenseDescription,
                        {
                          color: colors.textMuted,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {expense.description}
                    </Text>
                  ) : null}
                </View>

                <View style={styles.expenseAmountWrapper}>
                  <Text
                    style={[
                      styles.expenseAmount,
                      {
                        color: categoryMeta.color,
                      },
                    ]}
                  >
                    -{formatPaiseToRupees(safeAmount)}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </Animated.ScrollView>

      {/* =====================================================
          CUSTOM PULL-TO-REFRESH INDICATOR
      ====================================================== */}

      <Animated.View
        style={[
          styles.refreshIndicator,
          {
            backgroundColor: colors.personalAccent,
            ...shadows.md,
          },
          refreshIndicatorStyle,
        ]}
        pointerEvents="none"
      >
        <Animated.View style={refreshSpinnerStyle}>
          <ActivityIndicator size="small" color="#ffffff" />
        </Animated.View>

        <Animated.View style={refreshArrowStyle}>
          <MaterialIcons name="arrow-downward" size={20} color="#ffffff" />
        </Animated.View>
      </Animated.View>

      {/* =====================================================
          FLOATING ACTION BUTTON
      ====================================================== */}

      {monthData.isCurrentMonth && (
        <>
          <View style={styles.fabContainer} pointerEvents="box-none">
            <TouchableOpacity
              style={[
                styles.fabMain,
                {
                  backgroundColor: colors.personalAccent,
                  ...shadows.lg,
                },
              ]}
              onPress={() => router.push('/(personal)/add-expense')}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Add expense"
            >
              <MaterialIcons name="add" size={30} color="#ffffff" />
            </TouchableOpacity>
          </View>

          {undoVisible && undoExpense && (
            <View
              style={[
                styles.undoSnackbar,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  ...shadows.lg,
                },
              ]}
            >
              <View style={styles.undoSnackbarContent}>
                <MaterialIcons
                  name="delete-outline"
                  size={21}
                  color={colors.textSecondary}
                />

                <Text
                  style={[
                    styles.undoSnackbarText,
                    {
                      color: colors.text,
                    },
                  ]}
                >
                  Expense deleted
                </Text>
              </View>

              <TouchableOpacity
                onPress={handleUndo}
                activeOpacity={0.7}
                hitSlop={8}
              >
                <Text
                  style={[
                    styles.undoButtonText,
                    {
                      color: colors.primary,
                    },
                  ]}
                >
                  UNDO
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </>

      )}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  scrollContent: {
    paddingBottom: 110,
  },

  /*
   * ==========================
   * PULL-TO-REFRESH
   * ==========================
   */

  refreshIndicator: {
    position: 'absolute',
    top: 8,
    alignSelf: 'center',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
  },

  /*
   * ==========================
   * HEADER
   * ==========================
   */

  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },

  headerGreeting: {
    fontSize: 13,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
  },

  insightsButton: {
    minHeight: 40,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },

  insightsButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },

  /*
   * ==========================
   * MONTH
   * ==========================
   */

  monthSelector: {
    alignItems: 'center',
    marginBottom: 12,
  },

  monthLabel: {
    fontSize: 16,
    fontWeight: '700',
  },

  monthHint: {
    fontSize: 11,
    marginTop: 3,
  },

  /*
   * ==========================
   * SUMMARY CARD
   * ==========================
   */

  summaryCard: {
    padding: 22,
    marginBottom: 24,
    overflow: 'hidden',
  },

  summaryLabel: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 6,
  },

  summaryAmount: {
    color: '#ffffff',
    marginBottom: 16,
  },

  /*
   * ==========================
   * CATEGORY BREAKDOWN
   * ==========================
   */

  breakdownBar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginBottom: 10,
  },

  breakdownLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 2,
  },

  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  legendText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '500',
  },

  /*
   * ==========================
   * DATE FILTER
   * ==========================
   */

  filterSection: {
    marginTop: 18,
    marginBottom: 10,
  },

  filterChipScroll: {
    gap: 8,
    paddingVertical: 2,
    paddingHorizontal: 2,
  },

  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
  },

  filterChipText: {
    fontSize: 13,
  },
  categoryFilterLabel: { marginTop: 10, marginLeft: 4, marginBottom: 6, fontSize: 10, fontWeight: '700', letterSpacing: 0.7 },
  categoryFilterScroll: { gap: 8, paddingVertical: 2, paddingHorizontal: 2 },
  categoryFilterChip: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, borderWidth: 1 },
  categoryFilterText: { fontSize: 12, fontWeight: '600' },

  dateSelectionCard: {
    marginTop: 10,
    padding: 12,
    borderWidth: 1,
    gap: 10,
  },

  dateSelectionTitle: { fontSize: 14, fontWeight: '700' },
  dateModeRow: { flexDirection: 'row', gap: 8 },
  dateModeButton: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  dateModeText: { fontSize: 13, fontWeight: '600' },
  rangeChoiceRow: { flexDirection: 'row', gap: 8 },
  dateChoiceButton: { minHeight: 48, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, gap: 8 },
  rangeDateChoice: { flex: 1 },
  dateChoiceLabel: { fontSize: 12 },
  dateChoiceValue: { flex: 1, fontSize: 13, fontWeight: '600' },
  dateSelectionActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 16 },
  cancelDateText: { fontSize: 13, fontWeight: '600', padding: 10 },
  applyDateButton: { minWidth: 80, minHeight: 40, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  applyDateText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  activeFilterBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 10,
    borderWidth: 1,
  },

  activeFilterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },

  activeFilterText: {
    fontSize: 12,
  },

  clearFilterButton: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },

  clearFilterText: {
    fontSize: 12,
    fontWeight: '700',
  },

  /*
   * ==========================
   * SECTION
   * ==========================
   */

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginTop: 8,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },

  sectionCountText: {
    fontSize: 13,
    fontWeight: '500',
  },

  /*
   * ==========================
   * EMPTY STATE
   * ==========================
   */

  emptyCard: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },

  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 4,
    textAlign: 'center',
  },

  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 16,
  },

  emptyActionBtn: {
    marginTop: 16,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },

  emptyActionBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },


  /*
   * ==========================
   * EXPENSE ITEM
   * ==========================
   */

  expenseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderLeftWidth: 3,
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

  expenseAmountWrapper: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },

  expenseAmount: {
    fontSize: 16,
    fontWeight: '700',
  },

  /*
   * ==========================
   * FAB
   * ==========================
   */

  fabContainer: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    alignItems: 'flex-end',
    zIndex: 30,
  },

  fabMain: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
  },

  undoSnackbar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 96,
    minHeight: 58,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 100,
    elevation: 10,
  },

  undoSnackbarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },

  undoSnackbarText: {
    fontSize: 14,
    fontWeight: '600',
  },

  undoButtonText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
});
