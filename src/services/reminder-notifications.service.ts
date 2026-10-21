import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { listRecurringExpenses, RecurringExpense } from '../repositories/recurring-expense.repository';
import { listSubscriptions, Subscription } from '../repositories/subscription.repository';
import { InvestmentPlan, listInvestmentPlans } from '../repositories/investment.repository';
import { formatPaiseToRupees } from '../utils/currency';
import { nextMonthlyDate } from '../utils/recurring';
import { getPreference, setPreference } from './preferences.service';
import { StorageService } from './storage.service';

export type ReminderKind = 'subscription' | 'recurring' | 'investment';
const OWNER = 'expense-tracker-reminder';
const CHANNEL_ID = 'scheduled-expenses';
const MONTHS_AHEAD = 12;
const MAX_PENDING = 60;
const PERMISSION_ASKED_KEY = 'reminder.permission-asked';
const REMINDER_TIME_KEY = 'reminder.time';
const DEFAULT_REMINDER_TIME = '09:00';
const enabledKey = (kind: ReminderKind) => `reminder.${kind}.enabled`;

export async function getReminderTime(): Promise<string> {
  const value = await getPreference(REMINDER_TIME_KEY);
  return value && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : DEFAULT_REMINDER_TIME;
}

export async function setReminderTime(value: string): Promise<void> {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new Error('Invalid reminder time.');
  await setPreference(REMINDER_TIME_KEY, value);
  await syncReminderNotifications();
}

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function remindersEnabled(kind: ReminderKind): Promise<boolean> {
  return (await getPreference(enabledKey(kind))) !== 'false';
}

export async function setRemindersEnabled(kind: ReminderKind, enabled: boolean): Promise<void> {
  await setPreference(enabledKey(kind), String(enabled));
  if (enabled) await requestReminderPermission();
  await syncReminderNotifications();
}

export async function notificationPermissionGranted(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const status = await Notifications.getPermissionsAsync();
  return status.granted || status.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

async function configureChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Scheduled payments',
    description: 'Subscription, recurring expense, and investment reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

export async function requestReminderPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  await configureChannel();
  if (await notificationPermissionGranted()) return true;
  await StorageService.setItem(PERMISSION_ASKED_KEY, 'true');
  const status = await Notifications.requestPermissionsAsync();
  return status.granted || status.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

type Candidate = {
  date: number;
  dueAt: number;
  kind: ReminderKind;
  recordId: string;
  title: string;
  body: string;
};

function atReminderTime(timestamp: number, time: string, previousDay = false): number {
  const date = new Date(timestamp);
  if (previousDay) date.setDate(date.getDate() - 1);
  const [hour, minute] = time.split(':').map(Number);
  date.setHours(hour, minute, 0, 0);
  return date.getTime();
}

function firstRelevantDue(timestamp: number, dayOfMonth: number, now: number, time: string): number {
  let due = timestamp;
  let skipped = 0;
  while (atReminderTime(due, time) < now - 86400000 && skipped < 1200) {
    due = nextMonthlyDate(due, dayOfMonth);
    skipped += 1;
  }
  return due;
}

function subscriptionCandidates(items: Subscription[], now: number, time: string): Candidate[] {
  const candidates: Candidate[] = [];
  for (const item of items) {
    const due = item.next_due;
    const before = atReminderTime(due, time, true);
    const onDay = atReminderTime(due, time);
    if (before > now) candidates.push({ date: before, dueAt: due, kind: 'subscription', recordId: item.id,
      title: `${item.name} is due tomorrow`, body: `${formatPaiseToRupees(item.amount)} · Tap to review this payment.` });
    if (onDay > now) candidates.push({ date: onDay, dueAt: due, kind: 'subscription', recordId: item.id,
      title: `${item.name} is due today`, body: `${formatPaiseToRupees(item.amount)} · Mark paid, remind tomorrow, or skip.` });
  }
  return candidates;
}

function recurringCandidates(items: RecurringExpense[], now: number, time: string): Candidate[] {
  const candidates: Candidate[] = [];
  for (const item of items) {
    let due = firstRelevantDue(item.next_due, item.day_of_month, now, time);
    for (let i = 0; i < MONTHS_AHEAD; i++) {
      const date = atReminderTime(due, time);
      if (date > now) candidates.push({ date, dueAt: due, kind: 'recurring', recordId: item.id,
        title: `${item.description || item.category_name || 'Recurring expense'} is scheduled today`,
        body: `${formatPaiseToRupees(item.amount)} · Tap to view this schedule.` });
      due = nextMonthlyDate(due, item.day_of_month);
    }
  }
  return candidates;
}

function investmentCandidates(items: InvestmentPlan[], now: number, time: string): Candidate[] {
  const candidates: Candidate[] = [];
  for (const item of items) {
    if (!item.active) continue;
    const due = item.next_due;
    const before = atReminderTime(due, time, true);
    const onDay = atReminderTime(due, time);
    if (before > now) candidates.push({ date: before, dueAt: due, kind: 'investment', recordId: item.id,
      title: `${item.name} SIP is due tomorrow`, body: `${formatPaiseToRupees(item.amount)} · Tap to review your investment.` });
    if (onDay > now) candidates.push({ date: onDay, dueAt: due, kind: 'investment', recordId: item.id,
      title: `${item.name} SIP is due today`, body: `${formatPaiseToRupees(item.amount)} · Record or skip this installment.` });
  }
  return candidates;
}

let syncQueue: Promise<void> = Promise.resolve();

export function syncReminderNotifications(): Promise<void> {
  if (Platform.OS === 'web') return Promise.resolve();
  const next = syncQueue.catch(() => {}).then(async () => {
    await configureChannel();
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const ours = scheduled.filter((request) => request.content.data?.owner === OWNER);
    for (const request of ours) await Notifications.cancelScheduledNotificationAsync(request.identifier);
    if (!await notificationPermissionGranted()) return;

    const [subscriptionsOn, recurringOn, investmentsOn, subscriptions, recurring, investments, time] = await Promise.all([
      remindersEnabled('subscription'), remindersEnabled('recurring'), remindersEnabled('investment'),
      listSubscriptions(), listRecurringExpenses(), listInvestmentPlans(), getReminderTime(),
    ]);
    const now = Date.now();
    const candidates = [
      ...(subscriptionsOn ? subscriptionCandidates(subscriptions, now, time) : []),
      ...(recurringOn ? recurringCandidates(recurring, now, time) : []),
      ...(investmentsOn ? investmentCandidates(investments, now, time) : []),
    ].sort((a, b) => a.date - b.date).slice(0, MAX_PENDING);

    for (const item of candidates) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: item.title,
          body: item.body,
          data: { owner: OWNER, kind: item.kind, recordId: item.recordId, dueAt: item.dueAt },
          sound: 'default',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: item.date,
          channelId: CHANNEL_ID,
        },
      });
    }
  });
  syncQueue = next.catch((error) => console.warn('Could not sync scheduled reminders:', error));
  return next;
}

export async function initializeReminderNotifications(): Promise<void> {
  if (Platform.OS === 'web') return;
  const [subscriptions, recurring, investments, asked] = await Promise.all([
    listSubscriptions(), listRecurringExpenses(), listInvestmentPlans(), StorageService.getItem(PERMISSION_ASKED_KEY),
  ]);
  if (asked !== 'true' && ((subscriptions.length && await remindersEnabled('subscription')) ||
      (recurring.length && await remindersEnabled('recurring')) ||
      (investments.some((item) => item.active) && await remindersEnabled('investment')))) {
    await requestReminderPermission();
  }
  await syncReminderNotifications();
}
