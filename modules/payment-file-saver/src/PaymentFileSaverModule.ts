import { requireNativeModule } from 'expo-modules-core';

export interface PaymentFileSaverModule {
  saveFile(
    filename: string,
    mimeType: string,
    content: string,
  ): Promise<string>;
}

export default requireNativeModule<PaymentFileSaverModule>(
  'PaymentFileSaver',
);