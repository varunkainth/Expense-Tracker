import React from 'react';
import { Tabs } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabsLayout() {
  const { colors, layout } = useTheme();
  const insets = useSafeAreaInsets();

  const bottomInset = insets.bottom;

  return (
    <Tabs
      backBehavior="none"
      screenOptions={{
        headerShown: false,
        animation: 'fade',

        sceneStyle: {
          backgroundColor: colors.background,
        },

        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.tabBarInactive,

        tabBarStyle: {
          backgroundColor: colors.tabBarBackground,
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,

          height:
            Platform.OS === 'ios'
              ? 60 + bottomInset
              : layout.bottomTabHeight + bottomInset,

          paddingBottom:
            Platform.OS === 'ios'
              ? bottomInset
              : Math.max(bottomInset, 8),

          paddingTop: 8,
        },

        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="personal"
        options={{
          title: 'Personal',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons
              name="account-balance-wallet"
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="company"
        options={{
          title: 'Company',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons
              name="business"
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="split"
        options={{
          title: 'Split',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="currency-exchange" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons
              name="settings"
              size={size}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
