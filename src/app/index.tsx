// app/index.tsx
import { Redirect } from 'expo-router';
import { View } from 'react-native';

export default function RootIndex() {
  // Render nothing visible — just an immediate redirect.
  // The splash overlay covers this if it's ever mounted.
  return (
    <View style={{ flex: 1 }}>
      <Redirect href="/(tabs)/personal" />
    </View>
  );
}