import { useCallback, useState } from 'react';
import { Alert, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { router, Stack, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';
import { deleteSubscription, listSubscriptions, Subscription } from '../../repositories/subscription.repository';
import { formatPaiseToRupees } from '../../utils/currency';
import { formatDate } from '../../utils/date';
import { syncReminderNotifications } from '../../services/reminder-notifications.service';

export default function SubscriptionsScreen() {
  const { colors } = useTheme();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [subscriptionToRemove, setSubscriptionToRemove] = useState<Subscription | null>(null);
  const [removing, setRemoving] = useState(false);
  const refresh = useCallback(async () => {
    try { setSubscriptions(await listSubscriptions()); setError(null); }
    catch { setError('Could not load subscriptions. Please reopen this screen.'); }
  }, []);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  const confirmRemove = async () => {
    if (!subscriptionToRemove || removing) return;
    setRemoving(true);
    try {
      await deleteSubscription(subscriptionToRemove.id);
      await syncReminderNotifications().catch((cause) => console.warn('Could not update subscription reminders:', cause));
      setSubscriptionToRemove(null);
      await refresh();
    } catch {
      Alert.alert('Could not remove subscription', 'Please try again.');
    } finally {
      setRemoving(false);
    }
  };
  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ title: 'Subscriptions' }} />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        <Text style={{ color: colors.textSecondary, lineHeight: 22 }}>
          Add a monthly due day, such as the 4th for YouTube Premium. On that day, the app asks you to confirm before recording the payment.
        </Text>
        <TouchableOpacity accessibilityRole="button" onPress={() => router.push({ pathname: '/(personal)/add-expense', params: { subscription: 'true' } })}
          style={{ backgroundColor: colors.primary, padding: 15, borderRadius: 12 }}>
          <Text style={{ color: colors.textInverse, textAlign: 'center', fontWeight: '700' }}>Add subscription</Text>
        </TouchableOpacity>
        {error && <Text style={{ color: colors.danger }}>{error}</Text>}
        {!error && subscriptions.length === 0 && <Text style={{ color: colors.textSecondary }}>No subscriptions yet. Add YouTube Premium, Netflix, or any regular payment.</Text>}
        {subscriptions.map((subscription) => <View key={subscription.id} style={{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 16, gap: 8 }}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>{subscription.name}</Text>
          <Text style={{ color: colors.text }}>{formatPaiseToRupees(subscription.amount)} · {subscription.payment_method}</Text>
          <Text style={{ color: colors.textSecondary }}>Due on the {subscription.day_of_month}{ordinalSuffix(subscription.day_of_month)} · next reminder {formatDate(subscription.next_due)}</Text>
          <TouchableOpacity accessibilityRole="button" onPress={() => router.push({ pathname: '/settings/subscriptions/[id]', params: { id: subscription.id } })} style={{ paddingVertical: 8 }}>
            <Text style={{ color: colors.primary, fontWeight: '700' }}>Review payment →</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" onPress={() => setSubscriptionToRemove(subscription)} style={{ paddingVertical: 10 }}>
            <Text style={{ color: colors.danger }}>Remove subscription</Text>
          </TouchableOpacity>
        </View>)}
      </ScrollView>

      <Modal
        visible={subscriptionToRemove !== null}
        transparent
        animationType="fade"
        onRequestClose={() => !removing && setSubscriptionToRemove(null)}
      >
        <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0, 0, 0, 0.48)' }}>
          <View style={{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 20, padding: 20, gap: 16 }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.dangerBackground }}>
              <Text style={{ color: colors.danger, fontSize: 24, fontWeight: '700' }}>×</Text>
            </View>
            <View style={{ gap: 6 }}>
              <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700' }}>Remove subscription?</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 21 }}>
                {subscriptionToRemove && `${subscriptionToRemove.name} will no longer send a monthly payment reminder.`}
              </Text>
            </View>
            <View style={{ padding: 12, borderRadius: 12, backgroundColor: colors.surfaceVariant, gap: 3 }}>
              <Text style={{ color: colors.text, fontWeight: '700' }}>{subscriptionToRemove && formatPaiseToRupees(subscriptionToRemove.amount)}</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Past expenses will remain in your history.</Text>
            </View>
            <View style={{ gap: 10 }}>
              <TouchableOpacity
                accessibilityRole="button"
                disabled={removing}
                onPress={confirmRemove}
                style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.danger, opacity: removing ? 0.65 : 1 }}
              >
                <Text style={{ color: colors.textInverse, fontWeight: '700' }}>{removing ? 'Removing…' : 'Remove subscription'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                disabled={removing}
                onPress={() => setSubscriptionToRemove(null)}
                style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: colors.border }}
              >
                <Text style={{ color: colors.text, fontWeight: '700' }}>Keep subscription</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function ordinalSuffix(day: number): string {
  if (day % 100 >= 11 && day % 100 <= 13) return 'th';
  return ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[day % 10] ?? 'th';
}
