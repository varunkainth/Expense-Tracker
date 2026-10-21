import {
  decryptBackup,
  encryptBackup,
} from './backup-crypto.service';

const PASSWORD = 'TestBackupPassword123!';
const ORIGINAL_DATA = JSON.stringify({
  hello: 'Payment App',
  amount: 12500,
  currency: 'INR',
});

export async function testBackupCrypto(): Promise<void> {
  console.log('--- Backup Crypto Test ---');

  const encrypted = await encryptBackup(
    ORIGINAL_DATA,
    PASSWORD,
  );

  console.log('Encrypted:', encrypted);

  const decrypted = await decryptBackup(
    encrypted,
    PASSWORD,
  );

  console.log('Decrypted:', decrypted);

  if (decrypted !== ORIGINAL_DATA) {
    throw new Error('Crypto test failed: decrypted data differs.');
  }

  console.log('Correct password: PASS');

  try {
    await decryptBackup(
      encrypted,
      'WrongPassword123!',
    );

    throw new Error(
      'Crypto test failed: wrong password was accepted.',
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('Crypto test failed')
    ) {
      throw error;
    }

    console.log('Wrong password: PASS');
  }

  console.log('--- Backup Crypto Test Passed ---');
}