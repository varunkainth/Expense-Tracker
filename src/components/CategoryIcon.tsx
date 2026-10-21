import { MaterialIcons } from '@expo/vector-icons';
import { Text } from 'react-native';
import { isEmojiIcon } from '../utils/category-icon';

export default function CategoryIcon({ icon, size, color }: { icon: string | null | undefined; size: number; color: string }) {
  if (isEmojiIcon(icon)) {
    return <Text style={{ fontSize: size, lineHeight: size * 1.25, textAlign: 'center' }}>{icon}</Text>;
  }

  const name = icon && Object.prototype.hasOwnProperty.call(MaterialIcons.glyphMap, icon)
    ? icon as keyof typeof MaterialIcons.glyphMap
    : 'category';
  return <MaterialIcons name={name} size={size} color={color} />;
}
