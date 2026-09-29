import { PaymentMethod } from '../types/personal';

export interface PaymentMethodMeta {
  key: PaymentMethod;
  label: string;
  icon: string;
  color: string;
  bgColor: string;
}

export const PAYMENT_METHODS: PaymentMethodMeta[] = [
  {
    key: 'UPI',
    label: 'UPI',
    icon: 'qr-code-2',
    color: '#059669', // Emerald
    bgColor: '#d1fae5',
  },
  {
    key: 'Cash',
    label: 'Cash',
    icon: 'payments',
    color: '#16a34a', // Green
    bgColor: '#dcfce7',
  },
  {
    key: 'Card',
    label: 'Card',
    icon: 'credit-card',
    color: '#2563eb', // Blue
    bgColor: '#dbeafe',
  },
  {
    key: 'Other',
    label: 'Other',
    icon: 'account-balance-wallet',
    color: '#64748b', // Slate
    bgColor: '#f1f5f9',
  },
];

export const PAYMENT_METHOD_KEYS: PaymentMethod[] = ['UPI', 'Cash', 'Card', 'Other'];
