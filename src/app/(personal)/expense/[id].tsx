import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';

import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';

import { MaterialIcons } from '@expo/vector-icons';

import { useTheme } from '../../../hooks/useTheme';

import {
  personalExpenseRepository,
} from '../../../repositories/personal/expense.repository';

import {
  personalExpenseUndoService,
} from '../../../services/personal-expense-undo.service';

import {
  PersonalExpenseWithCategory,
} from '../../../types/personal';

import {
  formatPaiseToRupees,
} from '../../../utils/currency';

import {
  formatDateTime,
} from '../../../utils/date';

import {
  DEFAULT_CATEGORY_METAS,
} from '../../../constants/categories';

type MaterialIconName =
  React.ComponentProps<
    typeof MaterialIcons
  >['name'];

const FALLBACK_CATEGORY = 'Other';

export default function ExpenseDetailScreen() {
  const { id } =
    useLocalSearchParams<{ id: string }>();

  const {
    colors,
    spacing,
    borderRadius,
    shadows,
  } = useTheme();

  const router = useRouter();

  const [
    expense,
    setExpense,
  ] =
    useState<PersonalExpenseWithCategory | null>(
      null,
    );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState<string | null>(null);

  const [
    deleting,
    setDeleting,
  ] = useState(false);

  /*
   * Load expense.
   */


useFocusEffect(
  useCallback(() => {
    let cancelled = false;

    (async () => {
      if (!id) return;
      try {
        const item = await personalExpenseRepository.getById(id);
        if (!cancelled) {
          setExpense(item);
          setError(null);
        }
      } catch (err) {
        console.error('Refresh failed:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]),
);

  /*
   * Edit.
   */
const handleEdit = () => {
  if (!id || !expense) return;
  router.push(`/(personal)/add-expense?id=${id}`);
};

  /*
   * Delete confirmation.
   */
  const handleDeletePress = () => {
    if (!expense || deleting) {
      return;
    }

    Alert.alert(
      'Delete Expense',
      'Are you sure you want to delete this expense record?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: performDelete,
        },
      ],
    );
  };

  /*
   * Delete expense.
   *
   * The database deletion happens immediately.
   * The deleted record is stored in the Undo service.
   */
  const performDelete = async () => {
    if (!expense || deleting) {
      return;
    }

    setDeleting(true);

    try {
      const deletedExpense =
        await personalExpenseRepository.delete(
          expense.id,
        );

      if (!deletedExpense) {
        throw new Error(
          'Expense could not be found.',
        );
      }

      /*
       * Store deleted expense so PersonalScreen
       * can show the Undo snackbar.
       */
      personalExpenseUndoService.setPendingExpense(
        deletedExpense,
      );

      setDeleting(false);

      /*
       * Go back immediately.
       */
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace(
          '/(tabs)/personal',
        );
      }
    } catch (err) {
      console.error(
        'Failed to delete expense:',
        err,
      );

      setDeleting(false);

      Alert.alert(
        'Error',
        'Could not delete expense.',
      );
    }
  };

  /*
   * Loading state.
   */
  if (loading) {
    return (
      <View
        style={[
          styles.centerContainer,
          {
            backgroundColor:
              colors.background,
          },
        ]}
      >
        <ActivityIndicator
          size="large"
          color={colors.primary}
        />
      </View>
    );
  }

  /*
   * Error state.
   */
  if (error) {
    return (
      <View
        style={[
          styles.centerContainer,
          {
            backgroundColor:
              colors.background,
            padding: spacing.base,
          },
        ]}
      >
        <MaterialIcons
          name="error-outline"
          size={40}
          color={colors.textSecondary}
        />

        <Text
          style={[
            styles.stateText,
            {
              color:
                colors.textSecondary,
              marginTop: 12,
            },
          ]}
        >
          {error}
        </Text>

        <TouchableOpacity
          onPress={() =>
            router.replace(
              '/(tabs)/personal',
            )
          }
          style={[
            styles.stateAction,
            {
              backgroundColor:
                colors.card,
              borderColor:
                colors.border,
              borderRadius:
                borderRadius.md,
              marginTop: 20,
            },
          ]}
        >
          <Text
            style={[
              styles.stateActionText,
              {
                color: colors.text,
              },
            ]}
          >
            Back to Expenses
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  /*
   * Expense not found.
   */
  if (!expense) {
    return (
      <View
        style={[
          styles.centerContainer,
          {
            backgroundColor:
              colors.background,
            padding: spacing.base,
          },
        ]}
      >
        <MaterialIcons
          name="receipt-long"
          size={40}
          color={colors.textSecondary}
        />

        <Text
          style={[
            styles.stateText,
            {
              color:
                colors.textSecondary,
              marginTop: 12,
            },
          ]}
        >
          Expense not found.
        </Text>

        <TouchableOpacity
          onPress={() =>
            router.replace(
              '/(tabs)/personal',
            )
          }
          style={[
            styles.stateAction,
            {
              backgroundColor:
                colors.card,
              borderColor:
                colors.border,
              borderRadius:
                borderRadius.md,
              marginTop: 20,
            },
          ]}
        >
          <Text
            style={[
              styles.stateActionText,
              {
                color: colors.text,
              },
            ]}
          >
            Back to Expenses
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const meta =
    DEFAULT_CATEGORY_METAS[
      expense.category_name ||
        FALLBACK_CATEGORY
    ] ||
    DEFAULT_CATEGORY_METAS[
      FALLBACK_CATEGORY
    ];

  const iconName =
    meta.icon as MaterialIconName;

  return (
    <SafeAreaView
      edges={[
        'bottom',
        'left',
        'right',
      ]}
      style={[
        styles.container,
        {
          backgroundColor:
            colors.background,
        },
      ]}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            padding:
              spacing.base,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Main Card */}
        <View
          style={[
            styles.card,
            {
              backgroundColor:
                colors.card,
              borderColor:
                colors.border,
              borderRadius:
                borderRadius.lg,
              ...shadows.md,
            },
          ]}
        >
          <View
            style={[
              styles.iconCircle,
              {
                backgroundColor:
                  meta.bgColor,
              },
            ]}
          >
            <MaterialIcons
              name={iconName}
              size={36}
              color={meta.color}
            />
          </View>

          <Text
            style={[
              styles.categoryName,
              {
                color:
                  colors.textSecondary,
              },
            ]}
          >
            {expense.category_name ||
              'Expense'}
          </Text>

          <Text
            style={[
              styles.amountText,
              {
                color: colors.text,
              },
            ]}
          >
            {formatPaiseToRupees(
              expense.amount,
            )}
          </Text>

          <View
            style={[
              styles.detailsTable,
              {
                borderTopColor:
                  colors.border,
              },
            ]}
          >
            <View
              style={styles.detailRow}
            >
              <Text
                style={[
                  styles.detailLabel,
                  {
                    color:
                      colors.textSecondary,
                  },
                ]}
              >
                Payment Method
              </Text>

              <Text
                style={[
                  styles.detailValue,
                  {
                    color:
                      colors.text,
                  },
                ]}
              >
                {expense.payment_method}
              </Text>
            </View>

            <View
              style={styles.detailRow}
            >
              <Text
                style={[
                  styles.detailLabel,
                  {
                    color:
                      colors.textSecondary,
                  },
                ]}
              >
                Date & Time
              </Text>

              <Text
                style={[
                  styles.detailValue,
                  {
                    color:
                      colors.text,
                  },
                ]}
              >
                {formatDateTime(
                  expense.expense_date,
                )}
              </Text>
            </View>

            {expense.description ? (
              <View
                style={styles.detailRow}
              >
                <Text
                  style={[
                    styles.detailLabel,
                    {
                      color:
                        colors.textSecondary,
                    },
                  ]}
                >
                  Description
                </Text>

                <Text
                  style={[
                    styles.detailValue,
                    {
                      color:
                        colors.text,
                    },
                  ]}
                >
                  {expense.description}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Actions */}
        <View
          style={styles.actionsRow}
        >
          <TouchableOpacity
            style={[
              styles.actionBtn,
              {
                backgroundColor:
                  colors.card,
                borderColor:
                  colors.border,
                borderRadius:
                  borderRadius.md,
              },
            ]}
            onPress={handleEdit}
            activeOpacity={0.8}
            disabled={deleting}
          >
            <MaterialIcons
              name="edit"
              size={20}
              color={colors.text}
            />

            <Text
              style={[
                styles.actionBtnText,
                {
                  color:
                    colors.text,
                },
              ]}
            >
              Edit
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionBtn,
              {
                backgroundColor:
                  colors.dangerBackground,
                borderColor:
                  'transparent',
                borderRadius:
                  borderRadius.md,
                opacity:
                  deleting ? 0.7 : 1,
              },
            ]}
            onPress={
              handleDeletePress
            }
            activeOpacity={0.8}
            disabled={deleting}
          >
            {deleting ? (
              <ActivityIndicator
                size="small"
                color={colors.danger}
              />
            ) : (
              <MaterialIcons
                name="delete-outline"
                size={20}
                color={colors.danger}
              />
            )}

            <Text
              style={[
                styles.actionBtnText,
                {
                  color:
                    colors.danger,
                },
              ]}
            >
              {deleting
                ? 'Deleting…'
                : 'Delete'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  stateText: {
    fontSize: 15,
    textAlign: 'center',
  },

  stateAction: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderWidth: 1,
  },

  stateActionText: {
    fontSize: 14,
    fontWeight: '600',
  },

  scrollContent: {
    paddingBottom: 32,
  },

  card: {
    alignItems: 'center',
    padding: 24,
    borderWidth: 1,
    marginBottom: 20,
  },

  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },

  categoryName: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },

  amountText: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 24,
  },

  detailsTable: {
    width: '100%',
    borderTopWidth: 1,
    paddingTop: 16,
    gap: 14,
  },

  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  detailLabel: {
    fontSize: 13,
  },

  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    maxWidth: '65%',
    textAlign: 'right',
  },

  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },

  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
    borderWidth: 1,
  },

  actionBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
});