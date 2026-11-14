import {
  LayoutDashboard, ReceiptText, Building2, Users, Fuel, Tags, Wallet,
  ChartNoAxesCombined, Repeat, CalendarClock, CreditCard, TrendingUp,
  Bell, Palette, ShieldCheck, Coins, DatabaseBackup, Download, Settings,
  ArrowLeftRight, Bike, Bus, Hotel, Route, Phone, Package, UserRound,
  type LucideIcon,
} from 'lucide-react';

export interface FeatureLink {
  path: string;
  label: string;
  description: string;
  icon: LucideIcon;
  available?: boolean;
}
export interface NavigationGroup { label: string; items: FeatureLink[] }
export const companyFeatures: FeatureLink[] = [
  { path: '/company/employee', label: 'Employee Details', description: 'Employee profile and reimbursement details.', icon: UserRound, available: true },
  { path: '/company/local-conveyance', label: 'Local Conveyance', description: 'Local visits, metro, bike and cab expenses.', icon: Bike, available: true },
  { path: '/company/outstation-conveyance', label: 'Outstation Conveyance', description: 'Inter-city bus, train and flight travel.', icon: Bus, available: true },
  { path: '/company/hotel', label: 'Hotel & Stay', description: 'Outstation lodging and accommodation.', icon: Hotel, available: true },
  { path: '/company/tour-conveyance', label: 'Tour Conveyance', description: 'Travel between destinations during a tour.', icon: Route, available: true },
  { path: '/company/phone-expense', label: 'Phone & Fax', description: 'Telephone, mobile and communication bills.', icon: Phone, available: true },
  { path: '/company/miscellaneous', label: 'Miscellaneous', description: 'Materials, services and other work purchases.', icon: Package, available: true },
  { path: '/company/daily-allowance', label: 'Daily Allowance', description: 'Travel and food allowance records.', icon: Coins, available: true },
];
export const navigationGroups: NavigationGroup[] = [
  { label: 'Workspace', items: [
    { path: '/', label: 'Overview', description: 'Personal spending from this browser and linked phones.', icon: LayoutDashboard, available: true },
    { path: '/expenses', label: 'Personal Expenses', description: 'Add, edit and search your personal expenses.', icon: ReceiptText, available: true },
    { path: '/company', label: 'Company Expenses', description: 'Work expenses and reimbursements.', icon: Building2, available: true },
    { path: '/split', label: 'Split Expenses', description: 'Groups, shared costs and settlements.', icon: Users, available: true },
    { path: '/vehicles', label: 'Vehicles & Fuel', description: 'Named vehicles, refills, distance and estimated mileage.', icon: Fuel, available: true },
  ] },
  { label: 'Planning & insights', items: [
    { path: '/insights', label: 'Spending Insights', description: 'Spending trends and category comparisons.', icon: ChartNoAxesCombined, available: true },
    { path: '/budgets', label: 'Category Budgets', description: 'Monthly spending limits by category.', icon: Wallet, available: true },
    { path: '/recurring', label: 'Recurring Expenses', description: 'Monthly bills and repeating expenses.', icon: Repeat, available: true },
    { path: '/upcoming', label: 'Upcoming Payments', description: 'SIPs, subscriptions and recurring payments.', icon: CalendarClock, available: true },
    { path: '/subscriptions', label: 'Subscriptions', description: 'Monthly subscriptions and due dates.', icon: CreditCard, available: true },
    { path: '/investments', label: 'Investments & SIPs', description: 'Contributions tracked separately from spending.', icon: TrendingUp, available: true },
  ] },
  { label: 'Preferences & data', items: [
    { path: '/categories', label: 'Expense Categories', description: 'Manage categories and subcategories.', icon: Tags, available: true },
    { path: '/notifications', label: 'Notifications', description: 'Scheduled payment and SIP reminders.', icon: Bell, available: true },
    { path: '/appearance', label: 'Appearance', description: 'Light, dark or your device theme.', icon: Palette, available: true },
    { path: '/security', label: 'Security & App Lock', description: 'Privacy and device access preferences.', icon: ShieldCheck, available: true },
    { path: '/daily-allowance-rates', label: 'Daily Allowance Rates', description: 'Configure travel and food allowance rates.', icon: Coins, available: true },
    { path: '/backup', label: 'Backup & Restore', description: 'Offline backup and recovery.', icon: DatabaseBackup, available: true },
    { path: '/export', label: 'Export', description: 'Portable expense files and reports.', icon: Download, available: true },
    { path: '/connect', label: 'Connect Phone', description: 'Linked device, transfer progress and imported record counts.', icon: ArrowLeftRight, available: true },
    { path: '/settings', label: 'Settings', description: 'All your preferences in one place.', icon: Settings, available: true },
  ] },
];
export const allFeatures = [...navigationGroups.flatMap((group) => group.items), ...companyFeatures];
