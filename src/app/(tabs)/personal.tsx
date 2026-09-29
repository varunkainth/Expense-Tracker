import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
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
import { personalExpenseRepository } from '../../repositories/personal/expense.repository';
import { PersonalExpenseWithCategory } from '../../types/personal';
import { formatPaiseToRupees } from '../../utils/currency';
import { formatDate } from '../../utils/date';

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
  const { colors, spacing, borderRadius, shadows, typography } = useTheme();
  const router = useRouter();

  /*
   * ==============================
   * EXPENSE STATE
   * ==============================
   */

  const [expenses, setExpenses] = useState<PersonalExpenseWithCategory[]>([]);
  const [monthTotalPaise, setMonthTotalPaise] = useState<number>(0);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [undoExpense, setUndoExpense] =
    useState<PersonalExpenseWithCategory | null>(null);
  const [undoVisible, setUndoVisible] = useState(false);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
   * MONTH CARD ANIMATION
   * ==============================
   */

  const translateX = useSharedValue(0);
  const cardOpacity = useSharedValue(1);
  const isAnimating = useSharedValue(false);

  /*
   * ==============================
   * FAB STATE
   * ==============================
   */

  const [fabOpen, setFabOpen] = useState(false);

  const fabRotation = useSharedValue(0);
  const fabBackdropOpacity = useSharedValue(0);
  const fabActionsOpacity = useSharedValue(0);
  const quickAddTranslateY = useSharedValue(20);
  const addExpenseTranslateY = useSharedValue(20);

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

  const loadData = useCallback(async (month: MonthData) => {
    try {
      const startOfMonth = safeNumber(month.startOfMonth);
      const endOfMonth = safeNumber(month.endOfMonth);

      const [monthExpenses, total] = await Promise.all([
        personalExpenseRepository.getAll({
          startDate: startOfMonth,
          endDate: endOfMonth,
        }),
        personalExpenseRepository.getTotalExpenses(startOfMonth, endOfMonth),
      ]);

      /*
       * Empty month is valid.
       *
       * Example:
       *
       * August 2026
       * expenses = []
       * total = 0
       */

      const safeExpenses = Array.isArray(monthExpenses)
        ? monthExpenses.slice(0, 10).map((expense) => ({
          ...expense,
          amount: safeNumber(expense.amount),
        }))
        : [];

      setExpenses(safeExpenses);
      setMonthTotalPaise(safeNumber(total));
    } catch (error) {
      console.error('Error loading personal expenses:', error);

      setExpenses([]);
      setMonthTotalPaise(0);
    }
  }, []);

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
      await loadData(monthData);
    } catch (error) {
      console.error('Failed to undo expense deletion:', error);

      // Keep the snackbar visible if restore failed.
      setUndoExpense(expenseToRestore);
      setUndoVisible(true);
    }
  }, [undoExpense, clearUndoTimer, loadData, monthData]);

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
    loadData(monthData);
  }, [monthData, loadData]);

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
   * - Quick Add
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
       * This makes newly added expenses
       * appear automatically when we come
       * back from Add Expense / Quick Add.
       */
      const currentMonth = getMonthData(0);

      loadData(currentMonth);

      /*
       * Close FAB whenever screen becomes active.
       */
      setFabOpen(false);

      fabRotation.value = 0;
      fabBackdropOpacity.value = 0;
      fabActionsOpacity.value = 0;
      quickAddTranslateY.value = 20;
      addExpenseTranslateY.value = 20;
    }, [
      loadData,
      translateX,
      cardOpacity,
      isAnimating,
      fabRotation,
      fabBackdropOpacity,
      fabActionsOpacity,
      quickAddTranslateY,
      addExpenseTranslateY,
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
      await loadData(monthData);
    } finally {
      setRefreshing(false);
    }
  }, [loadData, monthData]);

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
   * FAB TOGGLE
   * ==============================
   */

  const toggleFab = useCallback(() => {
    const nextOpen = !fabOpen;

    setFabOpen(nextOpen);

    if (nextOpen) {
      /*
       * Rotate + to x.
       */

      fabRotation.value = withSpring(1, {
        damping: 14,
        stiffness: 180,
      });

      /*
       * Dark background.
       */

      fabBackdropOpacity.value = withTiming(1, {
        duration: 180,
      });

      /*
       * Actions appear.
       */

      fabActionsOpacity.value = withTiming(1, {
        duration: 150,
      });

      /*
       * Add Expense appears first.
       */

      addExpenseTranslateY.value = withSpring(0, {
        damping: 15,
        stiffness: 180,
      });

      /*
       * Quick Add appears
       * slightly after it.
       */

      quickAddTranslateY.value = withSpring(0, {
        damping: 15,
        stiffness: 180,
      });
    } else {
      /*
       * Close FAB.
       */

      fabRotation.value = withSpring(0, {
        damping: 14,
        stiffness: 180,
      });

      fabBackdropOpacity.value = withTiming(0, {
        duration: 140,
      });

      fabActionsOpacity.value = withTiming(0, {
        duration: 100,
      });

      quickAddTranslateY.value = withTiming(20, {
        duration: 120,
      });

      addExpenseTranslateY.value = withTiming(20, {
        duration: 120,
      });
    }
  }, [
    fabOpen,
    fabRotation,
    fabBackdropOpacity,
    fabActionsOpacity,
    quickAddTranslateY,
    addExpenseTranslateY,
  ]);

  /*
   * ==============================
   * FAB ANIMATION STYLES
   * ==============================
   */

  const fabMainAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        rotate: `${fabRotation.value * 45}deg`,
      },
    ],
  }));

  const fabBackdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: fabBackdropOpacity.value,
  }));

  const quickAddAnimatedStyle = useAnimatedStyle(() => ({
    opacity: fabActionsOpacity.value,
    transform: [
      {
        translateY: quickAddTranslateY.value,
      },
    ],
  }));

  const addExpenseAnimatedStyle = useAnimatedStyle(() => ({
    opacity: fabActionsOpacity.value,
    transform: [
      {
        translateY: addExpenseTranslateY.value,
      },
    ],
  }));

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
            style={[
              styles.historyBtn,
              {
                backgroundColor: colors.surfaceVariant,
                borderRadius: borderRadius.full,
              },
            ]}
            onPress={() => router.push('/(personal)/history')}
            activeOpacity={0.7}
          >
            <MaterialIcons name="history" size={22} color={colors.text} />
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
            {monthData.isCurrentMonth
              ? 'Recent Expenses'
              : `${monthData.label} Expenses`}
          </Text>

          {expenses.length > 0 && (
            <TouchableOpacity
              onPress={() => router.push('/(personal)/history')}
            >
              <Text
                style={[
                  styles.seeAllText,
                  {
                    color: colors.primary,
                  },
                ]}
              >
                View All
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* =========================
            EMPTY STATE
        ========================== */}

        {expenses.length === 0 ? (
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
              {monthData.isCurrentMonth
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
              {monthData.isCurrentMonth
                ? 'Tap the + button to record your first expense.'
                : 'There are no recorded expenses for this month. Swipe left to check an older month.'}
            </Text>
          </View>
        ) : (
          /* =========================
             EXPENSE LIST
          ========================== */

          expenses.map((expense) => {
            const categoryMeta =
              DEFAULT_CATEGORY_METAS[expense.category_name || 'Other'] ||
              DEFAULT_CATEGORY_METAS.Other;

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
          {/* BACKDROP */}

          <Animated.View
            style={[styles.fabBackdrop, fabBackdropAnimatedStyle]}
            pointerEvents={fabOpen ? 'auto' : 'none'}
          >
            <TouchableOpacity
              style={styles.fabBackdropTouch}
              activeOpacity={1}
              onPress={() => {
                if (fabOpen) {
                  toggleFab();
                }
              }}
            />
          </Animated.View>

          {/* FAB CONTAINER */}

          <View style={styles.fabContainer} pointerEvents="box-none">
            {/* QUICK ADD */}

            <Animated.View
              style={[styles.fabActionWrapper, quickAddAnimatedStyle]}
              pointerEvents={fabOpen ? 'auto' : 'none'}
            >
              <View
                style={[
                  styles.fabActionLabel,
                  {
                    backgroundColor: colors.card,
                    ...shadows.sm,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.fabActionLabelText,
                    {
                      color: colors.text,
                    },
                  ]}
                >
                  Quick Add
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.fabSmall,
                  {
                    backgroundColor: '#ffffff',
                    ...shadows.md,
                  },
                ]}
                onPress={() => {
                  setFabOpen(false);

                  fabRotation.value = withSpring(0);
                  fabBackdropOpacity.value = withTiming(0);
                  fabActionsOpacity.value = withTiming(0);

                  router.push('/(personal)/quick-add');
                }}
                activeOpacity={0.8}
              >
                <MaterialIcons name="bolt" size={23} color="#4f46e5" />
              </TouchableOpacity>
            </Animated.View>

            {/* ADD EXPENSE */}

            <Animated.View
              style={[styles.fabActionWrapper, addExpenseAnimatedStyle]}
              pointerEvents={fabOpen ? 'auto' : 'none'}
            >
              <View
                style={[
                  styles.fabActionLabel,
                  {
                    backgroundColor: colors.card,
                    ...shadows.sm,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.fabActionLabelText,
                    {
                      color: colors.text,
                    },
                  ]}
                >
                  Add Expense
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.fabSmall,
                  {
                    backgroundColor: colors.personalAccent,
                    ...shadows.md,
                  },
                ]}
                onPress={() => {
                  setFabOpen(false);

                  fabRotation.value = withSpring(0);
                  fabBackdropOpacity.value = withTiming(0);
                  fabActionsOpacity.value = withTiming(0);

                  router.push('/(personal)/add-expense');
                }}
                activeOpacity={0.8}
              >
                <MaterialIcons name="add" size={25} color="#ffffff" />
              </TouchableOpacity>
            </Animated.View>

            {/* MAIN FAB */}

            <Animated.View style={fabMainAnimatedStyle}>
              <TouchableOpacity
                style={[
                  styles.fabMain,
                  {
                    backgroundColor: colors.personalAccent,
                    ...shadows.lg,
                  },
                ]}
                onPress={toggleFab}
                activeOpacity={0.85}
              >
                <MaterialIcons name="add" size={30} color="#ffffff" />
              </TouchableOpacity>
            </Animated.View>
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

  historyBtn: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
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
   * SECTION
   * ==========================
   */

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    marginTop: 4,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },

  seeAllText: {
    fontSize: 14,
    fontWeight: '600',
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
   * FAB BACKDROP
   * ==========================
   */

  fabBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
    zIndex: 20,
  },

  fabBackdropTouch: {
    flex: 1,
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

  fabSmall: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },

  fabActionWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 10,
  },

  fabActionLabel: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 10,
  },

  fabActionLabelText: {
    fontSize: 13,
    fontWeight: '600',
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