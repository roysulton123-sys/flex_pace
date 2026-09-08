import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import LeafletMap from '../components/LeafletMap';

export default function ExploreScreen() {
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          // Default location (e.g. Jakarta) if permission is denied
          if (isMounted) setCurrentLocation({ coords: { latitude: -6.200000, longitude: 106.816666 } } as any);
          return;
        }

        // Try getting last known for speed, if null get current
        let location = await Location.getLastKnownPositionAsync({});
        if (!location) {
          location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        }
        
        if (isMounted && location) {
          setCurrentLocation(location);
        } else if (isMounted) {
          // Fallback
          setCurrentLocation({ coords: { latitude: -6.200000, longitude: 106.816666 } } as any);
        }
      } catch (error) {
        console.log("Error getting location:", error);
        if (isMounted) setCurrentLocation({ coords: { latitude: -6.200000, longitude: 106.816666 } } as any);
      }
    })();
    return () => { isMounted = false; };
  }, []);

  return (
    <ScrollView style={styles.container}>
      {currentLocation ? (
        <View style={styles.mapContainer}>
          <LeafletMap currentLocation={currentLocation.coords} height={300} />
        </View>
      ) : (
        <View style={styles.mapPlaceholder}>
          <Text style={styles.mapText}>Loading Map...</Text>
        </View>
      )}

        <View style={styles.nearbySection}>
          <Text style={styles.sectionTitle}>Tempat Populer Terdekat</Text>
          <View style={styles.item}>
            <Ionicons name="location" size={24} color="#D7FF00" />
            <View style={styles.itemTextContainer}>
              <Text style={styles.itemTitle}>Gelora Bung Karno</Text>
              <Text style={styles.itemSubtitle}>2.5 km away</Text>
            </View>
          </View>
          <View style={styles.item}>
            <Ionicons name="bicycle" size={24} color="#D7FF00" />
            <View style={styles.itemTextContainer}>
              <Text style={styles.itemTitle}>Sudirman Car Free Day</Text>
              <Text style={styles.itemSubtitle}>Sunday Morning</Text>
            </View>
          </View>
        </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  mapContainer: {
    width: Dimensions.get('window').width,
    height: 300,
    backgroundColor: '#111111',
  },
  mapPlaceholder: {
    width: Dimensions.get('window').width,
    height: 300,
    backgroundColor: '#222222',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapText: {
    color: '#999999',
    fontSize: 16,
  },
  nearbySection: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#ffffff',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111111',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#333333',
  },
  itemTextContainer: {
    marginLeft: 15,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  itemSubtitle: {
    color: '#999999',
    marginTop: 2,
  }
});
