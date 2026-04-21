import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { login } from '../api/client';

type RootStackParamList = {
  Login: undefined;
  LostPets: undefined;
  LostPetDetail: { id: string };
  OwnerDashboard: undefined;
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Login'>;
};

export function LoginScreen({ navigation }: Props): React.JSX.Element {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Ошибка', 'Введите email и пароль');
      return;
    }
    setLoading(true);
    try {
      const tokens = await login({ email, password });
      await navigation.navigate('OwnerDashboard');
    } catch {
      Alert.alert('Ошибка', 'Не удалось войти');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Лапка</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="Пароль"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <Button title={loading ? 'Вход...' : 'Войти'} onPress={handleLogin} disabled={loading} />
      <Button title="Потеряшки (без входа)" onPress={() => navigation.navigate('LostPets')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20 },
  title: { fontSize: 32, fontWeight: 'bold', textAlign: 'center', marginBottom: 40 },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 12, marginBottom: 16, borderRadius: 8 },
});