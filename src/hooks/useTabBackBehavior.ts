import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { BackHandler } from 'react-native';

/** Keep Android Back inside tab roots instead of walking tab history. */
export function useTabBackBehavior(onBack?: () => void): void {
  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (onBack) onBack();
      else BackHandler.exitApp();
      return true;
    });
    return () => subscription.remove();
  }, [onBack]));
}
