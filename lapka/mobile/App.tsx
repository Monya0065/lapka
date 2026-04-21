import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LoginScreen } from './src/screens/LoginScreen';
import { LostPetsScreen } from './src/screens/LostPetsScreen';
import { LostPetDetailScreen } from './src/screens/LostPetDetailScreen';
import { OwnerDashboardScreen } from './src/screens/OwnerDashboardScreen';

type RootStackParamList = {
  Login: undefined;
  LostPets: undefined;
  LostPetDetail: { id: string };
  OwnerDashboard: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Login">
          <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Вход' }} />
          <Stack.Screen name="LostPets" component={LostPetsScreen} options={{ title: 'Потеряшки' }} />
          <Stack.Screen name="LostPetDetail" component={LostPetDetailScreen} options={{ title: 'Объявление' }} />
          <Stack.Screen name="OwnerDashboard" component={OwnerDashboardScreen} options={{ title: 'Мои питомцы' }} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}