import React from 'react';
import { Image, StyleSheet, TouchableOpacity, ViewStyle, StyleProp } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { User } from 'lucide-react-native';
import { V2 } from './theme';
import { useAuth } from '../../../context/AuthContext';
import { RootStackParamList } from '../../../types/navigation';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Home'>;

interface ProfileAvatarButtonProps {
  size?: number;
  style?: StyleProp<ViewStyle>;
}

// Circular profile/avatar button for the HomeScreenV2 header. Mirrors v1's
// HomeScreen profile button behavior (Profile when logged in, Login when out)
// but styled to the V2 palette. Default size matches the 48-tall search pill.
export const ProfileAvatarButton: React.FC<ProfileAvatarButtonProps> = ({
  size = 48,
  style,
}) => {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();

  const handlePress = () => {
    if (user) navigation.navigate('Profile');
    else navigation.navigate('Login');
  };

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={handlePress}
      style={[
        styles.button,
        { width: size, height: size, borderRadius: size / 2 },
        style,
      ]}
    >
      {user?.avatarUrl ? (
        <Image
          source={{ uri: user.avatarUrl }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          resizeMode="cover"
        />
      ) : (
        <User size={22} color={user ? V2.text : V2.textMuted} strokeWidth={2} />
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: V2.surface,
    borderWidth: 1,
    borderColor: V2.borderHi,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
