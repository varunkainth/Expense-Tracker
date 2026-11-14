import { expect, test } from 'bun:test';
import { splitBalances, settlements, fuelIntervals, currentMonth } from '../src/features/workspace/lib/calculations';
import { csv, sumMoney } from '../src/features/workspace/lib/format';
import type { WorkspaceRow } from '../src/features/workspace/hooks/use-workspace';
const row = (data: Record<string, string | number | null>): WorkspaceRow => ({ ...data, sourceDevice: 'device' });
test('exact balances preserve paise and settlement suggestions match phone rounding', () => {
  const people = ['a','b','c'].map((id) => row({ id, name:id, created_at:1 }));
  const balances = splitBalances(people, [row({ id:'e', amount:10001, paid_by_person_id:'a' })]);
  expect(balances.map((row) => row.share)).toEqual([3334,3334,3333]);
  expect(balances.reduce((sum,row) => sum+row.balance,0)).toBe(0);
  expect(settlements(balances).reduce((sum,row) => sum+row.amount,0)).toBe(6600);
});
test('fuel mileage is based on previous litres and never duplicates expense amounts', () => {
  const rows = [row({ id:'a', amount:10000, litres:2, odometer:100, expense_date:1700000000000, created_at:1 }), row({ id:'b', amount:15000, litres:3, odometer:180, expense_date:1700086400000, created_at:2 })];
  expect(fuelIntervals(rows)[1]).toMatchObject({ distance:80, mileage:40 });
  expect(sumMoney(rows)).toBe(25000);
});
test('month filtering keeps historical data separate and CSV escapes formulas', () => {
  const values = [row({ id:'a', amount:12345, description:'=HYPERLINK("bad")', expense_date:new Date(2026,0,2).getTime() }), row({ id:'b', amount:100, expense_date:new Date(2026,1,2).getTime() })];
  expect(currentMonth(values, new Date(2026,0,14))).toHaveLength(1);
  const text = csv(values, ['description','amount']);
  expect(text).toContain("'=HYPERLINK"); expect(text).toContain('123.45');
});

test('split rounding and per-expense remainder match the mobile rule', () => {
  const people=['a','b','c'].map((id) => row({id,name:id}));
  const balances=splitBalances(people,[row({amount:1,paid_by_person_id:'a'}),row({amount:1,paid_by_person_id:'b'})]);
  expect(balances.map((value)=>value.share)).toEqual([2,0,0]);
  expect(settlements(splitBalances(people.slice(0,2),[row({amount:3100,paid_by_person_id:'a'})]))[0].amount).toBe(1500);
});
