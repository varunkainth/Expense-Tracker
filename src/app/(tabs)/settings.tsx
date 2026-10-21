import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';
import { useTabBackBehavior } from '../../hooks/useTabBackBehavior';

export default function SettingsScreen() {
  useTabBackBehavior();
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const router = useRouter();

  const settingSections = [
    {
      title: 'Preferences',
      items: [
        {
          id: 'categories',
          title: 'Expense Categories',
          subtitle: 'Add or remove personal expense categories',
          icon: 'category',
          iconColor: '#f97316',
          route: '/settings/categories',
        },
        {
          id: 'budgets',
          title: 'Category Budgets',
          subtitle: 'Set monthly limits for each expense category',
          icon: 'account-balance-wallet',
          iconColor: '#4f46e5',
          route: '/settings/budgets',
        },
        {
          id: 'insights',
          title: 'Spending Insights',
          subtitle: 'Explore personal spending patterns',
          icon: 'insights',
          iconColor: '#6366f1',
          route: '/insights',
        },
        {
          id: 'recurring',
          title: 'Recurring Expenses',
          subtitle: 'Manage monthly bills that record automatically',
          icon: 'repeat',
          iconColor: '#0ea5e9',
          route: '/settings/recurring',
        },
        {
          id: 'upcoming',
          title: 'Upcoming Payments',
          subtitle: 'SIPs, subscriptions, and recurring expenses together',
          icon: 'event',
          iconColor: '#0891b2',
          route: '/settings/upcoming',
        },
        {
          id: 'subscriptions',
          title: 'Subscriptions',
          subtitle: 'Confirm monthly payments on their due date',
          icon: 'subscriptions',
          iconColor: '#db2777',
          route: '/settings/subscriptions',
        },
        {
          id: 'investments',
          title: 'Investments & SIPs',
          subtitle: 'Track monthly contributions separately from spending',
          icon: 'trending-up',
          iconColor: '#059669',
          route: '/settings/investments',
        },
        {
          id: 'notifications',
          title: 'Notifications',
          subtitle: 'Scheduled payment and SIP reminders',
          icon: 'notifications-active',
          iconColor: '#f59e0b',
          route: '/settings/notifications',
        },
        {
          id: 'appearance',
          title: 'Appearance',
          subtitle: 'Light, Dark, and System theme',
          icon: 'palette',
          iconColor: '#8b5cf6',
          route: '/settings/appearance',
        },
        {
          id: 'security',
          title: 'Security & App Lock',
          subtitle: 'Biometric authentication and device lock',
          icon: 'fingerprint',
          iconColor: '#10b981',
          route: '/settings/security',
        },
        {
          id: 'daily_allowance_rates',
          title: 'Daily Allowance Rates',
          subtitle: 'Configure Travel and Food DA rates (₹400 / ₹600)',
          icon: 'monetization-on',
          iconColor: '#4f46e5',
          route: '/settings/daily-allowance-rates',
        },
      ],
    },
    {
      title: 'Data & Storage',
      items: [
        {
          id: 'backup',
          title: 'Backup & Restore',
          subtitle: 'Complete offline database backup and recovery',
          icon: 'cloud-download',
          iconColor: '#3b82f6',
          route: '/settings/backup',
        },
        {
          id: 'data',
          title: 'Export',
          subtitle: 'Export expense data to portable formats',
          icon: 'import-export',
          iconColor: '#f59e0b',
          route: '/settings/data',
        },
      ],
    },
  ];


  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={[styles.scrollContent, { padding: spacing.base }]}>
        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Settings</Text>
        </View>

        {/* Setting Sections */}
        {settingSections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{section.title}</Text>
            <View
              style={[
                styles.sectionCard,
                {
                  backgroundColor: colors.card,
                  borderRadius: borderRadius.lg,
                  borderColor: colors.border,
                  ...shadows.sm,
                },
              ]}
            >
              {section.items.map((item, index) => (
                <React.Fragment key={item.id}>
                  {index > 0 && <View style={[styles.divider, { backgroundColor: colors.divider }]} />}
                  <TouchableOpacity
                    style={styles.settingItem}
                    onPress={() => router.push(item.route as any)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.settingIconCircle, { backgroundColor: item.iconColor + '15' }]}>
                      <MaterialIcons name={item.icon as any} size={22} color={item.iconColor} />
                    </View>
                    <View style={styles.settingTextContainer}>
                      <Text style={[styles.settingTitle, { color: colors.text }]}>{item.title}</Text>
                      <Text style={[styles.settingSubtitle, { color: colors.textSecondary }]}>
                        {item.subtitle}
                      </Text>
                    </View>
                    <MaterialIcons name="chevron-right" size={22} color={colors.textMuted} />
                  </TouchableOpacity>
                </React.Fragment>
              ))}
            </View>
          </View>
        ))}

        {/* Version Note */}
        <View style={styles.versionContainer}>
          <Text style={[styles.versionText, { color: colors.textMuted }]}>
            Expense Tracker • V2.0.0 • Local-First
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  headerRow: {
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionCard: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  settingIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  settingTextContainer: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 12,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 68,
  },
  versionContainer: {
    alignItems: 'center',
    marginTop: 24,
  },
  versionText: {
    fontSize: 12,
  },
});
