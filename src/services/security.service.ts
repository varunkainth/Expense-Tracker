import * as SecureStore from 'expo-secure-store';

const APP_LOCK_KEY = 'payment_app_lock_enabled';

export class SecurityService {
  static async isAppLockEnabled(): Promise<boolean> {
    try {
      const value = await SecureStore.getItemAsync(APP_LOCK_KEY);

      return value === 'true';
    } catch (error) {
      console.error(
        'Error reading App Lock setting:',
        error,
      );

      return false;
    }
  }

  static async setAppLockEnabled(
    enabled: boolean,
  ): Promise<void> {
    try {
      await SecureStore.setItemAsync(
        APP_LOCK_KEY,
        enabled ? 'true' : 'false',
      );
    } catch (error) {
      console.error(
        'Error saving App Lock setting:',
        error,
      );

      throw error;
    }
  }
}