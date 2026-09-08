import React, { useEffect, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { View, ActivityIndicator } from 'react-native';

import OnboardingScreen from '../screens/OnboardingScreen';
import BottomTabNavigator from './BottomTabNavigator';
import CreateEventScreen from '../screens/CreateEventScreen';
import EventDetailScreen from '../screens/EventDetailScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import CreatePostScreen from '../screens/CreatePostScreen';
import ShareStoryScreen from '../screens/ShareStoryScreen';
import InviteFriendsScreen from '../screens/InviteFriendsScreen';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0A0A0C' }}>
        <ActivityIndicator size="large" color="#D7FF00" />
      </View>
    );
  }

  return (
    <Stack.Navigator 
      screenOptions={{ 
        headerShown: false,
        headerStyle: { backgroundColor: '#0A0A0C' },
        headerTintColor: '#D7FF00',
        headerTitleStyle: { fontWeight: '800' }
      }}
    >
      {session && session.user ? (
        <>
          <Stack.Screen name="Main" component={BottomTabNavigator} />
          <Stack.Screen 
            name="CreateEvent" 
            component={CreateEventScreen} 
            options={{ headerShown: true, title: 'Buat Event Baru' }} 
          />
          <Stack.Screen 
            name="EventDetail" 
            component={EventDetailScreen} 
            options={{ headerShown: true, title: 'Detail Event' }} 
          />
          <Stack.Screen 
            name="EditProfile" 
            component={EditProfileScreen} 
            options={{ headerShown: true, title: 'Edit Profil' }} 
          />
          <Stack.Screen 
            name="CreatePost" 
            component={CreatePostScreen} 
            options={{ headerShown: true, title: 'Buat Post Baru' }} 
          />
          <Stack.Screen 
            name="ShareStory" 
            component={ShareStoryScreen} 
            options={{ headerShown: true, title: 'Bagikan Story 9:16' }} 
          />
          <Stack.Screen 
            name="InviteFriends" 
            component={InviteFriendsScreen} 
            options={{ headerShown: true, title: 'Undang Teman & Atlet' }} 
          />
        </>
      ) : (
        // Jika belum login, tampilkan halaman Onboarding / Login
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      )}
    </Stack.Navigator>
  );
}
