import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, ScrollView } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';

type RootStackParamList = {
  Login: undefined;
  LostPets: undefined;
  LostPetDetail: { id: string };
  OwnerDashboard: undefined;
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'OwnerDashboard'>;
};

export function OwnerDashboardScreen({ navigation }: Props): React.JSX.Element {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [petType, setPetType] = useState('');
  const [city, setCity] = useState('');
  const [saving, setSaving] = useState(false);

  const handleCreateLostPet = async () => {
    if (!title || !description || !petType || !city) {
      Alert.alert('Ошибка', 'Заполните все поля');
      return;
    }
    setSaving(true);
    try {
      Alert.alert('Готово', 'Объявление создано');
      setTitle('');
      setDescription('');
      setPetType('');
      setCity('');
    } catch {
      Alert.alert('Ошибка', 'Не удалось создать объявление');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>Мои питомцы</Text>
      
      <Button title="Мои питомцы" onPress={() => {}} />
      <Button title="Потеряшки" onPress={() => navigation.navigate('LostPets')} />
      <Button title="Документы" onPress={() => {}} />
      <Button title="Визиты" onPress={() => {}} />
      
      <View style={styles.form}>
        <Text style={styles.title}>Создать объявление о пропаже</Text>
        <TextInput
          style={styles.input}
          placeholder="Название (напр. Кот Барсик)"
          value={title}
          onChangeText={setTitle}
        />
        <TextInput
          style={styles.input}
          placeholder="Описание"
          value={description}
          onChangeText={setDescription}
          multiline
        />
        <TextInput
          style={styles.input}
          placeholder="Тип (cat/dog/bird)"
          value={petType}
          onChangeText={setPetType}
        />
        <TextInput
          style={styles.input}
          placeholder="Город"
          value={city}
          onChangeText={setCity}
        />
        <Button title={saving ? 'Создание...' : 'Создать объявление'} onPress={handleCreateLostPet} disabled={saving} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  form: { marginTop: 32, padding: 16, backgroundColor: '#f9f9f9', borderRadius: 12 },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 12, marginBottom: 12, borderRadius: 8 },
});