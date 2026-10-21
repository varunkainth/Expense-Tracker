import { useCallback, useState } from 'react';
import { Alert, Platform, ScrollView, Switch, Text, TouchableOpacity, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Stack, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';
import {
  getReminderTime, notificationPermissionGranted, ReminderKind, remindersEnabled,
  requestReminderPermission, setReminderTime, setRemindersEnabled, syncReminderNotifications,
} from '../../services/reminder-notifications.service';

function dateForTime(time: string): Date {
  const [hour, minute] = time.split(':').map(Number);
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date;
}

function timeForDate(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export default function ReminderSettingsScreen() {
  const { colors } = useTheme();
  const [subscriptionOn, setSubscriptionOn] = useState(true);
  const [recurringOn, setRecurringOn] = useState(true);
  const [investmentOn, setInvestmentOn] = useState(true);
  const [permission, setPermission] = useState(false);
  const [time, setTime] = useState('09:00');
  const [draftTime, setDraftTime] = useState(new Date());
  const [showIosPicker, setShowIosPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    const [subscription, recurring, investment, allowed, savedTime] = await Promise.all([
      remindersEnabled('subscription'), remindersEnabled('recurring'), remindersEnabled('investment'), notificationPermissionGranted(), getReminderTime(),
    ]);
    setSubscriptionOn(subscription);
    setRecurringOn(recurring);
    setInvestmentOn(investment);
    setPermission(allowed);
    setTime(savedTime);
  }, []);
  useFocusEffect(useCallback(() => {
    void refresh().catch((cause) => console.warn('Could not load notification settings:', cause));
  }, [refresh]));

  const update = async (kind: ReminderKind, enabled: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      await setRemindersEnabled(kind, enabled);
      await refresh();
      if (enabled && !await notificationPermissionGranted()) {
        Alert.alert('Notifications are off', 'Allow notifications for Expense Tracker in your phone settings to receive reminders.');
      }
    } catch (cause) {
      console.warn('Could not update notification setting:', cause);
      Alert.alert('Could not update reminders', 'Please try again.');
    } finally { setBusy(false); }
  };

  const enablePermission = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const allowed = await requestReminderPermission();
      if (allowed) await syncReminderNotifications();
      await refresh();
      if (!allowed) Alert.alert('Notifications are off', 'Allow notifications for Expense Tracker in your phone settings to receive reminders.');
    } catch (cause) {
      console.warn('Could not enable notifications:', cause);
      Alert.alert('Could not enable notifications', 'Please try again.');
    } finally { setBusy(false); }
  };

  const saveTime = async (date: Date) => {
    if (busy) return;
    setBusy(true);
    try {
      await setReminderTime(timeForDate(date));
      await refresh();
      setShowIosPicker(false);
    } catch (cause) {
      console.warn('Could not change reminder time:', cause);
      Alert.alert('Could not change reminder time', 'Please try again.');
    } finally { setBusy(false); }
  };

  const chooseTime = () => {
    if (busy || Platform.OS === 'web') return;
    const value = dateForTime(time);
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value, mode: 'time',
        onValueChange: (_event, selected) => { void saveTime(selected); },
      });
    } else {
      setDraftTime(value);
      setShowIosPicker(true);
    }
  };

  const row = (kind: ReminderKind, title: string, detail: string, value: boolean) =>
    <View style={{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>{title}</Text>
        <Text style={{ color: colors.textSecondary, lineHeight: 19 }}>{detail}</Text>
      </View>
      <Switch value={value} disabled={busy || Platform.OS === 'web'} onValueChange={(next) => { void update(kind, next); }} trackColor={{ true: colors.primary, false: colors.surfaceVariant }} accessibilityLabel={`${title} notifications`} />
    </View>;

  return <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
    <Stack.Screen options={{ title: 'Notifications' }} />
    <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
      <Text style={{ color: colors.textSecondary, lineHeight: 21 }}>{Platform.OS === 'web' ? 'Phone reminders are available in the iOS and Android app.' : 'Choose when scheduled payment and investment reminders arrive on this device.'}</Text>
      <View style={{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: 16, gap: 8 }}>
        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>Reminder time</Text>
        <Text style={{ color: colors.textSecondary }}>Applies to subscriptions, recurring expenses, and investments.</Text>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Change reminder time, currently ${dateForTime(time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`} disabled={busy || Platform.OS === 'web'} onPress={chooseTime} style={{ alignSelf: 'flex-start', minHeight: 42, justifyContent: 'center' }}>
          <Text style={{ color: colors.primary, fontSize: 18, fontWeight: '800' }}>{dateForTime(time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}  Change →</Text>
        </TouchableOpacity>
        {showIosPicker && Platform.OS === 'ios' && <View>
          <DateTimePicker value={draftTime} mode="time" display="spinner" onValueChange={(_event, selected) => setDraftTime(selected)} />
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 24, paddingVertical: 8 }}>
            <TouchableOpacity accessibilityRole="button" onPress={() => setShowIosPicker(false)}><Text style={{ color: colors.textSecondary, fontWeight: '700' }}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => { void saveTime(draftTime); }}><Text style={{ color: colors.primary, fontWeight: '800' }}>Save time</Text></TouchableOpacity>
          </View>
        </View>}
      </View>
      {row('subscription', 'Subscriptions', 'One day before and on the payment day.', subscriptionOn)}
      {row('recurring', 'Recurring expenses', 'On the scheduled day. The expense is recorded when you open the app.', recurringOn)}
      {row('investment', 'SIP investments', 'One day before and on the due day. Contributions are recorded only when you confirm them.', investmentOn)}
      {Platform.OS !== 'web' && !permission && <View style={{ backgroundColor: colors.warningBackground, borderRadius: 16, padding: 16, gap: 12 }}>
        <Text style={{ color: colors.text, fontWeight: '700' }}>Phone notifications are off</Text>
        <Text style={{ color: colors.textSecondary, lineHeight: 20 }}>Allow notifications to receive the reminders you enable above.</Text>
        <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => { void enablePermission(); }} style={{ alignSelf: 'flex-start', minHeight: 40, justifyContent: 'center' }}>
          <Text style={{ color: colors.primary, fontWeight: '800' }}>Enable notifications →</Text>
        </TouchableOpacity>
      </View>}
    </ScrollView>
  </SafeAreaView>;
}
