import { MaterialIcons } from '@expo/vector-icons';
import {
    Modal,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useTheme } from '../../hooks/useTheme';

type AlertIcon =
  | 'lock'
  | 'lock-open'
  | 'warning'
  | 'error'
  | 'check-circle'
  | 'fingerprint'
  | 'info';

type AppAlertProps = {
  visible: boolean;
  title: string;
  message: string;
  icon?: AlertIcon;
  buttonText?: string;
  onClose: () => void;
};

export default function AppAlert({
  visible,
  title,
  message,
  icon = 'info',
  buttonText = 'Okay',
  onClose,
}: AppAlertProps) {
  const { colors } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      {/* Overlay */}
      <View style={styles.overlay}>
        {/* Alert Card */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor: colors.surfaceVariant,
            },
          ]}
        >
          {/* Icon */}
          <View
            style={[
              styles.iconContainer,
              {
                backgroundColor: colors.surfaceVariant,
              },
            ]}
          >
            <MaterialIcons
              name={icon}
              size={30}
              color={colors.text}
            />
          </View>

          {/* Title */}
          <Text
            style={[
              styles.title,
              {
                color: colors.text,
              },
            ]}
          >
            {title}
          </Text>

          {/* Message */}
          <Text
            style={[
              styles.message,
              {
                color: colors.textSecondary,
              },
            ]}
          >
            {message}
          </Text>

          {/* Button */}
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.button,
              {
                backgroundColor: colors.surfaceVariant,
              },
              pressed && styles.buttonPressed,
            ]}
          >
            <Text
              style={[
                styles.buttonText,
                {
                  color: colors.text,
                },
              ]}
            >
              {buttonText}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },

  card: {
    width: '100%',
    maxWidth: 360,
    padding: 24,
    alignItems: 'center',

    borderWidth: 1,
    borderRadius: 24,
  },

  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,

    justifyContent: 'center',
    alignItems: 'center',

    marginBottom: 18,
  },

  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },

  message: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 24,
  },

  button: {
    width: '100%',
    paddingVertical: 14,

    alignItems: 'center',
    justifyContent: 'center',

    borderRadius: 12,
  },

  buttonText: {
    fontSize: 15,
    fontWeight: '700',
  },

  buttonPressed: {
    opacity: 0.7,
  },
});