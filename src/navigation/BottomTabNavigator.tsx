import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import HomeScreen from '../screens/HomeScreen';
import ExploreScreen from '../screens/ExploreScreen';
import RecordScreen from '../screens/RecordScreen';
import EventsScreen from '../screens/EventsScreen';
import ProfileScreen from '../screens/ProfileScreen';

import { useNavigation } from '@react-navigation/native';

const Tab = createBottomTabNavigator();

function FlexPaceHeaderTitle() {
  return (
    <View style={styles.headerTitleContainer}>
      <Image 
        source={require('../../assets/icon.png')} 
        style={styles.headerLogo} 
        resizeMode="contain" 
      />
      <Text style={styles.headerBrandText}>FLEX PACE</Text>
    </View>
  );
}

export default function BottomTabNavigator() {
  const navigation = useNavigation();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'flash';

          if (route.name === 'Home') {
            iconName = focused ? 'sparkles' : 'sparkles-outline';
          } else if (route.name === 'Explore') {
            iconName = focused ? 'compass' : 'compass-outline';
          } else if (route.name === 'Record') {
            // Hero Center Button
            return (
              <View style={[styles.centerTrackBtn, focused && styles.centerTrackBtnFocused]}>
                <Ionicons name="radio-button-on" size={32} color="#000000" />
              </View>
            );
          } else if (route.name === 'Events') {
            iconName = focused ? 'trophy' : 'trophy-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return <Ionicons name={iconName} size={22} color={color} />;
        },
        tabBarActiveTintColor: '#D7FF00',
        tabBarInactiveTintColor: '#71717A',
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          letterSpacing: 0.3,
          marginBottom: 4,
        },
        headerStyle: {
          backgroundColor: '#0A0A0C',
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(255, 255, 255, 0.06)',
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTintColor: '#FFFFFF',
        headerTitleAlign: 'left',
        tabBarStyle: {
          backgroundColor: '#0E0E12',
          borderTopWidth: 1,
          borderTopColor: 'rgba(255, 255, 255, 0.06)',
          height: 62,
          paddingBottom: 6,
          paddingTop: 6,
          elevation: 10,
        },
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen} 
        options={{ 
          title: 'Pulse',
          headerTitle: () => <FlexPaceHeaderTitle />,
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 16 }}>
              <TouchableOpacity 
                style={{ marginRight: 14 }}
                onPress={() => {
                  // @ts-ignore
                  navigation.navigate('InviteFriends');
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="person-add-outline" size={20} color="#D7FF00" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerRightBtn}>
                <Ionicons name="notifications-outline" size={21} color="#FFFFFF" />
                <View style={styles.notificationDot} />
              </TouchableOpacity>
            </View>
          )
        }} 
      />
      <Tab.Screen 
        name="Explore" 
        component={ExploreScreen} 
        options={{ 
          title: 'Radar',
          headerTitle: 'RADAR RUTE' 
        }} 
      />
      <Tab.Screen 
        name="Record" 
        component={RecordScreen} 
        options={{ 
          title: '',
          headerShown: false,
          tabBarLabel: () => null,
        }} 
      />
      <Tab.Screen 
        name="Events" 
        component={EventsScreen} 
        options={{ 
          title: 'Arena',
          headerTitle: 'ARENA & EVENT' 
        }} 
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen} 
        options={{ 
          title: 'Hub',
          headerTitle: 'ATHLETE HUB' 
        }} 
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerLogo: {
    width: 30,
    height: 30,
    borderRadius: 8,
    marginRight: 10,
  },
  headerBrandText: {
    color: '#D7FF00',
    fontWeight: '900',
    fontSize: 18,
    letterSpacing: 2,
  },
  headerRightBtn: {
    marginRight: 16,
    position: 'relative',
    padding: 6,
  },
  notificationDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#D7FF00',
  },
  centerTrackBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#D7FF00',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    shadowColor: '#D7FF00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 3,
    borderColor: '#0A0A0C',
  },
  centerTrackBtnFocused: {
    backgroundColor: '#FFFFFF',
  }
});
