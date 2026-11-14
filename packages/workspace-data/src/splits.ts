export interface SplitMember { id: string; name: string }
export interface SplitPayment { paid_by_person_id: string; amount: number }
export interface SplitBalance<T extends SplitMember = SplitMember> { person: T; paid: number; share: number; balance: number }
/** Preserve the phone's member order and assign each expense's remainder paise in that order. */
export function calculateSplitBalances<T extends SplitMember>(people: T[], expenses: SplitPayment[]): SplitBalance<T>[] {
  const paid = new Map(people.map((person) => [person.id, 0])), owed = new Map(people.map((person) => [person.id, 0]));
  if (!people.length) return [];
  for (const expense of expenses) {
    if (!paid.has(expense.paid_by_person_id) || !Number.isSafeInteger(expense.amount) || expense.amount <= 0) continue;
    paid.set(expense.paid_by_person_id, paid.get(expense.paid_by_person_id)! + expense.amount);
    const share = Math.floor(expense.amount / people.length), remainder = expense.amount % people.length;
    people.forEach((person, index) => owed.set(person.id, owed.get(person.id)! + share + (index < remainder ? 1 : 0)));
  }
  return people.map((person) => ({ person, paid: paid.get(person.id)!, share: owed.get(person.id)!, balance: paid.get(person.id)! - owed.get(person.id)! }));
}
export function splitTransfers<T extends SplitMember>(balances: SplitBalance<T>[]) {
  const creditors = balances.filter((row) => row.balance > 0).map((row) => ({ person: row.person, balance: row.balance })).sort((a,b) => b.balance-a.balance);
  const debtors = balances.filter((row) => row.balance < 0).map((row) => ({ person: row.person, balance: -row.balance })).sort((a,b) => b.balance-a.balance);
  const result: { from_person_id: string; from_name: string; to_person_id: string; to_name: string; amount: number }[] = []; let i=0,j=0;
  while (i<debtors.length && j<creditors.length) {
    const exact=Math.min(debtors[i].balance,creditors[j].balance), amount=Math.floor(exact/100)*100;
    if (amount>0) result.push({ from_person_id:debtors[i].person.id,from_name:debtors[i].person.name,to_person_id:creditors[j].person.id,to_name:creditors[j].person.name,amount });
    debtors[i].balance-=exact;creditors[j].balance-=exact;
    if (!debtors[i].balance)i++;if(!creditors[j].balance)j++;
  }
  return result;
}
