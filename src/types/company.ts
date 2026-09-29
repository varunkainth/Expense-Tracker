// ------------------------------------------------------------
// 1. Employee Details
// ------------------------------------------------------------
export interface EmployeeDetails {
  id: string;
  name: string;
  employee_code: string;
  grade: string;
  department: string;
  mobile_no: string | null;
  location: string;
  created_at: number;
  updated_at: number;
}

export interface CreateEmployeeDTO {
  name: string;
  employee_code: string;
  grade: string;
  mobile_no?: string | null;
  department: string;
  location: string;
}

export interface UpdateEmployeeDTO {
  name?: string;
  employee_code?: string;
  grade?: string;
  mobile_no?: string | null;
  department?: string;
  location?: string;
}

// ------------------------------------------------------------
// 2. Local Conveyance
// ------------------------------------------------------------
export interface LocalConveyance {
  id: string;
  employee_id: string;
  date: number;
  particulars: string;
  mode: string;
  complaint_no: string;
  amount: number; // in paise
  created_at: number;
  updated_at: number;
}

export interface CreateLocalConveyanceDTO {
  employee_id: string;
  date: number;
  particulars: string;
  mode: string;
  complaint_no: string;
  amount: number; // in paise
}

export interface UpdateLocalConveyanceDTO {
  employee_id?: string;
  date?: number;
  particulars?: string;
  mode?: string;
  complaint_no?: string;
  amount?: number; // in paise
}

// ------------------------------------------------------------
// 3. Outstation Conveyance
// ------------------------------------------------------------
export interface OutstationConveyance {
  id: string;
  employee_id: string;
  date: number;
  from_location: string;
  departure_time: number | null;
  to_location: string;
  arrival_time: number | null;
  mode: string;
  amount: number; // in paise
  created_at: number;
  updated_at: number;
}

export interface CreateOutstationConveyanceDTO {
  employee_id: string;
  date: number;
  from_location: string;
  departure_time?: number | null;
  to_location: string;
  arrival_time?: number | null;
  mode: string;
  amount: number; // in paise
}

export interface UpdateOutstationConveyanceDTO {
  employee_id?: string;
  date?: number;
  from_location?: string;
  departure_time?: number | null;
  to_location?: string;
  arrival_time?: number | null;
  mode?: string;
  amount?: number; // in paise
}

// ------------------------------------------------------------
// 4. Hotel
// ------------------------------------------------------------
export interface HotelExpense {
  id: string;
  employee_id: string;
  hotel_name: string;
  bill_no: string | null;
  start_date: number;
  end_date: number;
  no_of_days: number;
  rate_per_day: number; // in paise
  food_amount: number | null; // in paise
  amount: number; // in paise
  created_at: number;
  updated_at: number;
}

export interface CreateHotelExpenseDTO {
  employee_id: string;
  hotel_name: string;
  bill_no?: string | null;
  start_date: number;
  end_date: number;
  no_of_days: number;
  rate_per_day: number; // in paise
  food_amount?: number | null; // in paise
  amount: number; // in paise
}

export interface UpdateHotelExpenseDTO {
  employee_id?: string;
  hotel_name?: string;
  bill_no?: string | null;
  start_date?: number;
  end_date?: number;
  no_of_days?: number;
  rate_per_day?: number;
  food_amount?: number | null;
  amount?: number;
}

// ------------------------------------------------------------
// 5. Tour Conveyance
// ------------------------------------------------------------
export interface TourConveyance {
  id: string;
  employee_id: string;
  date: number;
  from_location: string;
  to_location: string;
  mode: string;
  fare: number; // in paise
  created_at: number;
  updated_at: number;
}

export interface CreateTourConveyanceDTO {
  employee_id: string;
  date: number;
  from_location: string;
  to_location: string;
  mode: string;
  fare: number; // in paise
}

export interface UpdateTourConveyanceDTO {
  employee_id?: string;
  date?: number;
  from_location?: string;
  to_location?: string;
  mode?: string;
  fare?: number;
}

// ------------------------------------------------------------
// 6. Phone Expense
// ------------------------------------------------------------
export interface PhoneExpense {
  id: string;
  employee_id: string;
  date: number;
  particulars: string;
  tel_fax_no: string;
  bill_no: string;
  amount: number; // in paise
  created_at: number;
  updated_at: number;
}

export interface CreatePhoneExpenseDTO {
  employee_id: string;
  date: number;
  particulars: string;
  tel_fax_no: string;
  bill_no: string;
  amount: number; // in paise
}

export interface UpdatePhoneExpenseDTO {
  employee_id?: string;
  date?: number;
  particulars?: string;
  tel_fax_no?: string;
  bill_no?: string;
  amount?: number;
}

// ------------------------------------------------------------
// 7. Miscellaneous Expense
// ------------------------------------------------------------
export interface MiscellaneousExpense {
  id: string;
  employee_id: string;
  date: number;
  particulars: string;
  bill_no: string;
  amount: number; // in paise
  created_at: number;
  updated_at: number;
}

export interface CreateMiscellaneousExpenseDTO {
  employee_id: string;
  date: number;
  particulars: string;
  bill_no: string;
  amount: number; // in paise
}

export interface UpdateMiscellaneousExpenseDTO {
  employee_id?: string;
  date?: number;
  particulars?: string;
  bill_no?: string;
  amount?: number;
}

// ------------------------------------------------------------
// 8. Daily Allowance
// ------------------------------------------------------------

export const DAILY_ALLOWANCE_RATES = {
  TRAVEL_ALLOWANCE_PAISE: 37500, // ₹375
  FOOD_ALLOWANCE_PAISE: 50000,   // ₹500
  TOTAL_ALLOWANCE_PAISE: 87500,  // ₹875
} as const;

export interface DailyAllowance {
  id: string;
  employee_id: string;
  no_of_days: number;         // user-entered
  start_date: number;         // ms timestamp, midnight
  end_date: number;           // ms timestamp, midnight
  travel_allowance: number;   // in paise = 37500 * no_of_days
  food_allowance: number;     // in paise = 50000 * no_of_days
  total_amount: number;       // in paise = travel_allowance + food_allowance
  created_at: number;
  updated_at: number;
}

export interface CreateDailyAllowanceDTO {
  employee_id: string;
  no_of_days: number;
  start_date: number;
  end_date: number;
  travel_allowance?: number;  // defaults to 37500 * no_of_days
  food_allowance?: number;    // defaults to 50000 * no_of_days
  total_amount?: number;      // defaults to travel + food
}

export interface UpdateDailyAllowanceDTO {
  employee_id?: string;
  no_of_days?: number;
  start_date?: number;
  end_date?: number;
  travel_allowance?: number;
  food_allowance?: number;
  total_amount?: number;
}