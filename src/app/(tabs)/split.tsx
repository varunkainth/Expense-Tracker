import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '../../hooks/useTheme';
import { useTabBackBehavior } from '../../hooks/useTabBackBehavior';
import { splitExpenseRepository } from '../../repositories/split-expense.repository';
import { SplitExpense, SplitGroup, SplitPerson } from '../../types/split-expenses';
import { formatPaiseToRupees, rupeesToPaise } from '../../utils/currency';
import { calculateSettlements } from '../../utils/split-settlement';

const MAX_PEOPLE = 12;

type SplitEditTarget =
  | { kind: 'group' }
  | { kind: 'person'; personId: string }
  | { kind: 'expense'; expenseId: string };

export default function SplitExpensesScreen() {
  const navigation = useNavigation<{
    addListener: (event: 'tabPress', listener: () => void) => () => void;
  }>();
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const [groups, setGroups] = useState<SplitGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<SplitGroup | null>(null);
  const [people, setPeople] = useState<SplitPerson[]>([]);
  const [expenses, setExpenses] = useState<SplitExpense[]>([]);
  const [createGroupVisible, setCreateGroupVisible] = useState(false);
  const [addExpenseVisible, setAddExpenseVisible] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [editTarget, setEditTarget] = useState<SplitEditTarget | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPayerId, setEditPayerId] = useState('');
  const [groupName, setGroupName] = useState('');
  const [peopleCount, setPeopleCount] = useState(2);
  const [personNames, setPersonNames] = useState(['', '']);
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDescription, setExpenseDescription] = useState('');
  const [payerId, setPayerId] = useState('');
  const [busy, setBusy] = useState(false);
  const expenseAmountInputRef = useRef<TextInput>(null);
  const [expenseSheetTranslateY] = useState(() => new Animated.Value(0));
  const [expenseSheetPan] = useState(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) =>
      gesture.dy > 4 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onPanResponderMove: (_event, gesture) => {
      expenseSheetTranslateY.setValue(Math.max(0, gesture.dy));
    },
    onPanResponderRelease: (_event, gesture) => {
      if (gesture.dy > 110 || gesture.vy > 1.1) {
        Animated.timing(expenseSheetTranslateY, {
          toValue: 520,
          duration: 190,
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (finished) {
            expenseSheetTranslateY.setValue(0);
            setAddExpenseVisible(false);
          }
        });
      } else {
        Animated.spring(expenseSheetTranslateY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 22,
          stiffness: 220,
        }).start();
      }
    },
    onPanResponderTerminate: () => {
      Animated.spring(expenseSheetTranslateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 22,
        stiffness: 220,
      }).start();
    },
  }));

  const refreshGroups = useCallback(async () => {
    const rows = await splitExpenseRepository.getGroups();
    setGroups(rows);
  }, []);

  const refreshSelectedGroup = useCallback(async () => {
    if (!selectedGroup) return;
    const [nextPeople, nextExpenses] = await Promise.all([
      splitExpenseRepository.getPeople(selectedGroup.id),
      splitExpenseRepository.getExpenses(selectedGroup.id),
    ]);
    setPeople(nextPeople);
    setExpenses(nextExpenses);
  }, [selectedGroup]);

  useFocusEffect(useCallback(() => {
    refreshGroups().catch((error) => console.error('Could not load split groups:', error));
  }, [refreshGroups]));

  useFocusEffect(useCallback(() => {
    refreshSelectedGroup().catch((error) => console.error('Could not load split details:', error));
  }, [refreshSelectedGroup]));

  const settlements = useMemo(() => calculateSettlements(people, expenses), [people, expenses]);
  const totalSpend = useMemo(() => expenses.reduce((sum, expense) => sum + expense.amount, 0), [expenses]);

  const updatePeopleCount = (count: number) => {
    const next = Math.max(2, Math.min(MAX_PEOPLE, count));
    setPeopleCount(next);
    setPersonNames((current) => Array.from({ length: next }, (_, index) => current[index] ?? ''));
  };

  const openGroup = (group: SplitGroup) => {
    setSelectedGroup(group);
    setPeople([]);
    setExpenses([]);
  };

  const backToGroups = useCallback(() => {
    setSelectedGroup(null);
    setPeople([]);
    setExpenses([]);
  }, []);

  useTabBackBehavior(selectedGroup ? backToGroups : undefined);

  useEffect(() => {
    const unsubscribe = navigation.addListener('tabPress', () => {
      if (selectedGroup) backToGroups();
    });
    return unsubscribe;
  }, [backToGroups, navigation, selectedGroup]);

  const editGroupName = () => {
    if (!selectedGroup) return;
    setEditTarget({ kind: 'group' });
    setEditValue(selectedGroup.name);
    setEditVisible(true);
  };

  const editPersonName = (person: SplitPerson) => {
    setEditTarget({ kind: 'person', personId: person.id });
    setEditValue(person.name);
    setEditVisible(true);
  };

  const editExpense = (expense: SplitExpense) => {
    setEditTarget({ kind: 'expense', expenseId: expense.id });
    setEditAmount(String(expense.amount / 100));
    setEditDescription(expense.description ?? '');
    setEditPayerId(expense.paid_by_person_id);
    setEditVisible(true);
  };

  const saveEdit = async () => {
    if (!selectedGroup || !editTarget) return;
    try {
      setBusy(true);
      if (editTarget.kind === 'group') {
        const name = editValue.trim().replace(/\s+/g, ' ');
        if (!name) throw new Error('Enter a group name.');
        await splitExpenseRepository.renameGroup(selectedGroup.id, name);
        setSelectedGroup({ ...selectedGroup, name });
        await refreshGroups();
      } else if (editTarget.kind === 'person') {
        await splitExpenseRepository.renamePerson(selectedGroup.id, editTarget.personId, editValue);
        await refreshSelectedGroup();
      } else {
        await splitExpenseRepository.updateExpense(
          selectedGroup.id,
          editTarget.expenseId,
          editPayerId,
          rupeesToPaise(editAmount),
          editDescription,
        );
        await Promise.all([refreshSelectedGroup(), refreshGroups()]);
      }
      setEditVisible(false);
      setEditTarget(null);
    } catch (error) {
      Alert.alert('Could not save changes', error instanceof Error ? error.message : 'Please check the details and try again.');
    } finally {
      setBusy(false);
    }
  };

  const editTitle = editTarget?.kind === 'group'
    ? 'Rename group'
    : editTarget?.kind === 'person'
      ? 'Edit person'
      : 'Edit expense';

  const createGroup = async () => {
    setBusy(true);
    try {
      const groupId = await splitExpenseRepository.createGroup(groupName, personNames);
      setCreateGroupVisible(false);
      setGroupName('');
      setPeopleCount(2);
      setPersonNames(['', '']);
      const rows = await splitExpenseRepository.getGroups();
      setGroups(rows);
      const created = rows.find((row) => row.id === groupId);
      if (created) openGroup(created);
    } catch (error) {
      Alert.alert('Could not create group', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const showAddExpense = () => {
    if (people.length < 2) return;
    expenseSheetTranslateY.setValue(0);
    setExpenseAmount('');
    setExpenseDescription('');
    setPayerId(people[0].id);
    setAddExpenseVisible(true);
  };

  const addExpense = async () => {
    if (!selectedGroup || !payerId) return;
    try {
      const amount = rupeesToPaise(expenseAmount);
      if (amount <= 0) throw new Error('Enter an amount greater than zero.');
      setBusy(true);
      await splitExpenseRepository.addExpense(selectedGroup.id, payerId, amount, expenseDescription);
      setAddExpenseVisible(false);
      await Promise.all([refreshSelectedGroup(), refreshGroups()]);
    } catch (error) {
      Alert.alert('Could not add expense', error instanceof Error ? error.message : 'Enter a valid amount.');
    } finally {
      setBusy(false);
    }
  };

  const deleteGroup = (group: SplitGroup) => {
    Alert.alert('Delete group?', `“${group.name}” and all its expenses will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await splitExpenseRepository.deleteGroup(group.id);
        if (selectedGroup?.id === group.id) backToGroups();
        await refreshGroups();
      } },
    ]);
  };

  const deleteExpense = (expense: SplitExpense) => {
    Alert.alert('Delete expense?', `Remove ${formatPaiseToRupees(expense.amount)} from this group?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await splitExpenseRepository.deleteExpense(expense.id);
        await Promise.all([refreshSelectedGroup(), refreshGroups()]);
      } },
    ]);
  };

  const inputStyle = [styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceVariant, borderRadius: borderRadius.md }];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { paddingHorizontal: spacing.lg }]}>
        {selectedGroup ? (
          <TouchableOpacity style={styles.backButton} onPress={backToGroups} accessibilityRole="button" accessibilityLabel="Back to groups">
            <MaterialIcons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
        ) : null}
        <View style={styles.headerTitles}>
          <Text style={[styles.title, { color: colors.text }]}>{selectedGroup?.name ?? 'Split expenses'}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {selectedGroup ? `${people.length} people · ${expenses.length} expenses` : 'Keep shared spending fair and clear'}
          </Text>
        </View>
        {selectedGroup ? (
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={editGroupName} hitSlop={10} accessibilityRole="button" accessibilityLabel="Rename group">
              <MaterialIcons name="edit" size={21} color={colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => deleteGroup(selectedGroup)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Delete group">
              <MaterialIcons name="delete-outline" size={23} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      {selectedGroup ? (
        <ScrollView contentContainerStyle={[styles.content, { padding: spacing.lg, paddingBottom: 112 }]} keyboardShouldPersistTaps="handled">
          <View style={[styles.totalCard, { backgroundColor: colors.primary, borderRadius: borderRadius.lg }, shadows.md]}>
            <View>
              <Text style={styles.totalLabel}>Total shared spending</Text>
              <Text style={styles.totalAmount}>{formatPaiseToRupees(totalSpend)}</Text>
            </View>
            <MaterialIcons name="groups" size={34} color="#ffffff" />
          </View>

          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>People</Text>
          </View>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: borderRadius.lg }]}>
            {people.map((person, index) => (
              <View key={person.id} style={[styles.personRow, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
                <View style={[styles.avatar, { backgroundColor: colors.primaryLight }]}>
                  <Text style={[styles.avatarText, { color: colors.primary }]}>{person.name.trim().charAt(0).toUpperCase()}</Text>
                </View>
                <Text style={[styles.personName, { color: colors.text }]}>{person.name}</Text>
                <View style={styles.paidTotal}>
                  <Text style={[styles.muted, { color: colors.textSecondary }]}>Paid</Text>
                  <Text style={[styles.paidAmount, { color: colors.text }]}>{formatPaiseToRupees(person.total_paid)}</Text>
                </View>
                <TouchableOpacity onPress={() => editPersonName(person)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Edit ${person.name}`}>
                  <MaterialIcons name="edit" size={19} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            ))}
          </View>

          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Settlement</Text>
            <Text style={[styles.muted, { color: colors.textSecondary }]}>Equal split</Text>
          </View>
          <View style={[styles.card, styles.settlementCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: borderRadius.lg }]}>
            {settlements.length > 0 ? settlements.map((item, index) => (
              <View key={`${item.from_person_id}-${item.to_person_id}-${index}`} style={[styles.settlementRow, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
                <View style={styles.transferCopy}>
                  <Text style={[styles.transferNames, { color: colors.text }]}>{item.from_name} pays {item.to_name}</Text>
                  <Text style={[styles.muted, { color: colors.textSecondary }]}>to make everyone’s share equal</Text>
                </View>
                <Text style={[styles.transferAmount, { color: colors.primary }]}>{formatPaiseToRupees(item.amount)}</Text>
              </View>
            )) : (
              <View style={styles.emptySettlement}>
                <MaterialIcons name={expenses.length ? 'check-circle-outline' : 'balance'} size={25} color={colors.success} />
                <Text style={[styles.emptySettlementText, { color: colors.textSecondary }]}>
                  {expenses.length ? 'Everyone is settled up.' : 'Add a shared expense to calculate balances.'}
                </Text>
              </View>
            )}
            {settlements.length > 0 && (
              <Text style={[styles.roundingNote, { color: colors.textSecondary }]}>
                Transfers round down to whole rupees; the app owner covers leftover paise.
              </Text>
            )}
          </View>

          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Expenses</Text>
            <Text style={[styles.muted, { color: colors.textSecondary }]}>{expenses.length}</Text>
          </View>
          {expenses.length > 0 ? expenses.map((expense) => (
            <View key={expense.id} style={[styles.expenseRow, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: borderRadius.md }]}>
              <View style={[styles.expenseIcon, { backgroundColor: colors.surfaceVariant }]}>
                <MaterialIcons name="receipt-long" size={19} color={colors.primary} />
              </View>
              <View style={styles.expenseCopy}>
                <Text style={[styles.expenseTitle, { color: colors.text }]} numberOfLines={1}>{expense.description || 'Shared expense'}</Text>
                <Text style={[styles.muted, { color: colors.textSecondary }]}>{expense.payer_name} paid · {new Date(expense.expense_date).toLocaleDateString()}</Text>
              </View>
              <Text style={[styles.expenseAmount, { color: colors.text }]}>{formatPaiseToRupees(expense.amount)}</Text>
              <TouchableOpacity onPress={() => editExpense(expense)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Edit expense">
                <MaterialIcons name="edit" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => deleteExpense(expense)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Delete expense">
                <MaterialIcons name="close" size={19} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          )) : (
            <Text style={[styles.emptyExpenses, { color: colors.textSecondary }]}>Add the first expense to start balancing.</Text>
          )}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={[styles.content, { padding: spacing.lg, paddingBottom: 112 }]}>
          {groups.length ? groups.map((group) => (
            <TouchableOpacity key={group.id} style={[styles.groupCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: borderRadius.lg }, shadows.sm]} onPress={() => openGroup(group)} activeOpacity={0.8}>
              <View style={[styles.groupIcon, { backgroundColor: colors.primaryLight }]}><MaterialIcons name="groups" size={23} color={colors.primary} /></View>
              <View style={styles.groupCopy}>
                <Text style={[styles.groupTitle, { color: colors.text }]} numberOfLines={1}>{group.name}</Text>
                <Text style={[styles.muted, { color: colors.textSecondary }]}>{group.people_count} people · {group.total_amount ? formatPaiseToRupees(group.total_amount) : 'No expenses yet'}</Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} color={colors.textMuted} />
            </TouchableOpacity>
          )) : (
            <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: borderRadius.lg }]}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.primaryLight }]}><MaterialIcons name="currency-exchange" size={30} color={colors.primary} /></View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>Share expenses fairly</Text>
              <Text style={[styles.emptyDescription, { color: colors.textSecondary }]}>Create a group, add who paid each expense, and get a simple settlement plan.</Text>
            </View>
          )}
        </ScrollView>
      )}

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary, borderRadius: borderRadius.full }, shadows.lg]}
        onPress={selectedGroup ? showAddExpense : () => setCreateGroupVisible(true)}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={selectedGroup ? 'Add shared expense' : 'Create a group'}
      >
        <MaterialIcons name="add" size={29} color="#ffffff" />
      </TouchableOpacity>

      <Modal visible={createGroupVisible} transparent animationType="slide" onRequestClose={() => setCreateGroupVisible(false)}>
        <KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={[styles.modalSheet, { backgroundColor: colors.modal, borderTopLeftRadius: 24, borderTopRightRadius: 24 }]}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { color: colors.text }]}>Create a group</Text>
            <Text style={[styles.modalHint, { color: colors.textSecondary }]}>Name it if you like. Person names are optional.</Text>
            <ScrollView style={styles.formScroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={styles.modalScroll}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Group name (optional)</Text>
              <TextInput value={groupName} onChangeText={setGroupName} placeholder="e.g. Goa weekend" placeholderTextColor={colors.textMuted} style={inputStyle} maxLength={40} />
              <View style={styles.countHeader}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>People in this group</Text>
                <View style={styles.countStepper}>
                  <TouchableOpacity onPress={() => updatePeopleCount(peopleCount - 1)} style={[styles.stepButton, { borderColor: colors.border }]}><MaterialIcons name="remove" size={20} color={colors.text} /></TouchableOpacity>
                  <Text style={[styles.countText, { color: colors.text }]}>{peopleCount}</Text>
                  <TouchableOpacity onPress={() => updatePeopleCount(peopleCount + 1)} style={[styles.stepButton, { borderColor: colors.border }]}><MaterialIcons name="add" size={20} color={colors.text} /></TouchableOpacity>
                </View>
              </View>
              {personNames.map((name, index) => (
                <View key={index} style={styles.nameField}>
                  <Text style={[styles.nameIndex, { color: colors.textSecondary }]}>Person {index + 1}</Text>
                  <TextInput value={name} onChangeText={(value) => setPersonNames((current) => current.map((item, nameIndex) => nameIndex === index ? value : item))} placeholder={`Optional name`} placeholderTextColor={colors.textMuted} style={[inputStyle, styles.nameInput]} maxLength={32} />
                </View>
              ))}
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.secondaryButton, { borderColor: colors.border }]} onPress={() => setCreateGroupVisible(false)}><Text style={[styles.secondaryButtonText, { color: colors.text }]}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity disabled={busy} style={[styles.primaryButton, styles.modalPrimary, { backgroundColor: colors.primary, borderRadius: borderRadius.md, opacity: busy ? 0.6 : 1 }]} onPress={createGroup}><Text style={styles.primaryButtonText}>Create group</Text></TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={addExpenseVisible}
        transparent
        animationType="slide"
        onShow={() => expenseAmountInputRef.current?.focus()}
        onRequestClose={() => setAddExpenseVisible(false)}
      >
        <KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Animated.View style={[styles.modalSheet, { backgroundColor: colors.modal, borderTopLeftRadius: 24, borderTopRightRadius: 24, transform: [{ translateY: expenseSheetTranslateY }] }]}>
            <View style={styles.expenseSheetDragArea} {...expenseSheetPan.panHandlers}>
              <View style={styles.modalHandle} />
              <Text style={[styles.modalTitle, { color: colors.text }]}>Add shared expense</Text>
              <Text style={[styles.modalHint, { color: colors.textSecondary }]}>Equal split · Swipe down to cancel.</Text>
            </View>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Amount</Text>
            <View style={[styles.amountInputWrap, { borderColor: colors.border, backgroundColor: colors.surfaceVariant, borderRadius: borderRadius.md }]}>
              <Text style={[styles.rupeePrefix, { color: colors.textSecondary }]}>₹</Text>
              <TextInput ref={expenseAmountInputRef} value={expenseAmount} onChangeText={setExpenseAmount} placeholder="0.00" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" style={[styles.amountInput, { color: colors.text }]} autoFocus />
            </View>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>What was it for? (optional)</Text>
            <TextInput value={expenseDescription} onChangeText={setExpenseDescription} placeholder="Dinner, taxi, groceries…" placeholderTextColor={colors.textMuted} style={inputStyle} maxLength={60} />
            <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 16 }]}>Paid by</Text>
            <View style={styles.payerChoices}>
              {people.map((person) => {
                const chosen = payerId === person.id;
                return <TouchableOpacity key={person.id} onPress={() => setPayerId(person.id)} style={[styles.payerChip, { backgroundColor: chosen ? colors.primaryLight : colors.surfaceVariant, borderColor: chosen ? colors.primary : colors.border, borderRadius: borderRadius.full }]}><Text style={[styles.payerChipText, { color: chosen ? colors.primary : colors.text }]}>{person.name}</Text></TouchableOpacity>;
              })}
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.secondaryButton, { borderColor: colors.border }]} onPress={() => setAddExpenseVisible(false)}><Text style={[styles.secondaryButtonText, { color: colors.text }]}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity disabled={busy} style={[styles.primaryButton, styles.modalPrimary, { backgroundColor: colors.primary, borderRadius: borderRadius.md, opacity: busy ? 0.6 : 1 }]} onPress={addExpense}><Text style={styles.primaryButtonText}>Save expense</Text></TouchableOpacity>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={editVisible} transparent animationType="slide" onRequestClose={() => setEditVisible(false)}>
        <KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={[styles.modalSheet, { backgroundColor: colors.modal, borderTopLeftRadius: 24, borderTopRightRadius: 24 }]}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { color: colors.text }]}>{editTitle}</Text>
            {editTarget?.kind === 'group' ? (
              <>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Group name</Text>
                <TextInput value={editValue} onChangeText={setEditValue} placeholder="Group name" placeholderTextColor={colors.textMuted} style={inputStyle} maxLength={40} autoFocus />
              </>
            ) : editTarget?.kind === 'person' ? (
              <>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Person name</Text>
                <TextInput value={editValue} onChangeText={setEditValue} placeholder="Person name" placeholderTextColor={colors.textMuted} style={inputStyle} maxLength={32} autoFocus />
              </>
            ) : (
              <>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Amount</Text>
                <View style={[styles.amountInputWrap, { borderColor: colors.border, backgroundColor: colors.surfaceVariant, borderRadius: borderRadius.md }]}>
                  <Text style={[styles.rupeePrefix, { color: colors.textSecondary }]}>₹</Text>
                  <TextInput value={editAmount} onChangeText={setEditAmount} placeholder="0.00" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" style={[styles.amountInput, { color: colors.text }]} autoFocus />
                </View>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Description (optional)</Text>
                <TextInput value={editDescription} onChangeText={setEditDescription} placeholder="Dinner, taxi, groceries…" placeholderTextColor={colors.textMuted} style={inputStyle} maxLength={60} />
                <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 14 }]}>Paid by</Text>
                <View style={styles.payerChoices}>
                  {people.map((person) => {
                    const chosen = editPayerId === person.id;
                    return (
                      <TouchableOpacity key={person.id} onPress={() => setEditPayerId(person.id)} style={[styles.payerChip, { backgroundColor: chosen ? colors.primaryLight : colors.surfaceVariant, borderColor: chosen ? colors.primary : colors.border, borderRadius: borderRadius.full }]}>
                        <Text style={[styles.payerChipText, { color: chosen ? colors.primary : colors.text }]}>{person.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.secondaryButton, { borderColor: colors.border }]} onPress={() => setEditVisible(false)}>
                <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity disabled={busy} style={[styles.primaryButton, styles.modalPrimary, { backgroundColor: colors.primary, borderRadius: borderRadius.md, opacity: busy ? 0.6 : 1 }]} onPress={saveEdit}>
                <Text style={styles.primaryButtonText}>Save changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = {
  safeArea: { flex: 1 },
  header: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  backButton: { width: 36, height: 40, justifyContent: 'center' },
  headerTitles: { flex: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  title: { fontSize: 23, fontWeight: '800' },
  subtitle: { marginTop: 3, fontSize: 13 },
  content: { flexGrow: 1, gap: 12, paddingBottom: 28 },
  totalCard: { minHeight: 106, paddingHorizontal: 20, paddingVertical: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600' },
  totalAmount: { color: '#fff', fontSize: 28, fontWeight: '800', marginTop: 4 },
  sectionHeader: { marginTop: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 17, fontWeight: '700' },
  muted: { fontSize: 12 },
  card: { borderWidth: 1, overflow: 'hidden' },
  personRow: { minHeight: 60, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 11 },
  avatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 15, fontWeight: '800' },
  personName: { flex: 1, fontSize: 14, fontWeight: '600' },
  paidTotal: { alignItems: 'flex-end', gap: 2 },
  paidAmount: { fontSize: 13, fontWeight: '700' },
  settlementCard: { paddingHorizontal: 14 },
  settlementRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  transferCopy: { flex: 1, gap: 4 },
  transferNames: { fontSize: 14, fontWeight: '700' },
  transferAmount: { fontSize: 16, fontWeight: '800' },
  emptySettlement: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 10 },
  emptySettlementText: { fontSize: 13, flex: 1 },
  roundingNote: { fontSize: 11, lineHeight: 16, paddingTop: 8, paddingBottom: 10 },
  expenseRow: { minHeight: 65, paddingHorizontal: 11, paddingVertical: 9, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 9 },
  expenseIcon: { height: 36, width: 36, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  expenseCopy: { flex: 1, gap: 4 },
  expenseTitle: { fontSize: 14, fontWeight: '600' },
  expenseAmount: { fontSize: 13, fontWeight: '700' },
  emptyExpenses: { fontSize: 13, paddingVertical: 5 },
  groupCard: { minHeight: 78, borderWidth: 1, flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  groupIcon: { height: 42, width: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  groupCopy: { flex: 1, gap: 5 },
  groupTitle: { fontSize: 15, fontWeight: '700' },
  emptyCard: { borderWidth: 1, alignItems: 'center', paddingHorizontal: 24, paddingVertical: 34, marginTop: 18 },
  emptyIcon: { width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  emptyTitle: { fontSize: 18, fontWeight: '800' },
  emptyDescription: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 7 },
  primaryButton: { minHeight: 50, paddingHorizontal: 18, marginTop: 8, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.38)' },
  modalSheet: { maxHeight: '92%', paddingHorizontal: 20, paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 24 : 16 },
  modalHandle: { width: 38, height: 4, borderRadius: 2, backgroundColor: '#a0a0a0', alignSelf: 'center', marginBottom: 15 },
  expenseSheetDragArea: { paddingBottom: 1 },
  modalTitle: { fontSize: 21, fontWeight: '800' },
  modalHint: { fontSize: 13, marginTop: 4, marginBottom: 18 },
  formScroll: { flexShrink: 1 },
  modalScroll: { paddingBottom: 8 },
  fieldLabel: { fontSize: 13, fontWeight: '600', marginBottom: 7, marginTop: 8 },
  input: { minHeight: 48, borderWidth: 1, paddingHorizontal: 13, fontSize: 15 },
  countHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 6 },
  countStepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepButton: { width: 34, height: 34, borderWidth: 1, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  countText: { minWidth: 18, textAlign: 'center', fontSize: 16, fontWeight: '700' },
  nameField: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  nameIndex: { width: 66, fontSize: 12, fontWeight: '600' },
  nameInput: { flex: 1 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  secondaryButton: { flex: 1, height: 50, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { fontSize: 14, fontWeight: '700' },
  modalPrimary: { flex: 1, marginTop: 0 },
  amountInputWrap: { minHeight: 58, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, marginBottom: 12 },
  rupeePrefix: { fontSize: 20, fontWeight: '700', marginRight: 8 },
  amountInput: { flex: 1, fontSize: 22, fontWeight: '700', paddingVertical: 8 },
  payerChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  payerChip: { minHeight: 38, borderWidth: 1, paddingHorizontal: 14, justifyContent: 'center' },
  payerChipText: { fontSize: 13, fontWeight: '600' },
  fab: { position: 'absolute', right: 20, bottom: 22, width: 60, height: 60, alignItems: 'center', justifyContent: 'center', elevation: 8 },
} as const;
