export interface EmployeeDetails { id: string; name: string; employee_code: string; grade: string; department: string; mobile_no: string | null; location: string; created_at: number; updated_at: number }
export const DAILY_ALLOWANCE_RATES = { TRAVEL_ALLOWANCE_PAISE: 40000, FOOD_ALLOWANCE_PAISE: 60000, TOTAL_ALLOWANCE_PAISE: 100000 } as const;
