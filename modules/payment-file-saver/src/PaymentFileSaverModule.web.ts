import { registerWebModule, NativeModule } from 'expo';

class PaymentFileSaverModule extends NativeModule<{}> {}

export default registerWebModule(PaymentFileSaverModule, 'PaymentFileSaverModule');
