import { useCallback, useState } from 'react';
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Stack, router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import CategoryIcon from '../../components/CategoryIcon';
import { useTheme } from '../../hooks/useTheme';
import { CategoryBudgetProgress, listCategoryBudgetProgress, saveCategoryBudget } from '../../services/category-budget.service';
import { formatPaiseToRupees, rupeesToPaise } from '../../utils/currency';

export default function CategoryBudgetsScreen() {
  const { colors } = useTheme();
  const [categories, setCategories] = useState<CategoryBudgetProgress[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setCategories(await listCategoryBudgetProgress());
      setError(null);
    } catch (cause) {
      console.error('Could not load category budgets:', cause);
      setError('Could not load category budgets. Please reopen this screen.');
    }
  }, []);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const save = async (categoryId: string, amount: number | null) => {
    if (saving) return;
    setSaving(true);
    try {
      await saveCategoryBudget(categoryId, amount);
      await refresh();
      setEditingId(null);
      setInput('');
    } catch (cause) {
      Alert.alert('Could not save budget', cause instanceof Error ? cause.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const saveInput = (categoryId: string) => {
    try {
      if (!input.trim()) throw new Error('Enter a monthly limit. Use Remove budget to clear it.');
      if (!/^(?:\d+|\d*\.\d{1,2})$/.test(input.trim())) throw new Error('Enter a valid amount with up to two decimal places.');
      const amount = rupeesToPaise(input);
      if (amount <= 0) throw new Error('Enter a budget greater than zero.');
      void save(categoryId, amount);
    } catch (cause) {
      Alert.alert('Invalid budget', cause instanceof Error ? cause.message : 'Enter a valid amount.');
    }
  };

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ title: 'Category Budgets' }} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingBottom: 36, gap: 14 }}>
        <Text style={{ color: colors.textSecondary, lineHeight: 21 }}>
          Set a monthly spending limit for any category. Spending starts fresh each month; your limits stay in place.
        </Text>
        {error && <Text style={{ color: colors.danger }}>{error}</Text>}
        {!error && categories.map((category) => {
          const overBudget = category.budget !== null && category.spent > category.budget;
          const remaining = category.budget === null ? null : category.budget - category.spent;
          const progress = category.budget === null ? 0 : Math.min(100, category.spent / category.budget * 100);
          const editing = editingId === category.id;
          return (
            <View key={category.id} style={{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: 16, gap: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                  <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' }}>
                    <CategoryIcon icon={category.icon} size={21} color={colors.primary} />
                  </View>
                  <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700', flex: 1 }}>{category.name}</Text>
                </View>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={`${category.budget === null ? 'Set' : 'Edit'} ${category.name} budget`}
                  disabled={saving}
                  onPress={() => { setEditingId(editing ? null : category.id); setInput(category.budget === null ? '' : String(category.budget / 100)); }}
                  style={{ paddingVertical: 8, paddingHorizontal: 4 }}
                >
                  <Text style={{ color: colors.primary, fontWeight: '700' }}>{editing ? 'Cancel' : category.budget === null ? 'Set limit' : 'Edit'}</Text>
                </TouchableOpacity>
              </View>
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                {formatPaiseToRupees(category.spent)} spent this month
                {category.budget !== null ? ` of ${formatPaiseToRupees(category.budget)}` : ' · No limit set'}
              </Text>
              {category.budget !== null && <>
                <View style={{ height: 7, backgroundColor: colors.surfaceVariant, borderRadius: 4, overflow: 'hidden' }}>
                  <View style={{ height: 7, width: `${progress}%`, backgroundColor: overBudget ? colors.danger : colors.primary }} />
                </View>
                <Text style={{ color: overBudget ? colors.danger : colors.textSecondary, fontSize: 13, fontWeight: '600' }}>
                  {formatPaiseToRupees(Math.abs(remaining!))} {overBudget ? 'over limit' : 'remaining'}
                </Text>
              </>}
              {editing && <View style={{ gap: 10 }}>
                <TextInput
                  value={input}
                  onChangeText={setInput}
                  keyboardType="decimal-pad"
                  placeholder="Monthly limit in ₹"
                  placeholderTextColor={colors.textMuted}
                  accessibilityLabel={`${category.name} monthly limit in rupees`}
                  style={{ minHeight: 48, color: colors.text, backgroundColor: colors.surfaceVariant, borderRadius: 10, paddingHorizontal: 14 }}
                />
                <TouchableOpacity accessibilityRole="button" disabled={saving} onPress={() => saveInput(category.id)}
                  style={{ minHeight: 48, backgroundColor: colors.primary, borderRadius: 10, alignItems: 'center', justifyContent: 'center', opacity: saving ? 0.65 : 1 }}>
                  <Text style={{ color: colors.textInverse, fontWeight: '700' }}>{saving ? 'Saving…' : 'Save limit'}</Text>
                </TouchableOpacity>
                {category.budget !== null && <TouchableOpacity accessibilityRole="button" disabled={saving} onPress={() => { void save(category.id, null); }}
                  style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: colors.danger, fontWeight: '600' }}>Remove budget</Text>
                </TouchableOpacity>}
              </View>}
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`View ${category.name} budget insights`}
                onPress={() => router.push({ pathname: '/settings/budgets/[categoryId]', params: { categoryId: category.id } })}
                style={{ alignSelf: 'flex-start', minHeight: 38, justifyContent: 'center' }}
              >
                <Text style={{ color: colors.primary, fontWeight: '700' }}>View insights  →</Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
