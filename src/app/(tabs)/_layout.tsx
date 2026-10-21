import React, { useEffect, useRef, useState } from 'react';
import { Tabs } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { AccessibilityInfo, Animated, ColorValue, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type TabName = 'personal' | 'company' | 'split' | 'settings';

function TabIcon({ name, color, size, pulse, reduceMotion }: {
  name: keyof typeof MaterialIcons.glyphMap;
  color: ColorValue;
  size: number;
  pulse: number;
  reduceMotion: boolean;
}) {
  const [scale] = useState(() => new Animated.Value(1));
  const lastPulse = useRef(pulse);

  useEffect(() => {
    if (reduceMotion) {
      scale.stopAnimation();
      scale.setValue(1);
      lastPulse.current = pulse;
      return;
    }
    if (pulse === lastPulse.current) return;
    lastPulse.current = pulse;

    const animation = Animated.sequence([
      Animated.timing(scale, { toValue: 0.86, duration: 85, useNativeDriver: true, isInteraction: false }),
      Animated.spring(scale, { toValue: 1, friction: 6, tension: 140, useNativeDriver: true, isInteraction: false }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [pulse, reduceMotion, scale]);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <MaterialIcons name={name} size={size} color={color} />
    </Animated.View>
  );
}

export default function TabsLayout() {
  const { colors, layout } = useTheme();
  const insets = useSafeAreaInsets();
  const [tap, setTap] = useState<{ name: TabName | null; count: number }>({ name: null, count: 0 });
  const [reduceMotion, setReduceMotion] = useState(true);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => { if (mounted) setReduceMotion(enabled); })
      .catch((error) => console.warn('Could not read reduce motion setting:', error));
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { mounted = false; subscription.remove(); };
  }, []);

  const pulseFor = (name: TabName) => tap.name === name ? tap.count : 0;
  const onTabPress = (name: TabName) => setTap((previous) => ({ name, count: previous.count + 1 }));

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
        listeners={{ tabPress: () => onTabPress('personal') }}
        options={{
          title: 'Personal',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="account-balance-wallet" size={size} color={color} pulse={pulseFor('personal')} reduceMotion={reduceMotion} />
          ),
        }}
      />

      <Tabs.Screen
        name="company"
        listeners={{ tabPress: () => onTabPress('company') }}
        options={{
          title: 'Company',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="business" size={size} color={color} pulse={pulseFor('company')} reduceMotion={reduceMotion} />
          ),
        }}
      />

      <Tabs.Screen
        name="split"
        listeners={{ tabPress: () => onTabPress('split') }}
        options={{
          title: 'Split',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="currency-exchange" size={size} color={color} pulse={pulseFor('split')} reduceMotion={reduceMotion} />
          ),
        }}
      />

      <Tabs.Screen
        name="settings"
        listeners={{ tabPress: () => onTabPress('settings') }}
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="settings" size={size} color={color} pulse={pulseFor('settings')} reduceMotion={reduceMotion} />
          ),
        }}
      />
    </Tabs>
  );
}
