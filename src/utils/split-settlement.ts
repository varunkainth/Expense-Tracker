import { SplitExpense, SplitPerson, SplitSettlement } from '../types/split-expenses';

/** Equal split across all people in a group, with leftover paise assigned in member order. */
export function calculateSettlements(
  people: SplitPerson[],
  expenses: SplitExpense[],
): SplitSettlement[] {
  if (people.length < 2) return [];

  const peopleById = new Map(people.map((person) => [person.id, person]));
  const paid = new Map(people.map((person) => [person.id, 0]));
  const owed = new Map(people.map((person) => [person.id, 0]));

  for (const expense of expenses) {
    if (!peopleById.has(expense.paid_by_person_id) || expense.amount <= 0) continue;
    paid.set(expense.paid_by_person_id, (paid.get(expense.paid_by_person_id) ?? 0) + expense.amount);

    const share = Math.floor(expense.amount / people.length);
    const extraPaise = expense.amount % people.length;
    people.forEach((person, index) => {
      owed.set(person.id, (owed.get(person.id) ?? 0) + share + (index < extraPaise ? 1 : 0));
    });
  }

  const debtors = people
    .map((person) => ({ person, balance: (paid.get(person.id) ?? 0) - (owed.get(person.id) ?? 0) }))
    .filter((entry) => entry.balance < 0)
    .map((entry) => ({ ...entry, balance: -entry.balance }))
    .sort((a, b) => b.balance - a.balance);
  const creditors = people
    .map((person) => ({ person, balance: (paid.get(person.id) ?? 0) - (owed.get(person.id) ?? 0) }))
    .filter((entry) => entry.balance > 0)
    .sort((a, b) => b.balance - a.balance);

  const settlements: SplitSettlement[] = [];
  let debtorIndex = 0;
  let creditorIndex = 0;
  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const exactAmount = Math.min(debtor.balance, creditor.balance);
    const amount = Math.floor(exactAmount / 100) * 100;
    if (amount > 0) {
      settlements.push({
        from_person_id: debtor.person.id,
        from_name: debtor.person.name,
        to_person_id: creditor.person.id,
        to_name: creditor.person.name,
        amount,
      });
      debtor.balance -= exactAmount;
      creditor.balance -= exactAmount;
    }
    if (debtor.balance === 0) debtorIndex += 1;
    if (creditor.balance === 0) creditorIndex += 1;
  }
  return settlements;
}
