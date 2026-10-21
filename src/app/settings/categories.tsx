import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';
import { categoryRepository } from '../../repositories/personal/category.repository';
import { Category, Subcategory } from '../../types/personal';
import { DEFAULT_CATEGORY_METAS } from '../../constants/categories';
import CategoryIcon from '../../components/CategoryIcon';
import { isEmojiIcon, nextEmojiIcon } from '../../utils/category-icon';

export default function CategoriesSettingsScreen() {
  const { colors, spacing, borderRadius } = useTheme();
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedIcon, setSelectedIcon] = useState('');
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [subcategoryName, setSubcategoryName] = useState('');

  const loadCategories = useCallback(async () => {
    setCategories(await categoryRepository.getAll());
  }, []);

  useFocusEffect(useCallback(() => { loadCategories(); }, [loadCategories]));

  const addCategory = async () => {
    const cleanName = name.trim().replace(/\s+/g, ' ');
    if (!cleanName) {
      Alert.alert('Category name required', 'Enter a name for this category.');
      return;
    }
    if (!isEmojiIcon(selectedIcon)) {
      Alert.alert('Choose one emoji', 'Use your keyboard’s emoji picker to enter a single emoji for this category.');
      return;
    }
    if (categories.some((category) => category.name.toLocaleLowerCase() === cleanName.toLocaleLowerCase())) {
      Alert.alert('Already exists', 'A category with this name already exists.');
      return;
    }

    setSaving(true);
    try {
      await categoryRepository.create({ name: cleanName, icon: selectedIcon });
      setName('');
      setSelectedIcon('');
      await loadCategories();
    } catch (error) {
      console.error('Could not add category:', error);
      Alert.alert('Could not add category', 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const removeCategory = (category: Category) => {
    Alert.alert('Delete category?', `Delete “${category.name}”?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await categoryRepository.delete(category.id);
            await loadCategories();
          } catch {
            Alert.alert('Category in use', 'This category has expenses. Reassign or delete those expenses before removing it.');
          }
        },
      },
    ]);
  };

  const toggleSubcategories = async (categoryId: string) => {
    if (expandedCategoryId === categoryId) {
      setExpandedCategoryId(null);
      return;
    }
    setExpandedCategoryId(categoryId);
    setSubcategoryName('');
    setSubcategories(await categoryRepository.getSubcategories(categoryId));
  };

  const addSubcategory = async (categoryId: string) => {
    const cleanName = subcategoryName.trim().replace(/\s+/g, ' ');
    if (!cleanName) return;
    if (subcategories.some((item) => item.name.toLocaleLowerCase() === cleanName.toLocaleLowerCase())) {
      Alert.alert('Already exists', 'This subcategory already exists for the selected category.');
      return;
    }
    try {
      await categoryRepository.createSubcategory({ category_id: categoryId, name: cleanName });
      setSubcategoryName('');
      setSubcategories(await categoryRepository.getSubcategories(categoryId));
    } catch (error) {
      console.error('Could not add subcategory:', error);
      Alert.alert('Could not add subcategory', 'Please try again.');
    }
  };

  const removeSubcategory = (subcategory: Subcategory) => {
    Alert.alert('Delete subcategory?', `Delete “${subcategory.name}”? Existing expenses will keep their category and lose this subcategory.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await categoryRepository.deleteSubcategory(subcategory.id);
        if (expandedCategoryId) setSubcategories(await categoryRepository.getSubcategories(expandedCategoryId));
      } },
    ]);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.base, gap: 18 }}>
        <Text style={[styles.description, { color: colors.textSecondary }]}>Create categories for your personal expenses. Frequently used categories move to the front of the expense form automatically.</Text>
        <View style={[styles.addCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: borderRadius.lg }]}>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Category name"
            placeholderTextColor={colors.textMuted}
            maxLength={32}
            returnKeyType="next"
            style={[styles.input, { color: colors.text, borderColor: colors.border, borderRadius: borderRadius.md }]}
          />
          <Text style={[styles.subcategoryHeading, { color: colors.textSecondary }]}>CATEGORY EMOJI</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TextInput
              value={selectedIcon}
              onChangeText={(value) => setSelectedIcon((current) => nextEmojiIcon(current, value))}
              placeholder="🙂"
              placeholderTextColor={colors.textMuted}
              maxLength={24}
              autoCorrect={false}
              accessibilityLabel="Category emoji"
              style={[styles.emojiInput, { color: colors.text, borderColor: colors.border, borderRadius: borderRadius.md }]}
            />
            <Text style={{ flex: 1, color: colors.textSecondary, fontSize: 13, lineHeight: 19 }}>
              Tap the field and choose one emoji from your keyboard.
            </Text>
          </View>
          <TouchableOpacity onPress={addCategory} disabled={saving} style={[styles.addButton, { backgroundColor: colors.primary, borderRadius: borderRadius.md, opacity: saving ? 0.6 : 1 }]}>
            <MaterialIcons name="add" size={20} color="#fff" />
            <Text style={styles.addButtonText}>{saving ? 'Adding…' : 'Add category'}</Text>
          </TouchableOpacity>
        </View>
        <View style={[styles.list, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: borderRadius.lg }]}>
          {categories.map((category, index) => (
            <View key={category.id}>
            <View style={[styles.row, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider }]}>
              <View style={[styles.categoryIcon, { backgroundColor: colors.primaryLight }]}>
                <CategoryIcon
                  icon={(category.is_default === 1 ? DEFAULT_CATEGORY_METAS[category.name]?.icon : category.icon) || 'category'}
                  size={18}
                  color={colors.primary}
                />
              </View>
              <Text style={[styles.categoryName, { color: colors.text }]}>{category.name}</Text>
              <TouchableOpacity accessibilityRole="button" onPress={() => toggleSubcategories(category.id)} hitSlop={8}>
                <MaterialIcons name={expandedCategoryId === category.id ? 'expand-less' : 'tune'} size={22} color={colors.primary} />
              </TouchableOpacity>
              {category.is_default === 1 ? <Text style={[styles.defaultLabel, { color: colors.textMuted }]}>Default</Text> : (
                <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Delete ${category.name}`} onPress={() => removeCategory(category)} hitSlop={8}>
                  <MaterialIcons name="delete-outline" size={22} color={colors.danger} />
                </TouchableOpacity>
              )}
            </View>
            {expandedCategoryId === category.id && (
              <View style={[styles.subcategoryPanel, { borderTopColor: colors.divider }]}>
                <Text style={[styles.subcategoryHeading, { color: colors.textSecondary }]}>SUBCATEGORIES</Text>
                {subcategories.map((subcategory) => (
                  <View key={subcategory.id} style={styles.subcategoryRow}>
                    <Text style={[styles.subcategoryName, { color: colors.text }]}>{subcategory.name}</Text>
                    {subcategory.is_default === 1 ? <Text style={[styles.defaultLabel, { color: colors.textMuted }]}>Default</Text> : (
                      <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Delete ${subcategory.name}`} onPress={() => removeSubcategory(subcategory)} hitSlop={8}>
                        <MaterialIcons name="close" size={20} color={colors.danger} />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
                <View style={styles.subcategoryAddRow}>
                  <TextInput
                    value={expandedCategoryId === category.id ? subcategoryName : ''}
                    onChangeText={setSubcategoryName}
                    placeholder="Add a subcategory"
                    placeholderTextColor={colors.textMuted}
                    maxLength={32}
                    onSubmitEditing={() => addSubcategory(category.id)}
                    style={[styles.subcategoryInput, { color: colors.text, borderColor: colors.border, borderRadius: borderRadius.md }]}
                  />
                  <TouchableOpacity onPress={() => addSubcategory(category.id)} style={[styles.subcategoryAddButton, { backgroundColor: colors.primary, borderRadius: borderRadius.md }]}>
                    <MaterialIcons name="add" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            )}
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  description: { fontSize: 14, lineHeight: 20 },
  addCard: { padding: 14, borderWidth: 1, gap: 10 },
  input: { height: 48, borderWidth: 1, paddingHorizontal: 12, fontSize: 15 },
  addButton: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  addButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  emojiInput: { width: 64, height: 56, borderWidth: 1, fontSize: 28, textAlign: 'center' },
  list: { borderWidth: 1, overflow: 'hidden' },
  row: { minHeight: 58, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 12 },
  categoryIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  categoryName: { flex: 1, fontSize: 15, fontWeight: '600' },
  defaultLabel: { fontSize: 12 },
  subcategoryPanel: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 12, gap: 8 },
  subcategoryHeading: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6 },
  subcategoryRow: { minHeight: 34, flexDirection: 'row', alignItems: 'center' },
  subcategoryName: { flex: 1, fontSize: 14 },
  subcategoryAddRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  subcategoryInput: { flex: 1, height: 42, borderWidth: 1, paddingHorizontal: 10, fontSize: 14 },
  subcategoryAddButton: { width: 42, alignItems: 'center', justifyContent: 'center' },
});
