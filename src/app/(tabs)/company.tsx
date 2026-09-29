import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { employeeRepository } from '../../repositories/company/employee.repository';
import { EmployeeDetails } from '../../types/company';
import { COMPANY_EXPENSE_TYPES } from '../../constants/company-expenses';

export default function CompanyScreen() {
  const { colors, spacing, borderRadius, shadows, isDark } = useTheme();
  const router = useRouter();

  const [activeEmployee, setActiveEmployee] = useState<EmployeeDetails | null>(null);

  const loadEmployee = useCallback(async () => {
    try {
      const allEmployees = await employeeRepository.getAll();
      if (allEmployees.length > 0) {
        setActiveEmployee(allEmployees[0]);
      } else {
        setActiveEmployee(null);
      }
    } catch (error) {
      console.error('Error loading employee:', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadEmployee();
    }, [loadEmployee])
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={[styles.scrollContent, { padding: spacing.base }]}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.headerGreeting, { color: colors.textSecondary }]}>Company Tracker</Text>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Work Expenses</Text>
          </View>
          <TouchableOpacity
            style={[styles.employeeBtn, { backgroundColor: colors.surfaceVariant, borderRadius: borderRadius.full }]}
            onPress={() => router.push('/(company)/employee')}
            activeOpacity={0.7}
          >
            <MaterialIcons name="person" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Active Employee Banner */}
        <TouchableOpacity
          style={[
            styles.employeeCard,
            {
              backgroundColor: colors.card,
              borderRadius: borderRadius.lg,
              borderColor: colors.border,
              ...shadows.sm,
            },
          ]}
          onPress={() => router.push('/(company)/employee')}
          activeOpacity={0.8}
        >
          <View style={[styles.employeeAvatar, { backgroundColor: colors.companyAccent + '20' }]}>
            <MaterialIcons name="badge" size={26} color={colors.companyAccent} />
          </View>
          <View style={styles.employeeInfo}>
            {activeEmployee ? (
              <>
                <Text style={[styles.employeeName, { color: colors.text }]}>{activeEmployee.name}</Text>
                <Text style={[styles.employeeSub, { color: colors.textSecondary }]}>
                  {activeEmployee.employee_code} • {activeEmployee.department} ({activeEmployee.location})
                </Text>
              </>
            ) : (
              <>
                <Text style={[styles.employeeName, { color: colors.text }]}>No Employee Selected</Text>
                <Text style={[styles.employeeSub, { color: colors.primary }]}>
                  Tap to set up employee details
                </Text>
              </>
            )}
          </View>
          <MaterialIcons name="chevron-right" size={24} color={colors.textMuted} />
        </TouchableOpacity>

        {/* Section Header */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Expense Categories</Text>
        </View>

        {/* 7 Company Expense Types List */}
        <View style={styles.categoryList}>
          {COMPANY_EXPENSE_TYPES.map((type) => {
            const iconColor = isDark ? type.color.dark : type.color.light;
            const iconBg = isDark ? type.bgColor.dark : type.bgColor.light;

            return (
              <TouchableOpacity
                key={type.key}
                style={[
                  styles.categoryCard,
                  {
                    backgroundColor: colors.card,
                    borderRadius: borderRadius.md,
                    borderColor: colors.border,
                    ...shadows.sm,
                  },
                ]}
                onPress={() => router.push(type.route as any)}
                activeOpacity={0.7}
              >
                <View style={[styles.categoryIconCircle, { backgroundColor: iconBg }]}>
                  <MaterialIcons name={type.icon as any} size={24} color={iconColor} />
                </View>

                <View style={styles.categoryTextContainer}>
                  <Text style={[styles.categoryTitle, { color: colors.text }]}>{type.label}</Text>
                  <Text style={[styles.categoryDesc, { color: colors.textSecondary }]} numberOfLines={1}>
                    {type.description}
                  </Text>
                </View>

                <MaterialIcons name="chevron-right" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            );
          })}
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
    paddingBottom: 32,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerGreeting: {
    fontSize: 13,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
  },
  employeeBtn: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  employeeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
  },
  employeeAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  employeeInfo: {
    flex: 1,
  },
  employeeName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  employeeSub: {
    fontSize: 13,
    fontWeight: '400',
  },
  sectionHeader: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  categoryList: {
    gap: 10,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderWidth: 1,
  },
  categoryIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  categoryTextContainer: {
    flex: 1,
  },
  categoryTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  categoryDesc: {
    fontSize: 12,
  },
});
