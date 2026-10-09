import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { formatPaiseToRupees } from '../utils/currency';

export default function CompanyExpenseTotalCard({ title, total, count }: { title: string; total: number; count: number }) {
  const { colors, borderRadius, shadows } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.companyAccent, borderRadius: borderRadius.lg, ...shadows.md }]}>
      <View style={styles.copy}>
        <Text style={styles.eyebrow}>{title.toUpperCase()}</Text>
        <Text style={styles.amount}>{formatPaiseToRupees(total)}</Text>
        <Text style={styles.caption}>{count} {count === 1 ? 'entry' : 'entries'} recorded</Text>
      </View>
      <View style={styles.icon}><MaterialIcons name="account-balance-wallet" size={24} color="#fff" /></View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { minHeight: 118, padding: 20, marginBottom: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  copy: { gap: 5 },
  eyebrow: { color: 'rgba(255,255,255,0.78)', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  amount: { color: '#fff', fontSize: 28, fontWeight: '800' },
  caption: { color: 'rgba(255,255,255,0.82)', fontSize: 13, fontWeight: '500' },
  icon: { width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
});
