import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  AppearanceMode,
  useTheme,
} from '../../hooks/useTheme';

export default function AppearanceScreen() {
  const {
    colors,
    spacing,
    borderRadius,
    shadows,
    isDark,
    appearanceMode,
    setThemeMode,
  } = useTheme();

  const themeOptions: {
    id: AppearanceMode;
    title: string;
    description: string;
    icon: keyof typeof MaterialIcons.glyphMap;
  }[] = [
    {
      id: 'system',
      title: 'System Default',
      description:
        'Follow system appearance mode settings',
      icon: 'brightness-auto',
    },

    {
      id: 'light',
      title: 'Light Theme',
      description:
        'Clean bright layout with crisp borders',
      icon: 'light-mode',
    },

    {
      id: 'dark',
      title: 'Dark Theme',
      description:
        'Deep slate dark background for night use',
      icon: 'dark-mode',
    },
  ];

  return (
    <SafeAreaView
      edges={['bottom', 'left', 'right']}
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
        },
      ]}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            padding: spacing.base,
          },
        ]}
      >
        <Text
          style={[
            styles.sectionTitle,
            {
              color: colors.textSecondary,
            },
          ]}
        >
          Select Appearance
        </Text>

        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: borderRadius.lg,
              ...shadows.sm,
            },
          ]}
        >
          {themeOptions.map((option, index) => {
            const selected =
              appearanceMode === option.id;

            return (
              <React.Fragment key={option.id}>
                {index > 0 && (
                  <View
                    style={[
                      styles.divider,
                      {
                        backgroundColor: colors.divider,
                      },
                    ]}
                  />
                )}

                <TouchableOpacity
                  style={styles.optionRow}
                  activeOpacity={0.7}
                  onPress={() =>
                    setThemeMode(option.id)
                  }
                >
                  <View
                    style={[
                      styles.iconCircle,
                      {
                        backgroundColor: selected
                          ? colors.primaryLight
                          : colors.surfaceVariant,
                      },
                    ]}
                  >
                    <MaterialIcons
                      name={option.icon}
                      size={22}
                      color={
                        selected
                          ? colors.primary
                          : colors.textSecondary
                      }
                    />
                  </View>

                  <View
                    style={styles.optionTextContainer}
                  >
                    <Text
                      style={[
                        styles.optionTitle,
                        {
                          color: colors.text,
                        },
                      ]}
                    >
                      {option.title}
                    </Text>

                    <Text
                      style={[
                        styles.optionDesc,
                        {
                          color: colors.textSecondary,
                        },
                      ]}
                    >
                      {option.description}
                    </Text>
                  </View>

                  {selected && (
                    <MaterialIcons
                      name="check-circle"
                      size={24}
                      color={colors.primary}
                    />
                  )}
                </TouchableOpacity>
              </React.Fragment>
            );
          })}
        </View>

        <View style={styles.infoBox}>
          <MaterialIcons
            name="info-outline"
            size={20}
            color={colors.textMuted}
          />

          <Text
            style={[
              styles.infoText,
              {
                color: colors.textSecondary,
              },
            ]}
          >
            Current active theme:{' '}
            {isDark ? 'Dark Mode' : 'Light Mode'}
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
    paddingBottom: 32,
  },

  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },

  card: {
    borderWidth: 1,
    overflow: 'hidden',
  },

  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },

  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },

  optionTextContainer: {
    flex: 1,
  },

  optionTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },

  optionDesc: {
    fontSize: 12,
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 70,
  },

  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
    paddingHorizontal: 8,
  },

  infoText: {
    fontSize: 13,
  },
});