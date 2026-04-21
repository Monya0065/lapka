import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TextInput, Button, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getLostPets } from '../api/client';

type RootStackParamList = {
  Login: undefined;
  LostPets: undefined;
  LostPetDetail: { id: string };
  OwnerDashboard: undefined;
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'LostPets'>;
};

interface LostPet {
  id: string;
  title: string;
  description: string;
  pet_type: string;
  city: string;
  status: string;
}

export function LostPetsScreen({ navigation }: Props): React.JSX.Element {
  const [pets, setPets] = useState<LostPet[]>([]);
  const [loading, setLoading] = useState(true);
  const [city, setCity] = useState('');
  const [status, setStatus] = useState('');

  const fetchPets = async () => {
    setLoading(true);
    try {
      const data = (await getLostPets({ city: city || undefined, status: status || undefined })) as LostPet[];
      setPets(data);
    } catch {
      setPets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPets();
  }, []);

  const renderItem = ({ item }: { item: LostPet }) => (
    <TouchableOpacity style={styles.item} onPress={() => navigation.navigate('LostPetDetail', { id: item.id })}>
      <Text style={styles.itemTitle}>{item.title}</Text>
      <Text>{item.pet_type} • {item.city}</Text>
      <Text style={styles.status}>{item.status}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.filters}>
        <TextInput
          style={styles.input}
          placeholder="Город"
          value={city}
          onChangeText={setCity}
        />
        <TextInput
          style={styles.input}
          placeholder="Статус (active/resolved)"
          value={status}
          onChangeText={setStatus}
        />
        <Button title="Поиск" onPress={fetchPets} />
      </View>
      {loading ? (
        <ActivityIndicator size="large" />
      ) : (
        <FlatList
          data={pets}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListEmptyComponent={<Text style={styles.empty}>Нет объявлений</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  input: { flex: 1, minWidth: 120, borderWidth: 1, borderColor: '#ccc', padding: 8, borderRadius: 8 },
  item: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  itemTitle: { fontSize: 18, fontWeight: 'bold' },
  status: { color: '#666', marginTop: 4 },
  empty: { textAlign: 'center', color: '#666', marginTop: 40 },
});