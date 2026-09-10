import React from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import RootNavigator from './src/navigation/RootNavigator';

const linking: any = {
  prefixes: [
    'flexpace://',
    'https://flex-pace-landing-771657.hostingersite.com',
    'https://*.hostingersite.com'
  ],
  config: {
    screens: {
      Main: {
        screens: {
          HomeTab: 'home',
          ExploreTab: 'explore',
          RecordTab: 'record',
          CommunityTab: 'community',
          ProfileTab: 'profile',
        },
      },
      UserProfile: 'profile/:userId',
      Chat: 'chat/:recipientId',
      InviteFriends: 'invite',
    },
  },
};

export default function App() {
  return (
    <NavigationContainer theme={DarkTheme} linking={linking}>
      <RootNavigator />
      <StatusBar style="auto" />
    </NavigationContainer>
  );
}
