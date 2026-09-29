import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  decryptBackup,
  encryptBackup,
} from '../services/security/backup-crypto.service';

export default function CryptoTestScreen() {
  const [result, setResult] = useState('Not tested');

  const runTest = () => {
    try {
      const password = 'TestBackupPassword123!';

      const originalData = JSON.stringify({
        message: 'Payment App crypto test',
        amount: 12500,
        currency: 'INR',
      });

      // 1. Encrypt
      const encrypted = encryptBackup(
        originalData,
        password,
      );

      console.log(
        'Encrypted backup:',
        encrypted,
      );

      // 2. Decrypt using correct password
      const decrypted = decryptBackup(
        encrypted,
        password,
      );

      if (decrypted !== originalData) {
        throw new Error(
          'Decrypted data does not match original data.',
        );
      }

      // 3. Wrong password must fail
      let wrongPasswordRejected = false;

      try {
        decryptBackup(
          encrypted,
          'WrongPassword123!',
        );
      } catch {
        wrongPasswordRejected = true;
      }

      if (!wrongPasswordRejected) {
        throw new Error(
          'Security failure: wrong password was accepted.',
        );
      }

      // 4. Tampered backup must fail
      let tamperedBackupRejected = false;

      try {
        const tamperedBackup = {
          ...encrypted,
          ciphertext:
            encrypted.ciphertext.slice(0, -2) +
            (encrypted.ciphertext.slice(-2) === 'AA'
              ? 'BB'
              : 'AA'),
        };

        decryptBackup(
          tamperedBackup,
          password,
        );
      } catch {
        tamperedBackupRejected = true;
      }

      if (!tamperedBackupRejected) {
        throw new Error(
          'Security failure: tampered backup was accepted.',
        );
      }

      // All tests passed
      setResult(
        'PASS\n\n' +
          '✓ Encryption successful\n' +
          '✓ Correct password decrypted successfully\n' +
          '✓ Wrong password rejected\n' +
          '✓ Tampered backup rejected',
      );

      Alert.alert(
        'Crypto Test Passed',
        'All encryption and integrity tests passed.',
      );
    } catch (error) {
      console.error(
        'Crypto test failed:',
        error,
      );

      const message =
        error instanceof Error
          ? error.message
          : 'Unknown crypto error';

      setResult(
        `FAILED\n\n${message}`,
      );

      Alert.alert(
        'Crypto Test Failed',
        message,
      );
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
    >
      <Text style={styles.title}>
        Backup Crypto Test
      </Text>

      <Text style={styles.description}>
        This is a temporary development test for
        AES-256-GCM backup encryption.
      </Text>

      <Pressable
        onPress={runTest}
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
        ]}
      >
        <Text style={styles.buttonText}>
          Run Crypto Test
        </Text>
      </Pressable>

      <View style={styles.resultContainer}>
        <Text style={styles.resultTitle}>
          Result
        </Text>

        <Text style={styles.result}>
          {result}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },

  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 12,
  },

  description: {
    fontSize: 16,
    marginBottom: 24,
  },

  button: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#000000',
    alignItems: 'center',
  },

  buttonPressed: {
    opacity: 0.7,
  },

  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },

  resultContainer: {
    marginTop: 32,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#eeeeee',
  },

  resultTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },

  result: {
    fontSize: 15,
    lineHeight: 24,
  },
});