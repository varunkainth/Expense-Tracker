import { DAILY_ALLOWANCE_RATES } from '../types/company';

export type CompanyExpenseTypeKey =
  | 'local_conveyance'
  | 'outstation_conveyance'
  | 'hotel'
  | 'tour_conveyance'
  | 'phone_expense'
  | 'miscellaneous_expense'
  | 'daily_allowance';

export interface CompanyExpenseMeta {
  key: CompanyExpenseTypeKey;
  route: string;
  label: string;
  description: string;
  icon: string;
  color: { light: string; dark: string };
  bgColor: { light: string; dark: string };
}

export const COMPANY_EXPENSE_TYPES: CompanyExpenseMeta[] = [
  {
    key: 'local_conveyance',
    route: '/(company)/local-conveyance',
    label: 'Local Conveyance',
    description: 'Local client & site visits, metro, bike, cab',
    icon: 'two-wheeler',
    color:   { light: '#0d9488', dark: '#2dd4bf' },
    bgColor: { light: '#ccfbf1', dark: '#134e4a' },
  },
  {
    key: 'outstation_conveyance',
    route: '/(company)/outstation-conveyance',
    label: 'Outstation Conveyance',
    description: 'Inter-city bus, train, flight travel',
    icon: 'directions-bus',
    color:   { light: '#0284c7', dark: '#38bdf8' },
    bgColor: { light: '#e0f2fe', dark: '#0c4a6e' },
  },
  {
    key: 'hotel',
    route: '/(company)/hotel',
    label: 'Hotel & Stay',
    description: 'Outstation lodging and accommodation',
    icon: 'hotel',
    color:   { light: '#7c3aed', dark: '#a78bfa' },
    bgColor: { light: '#ede9fe', dark: '#3b0764' },
  },
  {
    key: 'tour_conveyance',
    route: '/(company)/tour-conveyance',
    label: 'Tour Conveyance',
    description: 'Travel between destinations during outstation tour',
    icon: 'commute',
    color:   { light: '#ea580c', dark: '#fb923c' },
    bgColor: { light: '#ffedd5', dark: '#7c2d12' },
  },
  {
    key: 'phone_expense',
    route: '/(company)/phone-expense',
    label: 'Phone & Fax',
    description: 'Telephone, mobile and communication bills',
    icon: 'phone-in-talk',
    color:   { light: '#059669', dark: '#34d399' },
    bgColor: { light: '#d1fae5', dark: '#064e3b' },
  },
  {
    key: 'miscellaneous_expense',
    route: '/(company)/miscellaneous',
    label: 'Miscellaneous',
    description: 'Small materials, cables, service purchases',
    icon: 'category',
    color:   { light: '#d97706', dark: '#fbbf24' },
    bgColor: { light: '#fef3c7', dark: '#78350f' },
  },
  {
    key: 'daily_allowance',
    route: '/(company)/daily-allowance',
    label: 'Daily Allowance',
    description: 'Standard outstation DA (₹375 travel + ₹500 food = ₹875/day)',
    icon: 'monetization-on',
    color:   { light: '#4f46e5', dark: '#818cf8' },
    bgColor: { light: '#e0e7ff', dark: '#312e81' },
  },
];

export { DAILY_ALLOWANCE_RATES };
