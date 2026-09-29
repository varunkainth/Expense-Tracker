import QuickCrypto ,{Buffer} from 'react-native-quick-crypto';

const KDF_ALGORITHM = 'PBKDF2-HMAC-SHA256' as const;
const ENCRYPTION_ALGORITHM = 'AES-256-GCM' as const;

const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const KEY_LENGTH = 32;
const AUTH_TAG_LENGTH = 16;

// Start with a strong iteration count.
// We will benchmark this on the actual phone before finalizing it.
const PBKDF2_ITERATIONS = 600_000;

export interface EncryptedBackup {
  algorithm: typeof ENCRYPTION_ALGORITHM;
  kdf: typeof KDF_ALGORITHM;
  iterations: number;
  salt: string;
  iv: string;
  authTag: string;
  ciphertext: string;
}

function toBase64(buffer: Buffer): string {
  return buffer.toString('base64');
}

function fromBase64(value: string): Buffer {
  return Buffer.from(value, 'base64');
}

function deriveKey(password: string, salt: Buffer): Buffer {
  return QuickCrypto.pbkdf2Sync(
    password,
    salt,
    PBKDF2_ITERATIONS,
    KEY_LENGTH,
    'sha256',
  );
}

export function encryptBackup(
  plaintext: string,
  password: string,
): EncryptedBackup {
  if (!password) {
    throw new Error('Backup password is required.');
  }

  if (password.length < 8) {
    throw new Error(
      'Backup password must be at least 8 characters long.',
    );
  }

  const salt = QuickCrypto.randomBytes(SALT_LENGTH);
  const iv = QuickCrypto.randomBytes(IV_LENGTH);

  const key = deriveKey(password, salt);

  const cipher = QuickCrypto.createCipheriv(
    'aes-256-gcm',
    key,
    iv,
  );

  const encrypted = Buffer.concat([
    cipher.update(Buffer.from(plaintext, 'utf8')),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error('Unexpected AES-GCM authentication tag length.');
  }

  return {
    algorithm: ENCRYPTION_ALGORITHM,
    kdf: KDF_ALGORITHM,
    iterations: PBKDF2_ITERATIONS,
    salt: toBase64(salt),
    iv: toBase64(iv),
    authTag: toBase64(authTag),
    ciphertext: toBase64(encrypted),
  };
}

export function decryptBackup(
  encryptedBackup: EncryptedBackup,
  password: string,
): string {
  if (!password) {
    throw new Error('Backup password is required.');
  }

  if (encryptedBackup.algorithm !== ENCRYPTION_ALGORITHM) {
    throw new Error('Unsupported backup encryption algorithm.');
  }

  if (encryptedBackup.kdf !== KDF_ALGORITHM) {
    throw new Error('Unsupported backup key derivation algorithm.');
  }

  if (encryptedBackup.iterations !== PBKDF2_ITERATIONS) {
    throw new Error('Unsupported backup KDF parameters.');
  }

  const salt = fromBase64(encryptedBackup.salt);
  const iv = fromBase64(encryptedBackup.iv);
  const authTag = fromBase64(encryptedBackup.authTag);
  const ciphertext = fromBase64(encryptedBackup.ciphertext);

  if (salt.length !== SALT_LENGTH) {
    throw new Error('Invalid backup salt.');
  }

  if (iv.length !== IV_LENGTH) {
    throw new Error('Invalid backup IV.');
  }

  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error('Invalid backup authentication tag.');
  }

  const key = deriveKey(password, salt);

  try {
    const decipher = QuickCrypto.createDecipheriv(
      'aes-256-gcm',
      key,
      iv,
    );

    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  } catch {
    throw new Error(
      'Unable to decrypt backup. The password may be incorrect or the backup may be corrupted.',
    );
  }
}