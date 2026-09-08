import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { getDistance } from '../utils/locationUtils';
import LeafletMap from '../components/LeafletMap';
import { supabase } from '../lib/supabase';
import { useNavigation } from '@react-navigation/native';

export default function RecordScreen() {
  const navigation = useNavigation();
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [distance, setDistance] = useState(0); // in meters
  const [sportType, setSportType] = useState('Run');
  
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<Location.LocationObjectCoords[]>([]);
  const [locationPermission, setLocationPermission] = useState(false);
  
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);

  // Request permissions on mount and get initial location
  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission to access location was denied');
        return;
      }
      setLocationPermission(true);

      let location = await Location.getCurrentPositionAsync({});
      setCurrentLocation(location);
    })();

    // Cleanup location subscription on unmount
    return () => {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
    };
  }, []);

  // Timer logic
  useEffect(() => {
    let interval: any;
    if (isRecording && !isPaused) {
      interval = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording, isPaused]);

  // GPS Tracking Logic
  useEffect(() => {
    const startTracking = async () => {
      if (isRecording && !isPaused) {
        locationSubscription.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 2000,
            distanceInterval: 2, // get update every 2 meters
          },
          (location) => {
            setCurrentLocation(location);
            setRouteCoordinates((prevCoords) => {
              const newCoords = [...prevCoords, location.coords];
              
              // Calculate distance difference if there is a previous point
              if (prevCoords.length > 0) {
                const lastPoint = prevCoords[prevCoords.length - 1];
                const delta = getDistance(
                  lastPoint.latitude,
                  lastPoint.longitude,
                  location.coords.latitude,
                  location.coords.longitude
                );
                setDistance((prevDistance) => prevDistance + delta);
              }
              
              return newCoords;
            });
          }
        );
      } else {
        if (locationSubscription.current) {
          locationSubscription.current.remove();
          locationSubscription.current = null;
        }
      }
    };

    startTracking();
  }, [isRecording, isPaused]);

  const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h > 0 ? h + ':' : ''}${m < 10 && h > 0 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Calculate Pace (min/km) or Speed (km/h)
  const getPaceOrSpeed = () => {
    if (distance === 0 || seconds === 0) return sportType === 'Ride' ? '0.0' : '-:--';
    
    if (sportType === 'Ride') {
      // Speed in km/h = (distance_km) / (hours)
      const distanceKm = distance / 1000;
      const hours = seconds / 3600;
      return (distanceKm / hours).toFixed(1);
    } else {
      // Pace in min/km = (minutes) / (distance_km)
      const distanceKm = distance / 1000;
      if (distanceKm < 0.01) return '-:--'; // Avoid huge numbers
      const totalMinutes = seconds / 60;
      const paceDecimal = totalMinutes / distanceKm;
      
      const paceMinutes = Math.floor(paceDecimal);
      const paceSeconds = Math.floor((paceDecimal - paceMinutes) * 60);
      return `${paceMinutes}:${paceSeconds < 10 ? '0' : ''}${paceSeconds}`;
    }
  };

  const handleStart = () => {
    if (!locationPermission) {
      Alert.alert('GPS Required', 'Please enable location permissions to start recording.');
      return;
    }
    setIsRecording(true);
    setIsPaused(false);
  };

  const handlePause = () => {
    setIsPaused(!isPaused);
  };

  const handleStop = async () => {
    setIsSaving(true);
    setIsPaused(true);

    const finalDistance = distance;
    const finalSeconds = seconds;
    const finalSport = sportType;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        Alert.alert("Perhatian", "Anda harus login untuk menyimpan aktivitas.");
        setIsSaving(false);
        return;
      }

      const { error } = await supabase
        .from('activities')
        .insert([
          { 
            user_id: user.id, 
            sport_type: finalSport,
            distance_meters: finalDistance,
            duration_seconds: finalSeconds,
            route_coordinates: routeCoordinates // Disimpan sebagai JSONB
          }
        ]);

      if (error) {
        Alert.alert("Gagal Menyimpan", error.message);
      } else {
        Alert.alert(
          "Sesi Berhasil Disimpan! ⚡",
          "Ingin pamerkan pace dan selfie Anda ke Instagram / WA Status sekarang?",
          [
            { text: "Nanti Saja", style: "cancel" },
            { 
              text: "Buat Story 9:16", 
              onPress: () => {
                // @ts-ignore
                navigation.navigate('ShareStory', {
                  distance_meters: finalDistance,
                  duration_seconds: finalSeconds,
                  sport_type: finalSport,
                });
              }
            }
          ]
        );
      }
    } catch (e) {
      console.log(e);
      Alert.alert("Error", "Terjadi kesalahan yang tidak terduga.");
    } finally {
      setIsRecording(false);
      setIsPaused(false);
      setIsSaving(false);
      setSeconds(0);
      setDistance(0);
      setRouteCoordinates([]);
    }
  };

  // Pre-recording state
  if (!isRecording) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Ionicons 
            name={locationPermission ? "navigate" : "navigate-outline"} 
            size={24} 
            color={locationPermission ? "#D7FF00" : "gray"} 
          />
          <Text style={[styles.locationText, { color: locationPermission ? '#D7FF00' : 'gray' }]}>
            {locationPermission ? 'GPS Signal Ready' : 'Acquiring GPS...'}
          </Text>
        </View>

        {currentLocation ? (
          <View style={styles.mapContainer}>
            <LeafletMap currentLocation={currentLocation.coords} />
          </View>
        ) : (
          <View style={styles.mapPlaceholder}>
            <Text style={{ color: '#888' }}>Locating...</Text>
          </View>
        )}

        <View style={styles.sportSelector}>
          <TouchableOpacity onPress={() => setSportType('Run')}>
            <Ionicons name="walk-outline" size={36} color={sportType === 'Run' ? '#D7FF00' : 'gray'} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setSportType('Ride')}>
            <Ionicons name="bicycle-outline" size={36} color={sportType === 'Ride' ? '#D7FF00' : 'gray'} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.startButton} onPress={handleStart}>
          <Text style={styles.startButtonText}>START</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Active recording state
  return (
    <View style={styles.recordingContainer}>
      <View style={styles.activeMapContainer}>
        {currentLocation && (
          <LeafletMap 
            currentLocation={currentLocation.coords} 
            routeCoordinates={routeCoordinates} 
          />
        )}
      </View>

      <View style={styles.activeStats}>
        <Text style={styles.gridLabel}>WAKTU</Text>
        <Text style={styles.timeValue}>{formatTime(seconds)}</Text>
        
        <View style={styles.gridStats}>
          <View style={styles.gridBox}>
            <Text style={styles.gridLabel}>JARAK (KM)</Text>
            <Text style={styles.gridValue}>{(distance / 1000).toFixed(2)}</Text>
          </View>
          <View style={styles.gridBox}>
            <Text style={styles.gridLabel}>{sportType === 'Ride' ? 'KECEPATAN (KM/J)' : 'PACE (/KM)'}</Text>
            <Text style={styles.gridValue}>{getPaceOrSpeed()}</Text>
          </View>
        </View>
      </View>

      <View style={{ paddingBottom: 40, paddingHorizontal: 30, position: 'absolute', bottom: 0, width: '100%' }}>
        {isPaused ? (
          <View style={styles.pausedControls}>
            <TouchableOpacity style={styles.resumeButton} onPress={handlePause}>
              <Text style={styles.buttonText}>RESUME</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.stopButton} onPress={handleStop} disabled={isSaving}>
              {isSaving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>FINISH</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <TouchableOpacity style={styles.lockButton}>
              <Ionicons name="lock-closed-outline" size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.pauseButton} onPress={handlePause}>
              <Ionicons name="pause" size={36} color="#000000" />
            </TouchableOpacity>
            <View style={{ width: 60 }} />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    position: 'absolute',
    top: 50,
    zIndex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
  },
  locationText: {
    marginTop: 5,
    fontSize: 12,
    color: '#D7FF00',
    marginLeft: 10,
    fontWeight: 'bold',
  },
  mapContainer: {
    width: '100%',
    flex: 1,
    backgroundColor: '#111111',
  },
  mapPlaceholder: {
    width: '100%',
    flex: 1,
    backgroundColor: '#111111',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sportSelector: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingVertical: 20,
    backgroundColor: '#000000',
    borderTopWidth: 1,
    borderColor: '#222222',
  },
  startButton: {
    backgroundColor: '#D7FF00',
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    bottom: 90,
    elevation: 5,
    shadowColor: '#D7FF00',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  startButtonText: {
    color: '#000000',
    fontSize: 20,
    fontWeight: 'bold',
  },
  recordingContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  activeMapContainer: {
    flex: 0.4,
    width: '100%',
  },
  activeStats: {
    flex: 0.6,
    backgroundColor: '#111111',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 20,
    alignItems: 'center',
  },
  timeValue: {
    fontSize: 60,
    fontWeight: 'bold',
    color: '#ffffff',
    marginVertical: 20,
  },
  gridStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 40,
  },
  gridBox: {
    alignItems: 'center',
  },
  gridLabel: {
    fontSize: 16,
    color: '#999999',
  },
  gridValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  pauseButton: {
    backgroundColor: '#D7FF00',
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockButton: {
    backgroundColor: '#333333',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pausedControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  resumeButton: {
    backgroundColor: '#D7FF00',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 30,
    flex: 0.45,
    alignItems: 'center',
  },
  stopButton: {
    backgroundColor: '#FF3B30',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 30,
    flex: 0.45,
    alignItems: 'center',
  },
  buttonText: {
    color: '#000000',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
