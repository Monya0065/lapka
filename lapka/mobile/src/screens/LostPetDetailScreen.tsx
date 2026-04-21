import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TextInput, Button, Alert } from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { getLostPetDetail } from '../api/client';

type RootStackParamList = {
  Login: undefined;
  LostPets: undefined;
  LostPetDetail: { id: string };
  OwnerDashboard: undefined;
};

type Props = {
  route: RouteProp<RootStackParamList, 'LostPetDetail'>;
};

interface LostPet {
  id: string;
  title: string;
  description: string;
  pet_type: string;
  city: string;
  status: string;
  created_at?: string;
}

export function LostPetDetailScreen({ route }: Props): React.JSX.Element {
  const { id } = route.params;
  const [pet, setPet] = useState<LostPet | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [location, setLocation] = useState('');

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const data = (await getLostPetDetail(id)) as LostPet;
        setPet(data);
      } catch {
        Alert.alert('Ошибка', 'Не удалось загрузить объявление');
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [id]);

  if (loading) return <ActivityIndicator size="large" style={styles.container} />;
  if (!pet) return <View style={styles.container}><Text>Объект не найден</Text></View>;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{pet.title}</Text>
      <Text style={styles.type}>{pet.pet_type} • {pet.city}</Text>
      <Text style={styles.status}>Статус: {pet.status}</Text>
      <Text style={styles.description}>{pet.description}</Text>
      {pet.created_at && <Text style={styles.date}>Создано: {new Date(pet.created_at).toLocaleDateString('ru')}</Text>}
      
      <View style={styles.sightingForm}>
        <Text style={styles.sectionTitle}>Сообщить о местонахождении</Text>
        <TextInput
          style={styles.input}
          placeholder="Сообщение"
          value={message}
          onChangeText={setMessage}
          multiline
        />
        <TextInput
          style={styles.input}
          placeholder="Местонахождение"
          value={location}
          onChangeText={setLocation}
        />
        <Button title="Отправить" onPress={() => Alert.alert('Спасибо!', 'Информация отправлена')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
  type: { fontSize: 16, color: '#666', marginBottom: 4 },
  status: { fontSize: 14, color: '#090', marginBottom: 16 },
  description: { fontSize: 16, lineHeight: 24, marginBottom: 16 },
  date: { fontSize: 12, color: '#999', marginBottom: 24 },
  sightingForm: { marginTop: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#eee' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 12, marginBottom: 12, borderRadius: 8, minHeight: 60 },
});