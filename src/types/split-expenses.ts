export interface SplitGroup {
  id: string;
  name: string;
  created_at: number;
  updated_at: number;
  people_count: number;
  total_amount: number;
}

export interface SplitPerson {
  id: string;
  group_id: string;
  name: string;
  created_at: number;
  total_paid: number;
}

export interface SplitExpense {
  id: string;
  group_id: string;
  description: string | null;
  amount: number;
  paid_by_person_id: string;
  expense_date: number;
  created_at: number;
  payer_name: string;
}

export interface SplitSettlement {
  from_person_id: string;
  from_name: string;
  to_person_id: string;
  to_name: string;
  amount: number;
}
