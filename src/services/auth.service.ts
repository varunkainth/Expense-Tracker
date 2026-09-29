import * as LocalAuthentication from 'expo-local-authentication';

export class AuthService {
  static async hasHardwareSupport(): Promise<boolean> {
    return await LocalAuthentication.hasHardwareAsync();
  }

  static async isEnrolled(): Promise<boolean> {
    return await LocalAuthentication.isEnrolledAsync();
  }

  static async getSupportedBiometricTypes(): Promise<LocalAuthentication.AuthenticationType[]> {
    return await LocalAuthentication.supportedAuthenticationTypesAsync();
  }

  static async authenticate(promptMessage = 'Authenticate to authorize payment'): Promise<boolean> {
    const hasHardware = await this.hasHardwareSupport();
    const isEnrolled = await this.isEnrolled();

    if (!hasHardware || !isEnrolled) {
      return false;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      fallbackLabel: 'Use Passcode',
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });

    return result.success;
  }
}
