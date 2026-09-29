export interface CategoryMeta {
  name: string;
  icon: string; // MaterialIcons or Ionicons name
  color: string;
  bgColor: string;
}

export const DEFAULT_CATEGORY_METAS: Record<string, CategoryMeta> = {
  Food: {
    name: 'Food',
    icon: 'restaurant',
    color: '#f97316', // Orange
    bgColor: '#ffedd5',
  },
  Movie: {
    name: 'Movie',
    icon: 'movie',
    color: '#ec4899', // Pink
    bgColor: '#fce7f3',
  },
  Petrol: {
    name: 'Petrol',
    icon: 'local-gas-station',
    color: '#eab308', // Yellow
    bgColor: '#fef9c3',
  },
  Grocery: {
    name: 'Grocery',
    icon: 'shopping-basket',
    color: '#22c55e', // Green
    bgColor: '#dcfce7',
  },
  Medicine: {
    name: 'Medicine',
    icon: 'medical-services',
    color: '#ef4444', // Red
    bgColor: '#fee2e2',
  },
  Shopping: {
    name: 'Shopping',
    icon: 'shopping-bag',
    color: '#a855f7', // Purple
    bgColor: '#f3e8ff',
  },
  Travel: {
    name: 'Travel',
    icon: 'flight',
    color: '#06b6d4', // Cyan
    bgColor: '#cffafe',
  },
  Bills: {
    name: 'Bills',
    icon: 'receipt-long',
    color: '#3b82f6', // Blue
    bgColor: '#dbeafe',
  },
  Subscription: {
    name: 'Subscription',
    icon: 'subscriptions',
    color: '#6366f1', // Indigo
    bgColor: '#e0e7ff',
  },
  Other: {
    name: 'Other',
    icon: 'more-horiz',
    color: '#64748b', // Slate
    bgColor: '#f1f5f9',
  },
};

export const DEFAULT_CATEGORY_NAMES = Object.keys(DEFAULT_CATEGORY_METAS);
