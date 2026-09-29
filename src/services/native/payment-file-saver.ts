import PaymentFileSaver from '../../../modules/payment-file-saver/src/PaymentFileSaverModule';

export async function saveFileWithAndroidPicker(
  filename: string,
  content: string,
): Promise<string> {
  return await PaymentFileSaver.saveFile(
    filename,
    'application/octet-stream',
    content,
  );
}