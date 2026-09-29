import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { employeeRepository } from '../../repositories/company/employee.repository';
import { EmployeeDetails } from '../../types/company';
import { validateRequiredText } from '../../utils/validation';

export default function EmployeeScreen() {
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const router = useRouter();

  const [existingEmployee, setExistingEmployee] = useState<EmployeeDetails | null>(null);
  const [name, setName] = useState('');
  const [employeeCode, setEmployeeCode] = useState('');
  const [grade, setGrade] = useState('');
  const [department, setDepartment] = useState('');
  const [location, setLocation] = useState('');
  const [mobileNo, setMobileNo] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadEmployee() {
      try {
        const list = await employeeRepository.getAll();
        if (list.length > 0) {
          const emp = list[0];
          setExistingEmployee(emp);
          setName(emp.name);
          setEmployeeCode(emp.employee_code);
          setGrade(emp.grade);
          setDepartment(emp.department);
          setLocation(emp.location);
          setMobileNo(emp.mobile_no ?? '');
        }
      } catch (err) {
        console.error('Error loading employee:', err);
      }
    }
    loadEmployee();
  }, []);

  const handleSave = async () => {
    const vName = validateRequiredText(name, 'Full Name');
    if (!vName.isValid) {
      Alert.alert('Validation Error', vName.error);
      return;
    }

    const vCode = validateRequiredText(employeeCode, 'Employee Code');
    if (!vCode.isValid) {
      Alert.alert('Validation Error', vCode.error);
      return;
    }

    const vGrade = validateRequiredText(grade, 'Grade / Designation');
    if (!vGrade.isValid) {
      Alert.alert('Validation Error', vGrade.error);
      return;
    }

    const vDept = validateRequiredText(department, 'Department');
    if (!vDept.isValid) {
      Alert.alert('Validation Error', vDept.error);
      return;
    }

    const vLoc = validateRequiredText(location, 'Location');
    if (!vLoc.isValid) {
      Alert.alert('Validation Error', vLoc.error);
      return;
    }

    // Mobile is optional — but if provided, sanity-check it's digits only.
    const trimmedMobile = mobileNo.trim();
    if (trimmedMobile.length > 0 && !/^\d{6,15}$/.test(trimmedMobile)) {
      Alert.alert('Validation Error', 'Mobile number must be 6–15 digits.');
      return;
    }

    try {
      setLoading(true);
      if (existingEmployee) {
        await employeeRepository.update(existingEmployee.id, {
          name: name.trim(),
          employee_code: employeeCode.trim(),
          grade: grade.trim(),
          department: department.trim(),
          location: location.trim(),
          mobile_no: trimmedMobile.length > 0 ? trimmedMobile : null,
        });
        Alert.alert('Success', 'Employee details updated successfully.');
      } else {
        await employeeRepository.create({
          name: name.trim(),
          employee_code: employeeCode.trim(),
          grade: grade.trim(),
          department: department.trim(),
          location: location.trim(),
          mobile_no: trimmedMobile.length > 0 ? trimmedMobile : null,
        });
        Alert.alert('Success', 'Employee profile created successfully.');
      }
      router.back();
    } catch (err: any) {
      console.error('Failed to save employee:', err);
      Alert.alert('Error', err?.message || 'Could not save employee profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={[styles.scrollContent, { padding: spacing.base }]}>
          <View style={styles.headerBox}>
            <View style={[styles.avatarBox, { backgroundColor: colors.companyAccent + '20' }]}>
              <MaterialIcons name="person" size={36} color={colors.companyAccent} />
            </View>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              {existingEmployee ? 'Edit Employee Details' : 'Set Up Employee Profile'}
            </Text>
            <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
              This information is referenced by all company expense claims and documents.
            </Text>
          </View>

          <View style={styles.formCard}>
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Full Name *</Text>
              <TextInput
                style={[
                  styles.textInput,
                  { backgroundColor: colors.card, borderColor: colors.border, color: colors.text },
                ]}
                placeholder="e.g. Rajesh Kumar"
                placeholderTextColor={colors.textMuted}
                value={name}
                onChangeText={setName}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Employee Code *</Text>
              <TextInput
                style={[
                  styles.textInput,
                  { backgroundColor: colors.card, borderColor: colors.border, color: colors.text },
                ]}
                placeholder="e.g. EMP-1042"
                placeholderTextColor={colors.textMuted}
                value={employeeCode}
                onChangeText={setEmployeeCode}
                autoCapitalize="characters"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Grade / Designation *</Text>
              <TextInput
                style={[
                  styles.textInput,
                  { backgroundColor: colors.card, borderColor: colors.border, color: colors.text },
                ]}
                placeholder="e.g. Senior Service Engineer"
                placeholderTextColor={colors.textMuted}
                value={grade}
                onChangeText={setGrade}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Department *</Text>
              <TextInput
                style={[
                  styles.textInput,
                  { backgroundColor: colors.card, borderColor: colors.border, color: colors.text },
                ]}
                placeholder="e.g. Customer Support & Field Service"
                placeholderTextColor={colors.textMuted}
                value={department}
                onChangeText={setDepartment}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Base Location *</Text>
              <TextInput
                style={[
                  styles.textInput,
                  { backgroundColor: colors.card, borderColor: colors.border, color: colors.text },
                ]}
                placeholder="e.g. New Delhi"
                placeholderTextColor={colors.textMuted}
                value={location}
                onChangeText={setLocation}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Mobile Number</Text>
              <TextInput
                style={[
                  styles.textInput,
                  { backgroundColor: colors.card, borderColor: colors.border, color: colors.text },
                ]}
                placeholder="e.g. 9876543210"
                placeholderTextColor={colors.textMuted}
                value={mobileNo}
                onChangeText={setMobileNo}
                keyboardType="phone-pad"
                maxLength={15}
              />
            </View>
          </View>
        </ScrollView>

        <View style={[styles.bottomBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[
              styles.saveBtn,
              {
                backgroundColor: colors.primary,
                borderRadius: borderRadius.md,
                opacity: loading ? 0.7 : 1,
              },
            ]}
            onPress={handleSave}
            disabled={loading}
            activeOpacity={0.8}
          >
            <MaterialIcons name="save" size={22} color="#ffffff" />
            <Text style={styles.saveBtnText}>{loading ? 'Saving...' : 'Save Employee Details'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  headerBox: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 8,
  },
  avatarBox: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 18,
  },
  formCard: {
    gap: 16,
  },
  fieldGroup: {},
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    marginLeft: 4,
  },
  textInput: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    fontSize: 15,
  },
  bottomBar: {
    padding: 16,
    borderTopWidth: 1,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});