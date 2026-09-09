import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Modal, ScrollView } from 'react-native';
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
  
  // Ghost Pacer State (Eksklusif VIP PRO)
  const [isVipMember, setIsVipMember] = useState(false);
  const [isGhostPacerActive, setIsGhostPacerActive] = useState(false);
  const [ghostTargetPaceSec, setGhostTargetPaceSec] = useState(300); // 5:00 /km default
  const [ghostModalVisible, setGhostModalVisible] = useState(false);
  const [vipGateModalVisible, setVipGateModalVisible] = useState(false);

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

  // Cek Status Membership VIP Pengguna
  useEffect(() => {
    const checkMembership = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_premium')
          .eq('id', user.id)
          .maybeSingle();
        if (profile?.is_premium) {
          setIsVipMember(true);
        }
      } catch (e) {
        console.log('Error checking membership:', e);
      }
    };
    checkMembership();
  }, [isRecording]);

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

  const formatTargetPace = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const getGhostPacerDelta = () => {
    if (!isGhostPacerActive || seconds === 0) return { deltaMeters: 0, deltaSeconds: 0, isAhead: true };
    const targetDistMeters = (seconds / ghostTargetPaceSec) * 1000;
    const deltaMeters = Math.round(distance - targetDistMeters);
    const metersPerSec = 1000 / ghostTargetPaceSec;
    const deltaSeconds = Math.round(deltaMeters / metersPerSec);
    return {
      deltaMeters,
      deltaSeconds: Math.abs(deltaSeconds),
      isAhead: deltaMeters >= 0
    };
  };

  const ghostDelta = getGhostPacerDelta();

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

        {/* GHOST PACER TOGGLE BAR (Eksklusif VIP PRO) */}
        <TouchableOpacity 
          style={[styles.ghostPacerBar, isGhostPacerActive && styles.ghostPacerBarActive]}
          onPress={() => {
            if (!isVipMember) {
              setVipGateModalVisible(true);
            } else {
              setGhostModalVisible(true);
            }
          }}
          activeOpacity={0.85}
        >
          <View style={styles.ghostPacerIconWrap}>
            <Ionicons name="trophy" size={18} color="#000000" />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.ghostBarTitle}>GHOST PACER VIRTUAL</Text>
              <View style={isVipMember ? styles.vipMiniPill : styles.proLockedPill}>
                <Text style={isVipMember ? styles.vipMiniText : styles.proLockedText}>
                  {isVipMember ? (isGhostPacerActive ? 'AKTIF ⚡' : 'STANDBY') : 'PRO ONLY 🔒'}
                </Text>
              </View>
            </View>
            <Text style={styles.ghostBarSub}>
              {isGhostPacerActive 
                ? `Target: ${formatTargetPace(ghostTargetPaceSec)}/km • Komparasi jarak real-time` 
                : 'Ketuk untuk mengaktifkan pacer virtual saat lari'}
            </Text>
          </View>
          <Ionicons 
            name={isGhostPacerActive ? "checkmark-circle" : "chevron-forward"} 
            size={20} 
            color={isGhostPacerActive ? "#D7FF00" : "#71717A"} 
          />
        </TouchableOpacity>

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

        {/* MODAL GHOST PACER SETUP (Eksklusif VIP) */}
        <Modal
          visible={ghostModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setGhostModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalSheet}>
              <View style={styles.modalCrownBadge}>
                <Ionicons name="trophy" size={24} color="#000000" />
              </View>
              <Text style={styles.modalTitle}>GHOST PACER VIRTUAL</Text>
              <Text style={styles.modalDesc}>
                Tentukan target pace lari Anda. Pacer virtual akan berlari bersama Anda secara real-time dan menampilkan apakah Anda memimpin atau tertinggal.
              </Text>

              {/* Toggle Status Aktif */}
              <View style={styles.ghostToggleRow}>
                <Text style={styles.ghostToggleLabel}>Aktifkan Pacer Sesi Ini</Text>
                <TouchableOpacity 
                  style={[styles.togglePill, isGhostPacerActive ? styles.togglePillOn : styles.togglePillOff]}
                  onPress={() => setIsGhostPacerActive(!isGhostPacerActive)}
                >
                  <Text style={[styles.togglePillText, isGhostPacerActive ? styles.togglePillTextOn : styles.togglePillTextOff]}>
                    {isGhostPacerActive ? 'ON' : 'OFF'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Pilihan Target Pace */}
              <Text style={styles.presetsLabel}>PILIH TARGET PACE PACER</Text>
              <View style={styles.presetsGrid}>
                {[
                  { label: '04:30 /km', sec: 270, desc: 'Elite Speed ⚡' },
                  { label: '05:00 /km', sec: 300, desc: 'Sub-25 5K Target 🔥' },
                  { label: '05:30 /km', sec: 330, desc: 'Half Marathon 🏅' },
                  { label: '06:00 /km', sec: 360, desc: 'Aerobic Base 🏃' },
                  { label: '06:30 /km', sec: 390, desc: 'Easy Recovery 🌱' },
                ].map((preset) => {
                  const isSelected = ghostTargetPaceSec === preset.sec;
                  return (
                    <TouchableOpacity
                      key={preset.sec}
                      style={[styles.presetCard, isSelected && styles.presetCardSelected]}
                      onPress={() => {
                        setGhostTargetPaceSec(preset.sec);
                        setIsGhostPacerActive(true);
                      }}
                      activeOpacity={0.8}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.presetTitle, isSelected && styles.presetTitleSelected]}>
                          {preset.label}
                        </Text>
                        <Text style={styles.presetDesc}>{preset.desc}</Text>
                      </View>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={20} color="#FFD700" />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity 
                style={styles.saveGhostBtn}
                onPress={() => setGhostModalVisible(false)}
              >
                <Text style={styles.saveGhostBtnText}>Pasang Ghost Pacer & Siap Lari</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* MODAL PRO GATE UNTUK PENGGUNA BIASA */}
        <Modal
          visible={vipGateModalVisible}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setVipGateModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalSheet}>
              <View style={styles.modalCrownBadge}>
                <Ionicons name="lock-closed" size={24} color="#000000" />
              </View>
              <Text style={styles.modalTitle}>FITUR EKSKLUSIF VIP PRO</Text>
              <Text style={styles.modalDesc}>
                Ghost Pacer Virtual adalah fitur canggih real-time yang memandu pace Anda dengan perbandingan meter dan detik di setiap langkah layaknya pelari profesional.
              </Text>

              <View style={styles.gatePerks}>
                <View style={styles.gatePerkItem}>
                  <Ionicons name="checkmark-circle" size={16} color="#FFD700" style={{ marginRight: 6 }} />
                  <Text style={styles.gatePerkText}>Komparasi selisih jarak meter & detik real-time</Text>
                </View>
                <View style={styles.gatePerkItem}>
                  <Ionicons name="checkmark-circle" size={16} color="#FFD700" style={{ marginRight: 6 }} />
                  <Text style={styles.gatePerkText}>Pilihan target pace dari 04:30 hingga 06:30 /km</Text>
                </View>
                <View style={styles.gatePerkItem}>
                  <Ionicons name="checkmark-circle" size={16} color="#FFD700" style={{ marginRight: 6 }} />
                  <Text style={styles.gatePerkText}>Lencana Mahkota Emas & Akses Penuh Buat Event</Text>
                </View>
              </View>

              <TouchableOpacity 
                style={styles.saveGhostBtn}
                onPress={() => {
                  setVipGateModalVisible(false);
                  // @ts-ignore
                  navigation.navigate('Profile');
                }}
              >
                <Text style={styles.saveGhostBtnText}>Upgrade ke VIP PRO (Mulai Rp 49rb)</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={{ alignItems: 'center', marginTop: 12 }}
                onPress={() => setVipGateModalVisible(false)}
              >
                <Text style={{ color: '#71717A', fontSize: 13, fontWeight: '600' }}>Nanti Saja</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
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

      {/* GHOST PACER LIVE HUD (Hanya jika aktif) */}
      {isGhostPacerActive && (
        <View style={styles.activeGhostHud}>
          <View style={styles.activeGhostRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="trophy" size={13} color="#FFD700" style={{ marginRight: 5 }} />
              <Text style={styles.activeGhostTitle}>GHOST PACER ({formatTargetPace(ghostTargetPaceSec)}/KM)</Text>
            </View>
            <View style={[styles.ghostStatusPill, ghostDelta.isAhead ? styles.ghostAheadPill : styles.ghostBehindPill]}>
              <Text style={[styles.ghostStatusPillText, ghostDelta.isAhead ? styles.ghostAheadText : styles.ghostBehindText]}>
                {seconds < 5 ? 'MENYINKRONKAN...' : (ghostDelta.isAhead ? `+${ghostDelta.deltaMeters}m UNGGUL` : `${ghostDelta.deltaMeters}m TERTINGGAL`)}
              </Text>
            </View>
          </View>
          <Text style={styles.activeGhostSubtitle}>
            {seconds < 5 
              ? 'Mulai lari dengan ritme stabil untuk sinkronisasi pacer' 
              : (ghostDelta.isAhead 
                  ? `🔥 Anda ${ghostDelta.deltaSeconds} detik lebih cepat dari target pace!` 
                  : `⚠️ Naikkan ritme langkah, Anda tertinggal ${ghostDelta.deltaSeconds} detik`)}
          </Text>
        </View>
      )}

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

  // GHOST PACER STYLES (PRE-RECORDING)
  ghostPacerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16161D',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    width: '92%',
  },
  ghostPacerBarActive: {
    borderColor: '#FFD700',
    backgroundColor: '#201C0E',
  },
  ghostPacerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  ghostBarTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  vipMiniPill: {
    backgroundColor: '#382D06',
    borderColor: '#FFD700',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 6,
  },
  vipMiniText: {
    color: '#FFD700',
    fontSize: 9,
    fontWeight: '900',
  },
  proLockedPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 6,
  },
  proLockedText: {
    color: '#A1A1AA',
    fontSize: 9,
    fontWeight: '800',
  },
  ghostBarSub: {
    color: '#71717A',
    fontSize: 11,
    marginTop: 2,
  },

  // MODAL STYLES (GHOST SETUP & VIP GATE)
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#14141A',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1.5,
    borderColor: '#FFD700',
    padding: 22,
    paddingBottom: 36,
  },
  modalCrownBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  modalDesc: {
    color: '#A1A1AA',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  ghostToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1D1D26',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  ghostToggleLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  togglePill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
  },
  togglePillOn: {
    backgroundColor: '#FFD700',
  },
  togglePillOff: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  togglePillText: {
    fontSize: 12,
    fontWeight: '900',
  },
  togglePillTextOn: {
    color: '#000000',
  },
  togglePillTextOff: {
    color: '#71717A',
  },
  presetsLabel: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  presetsGrid: {
    gap: 8,
    marginBottom: 18,
  },
  presetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1B1B22',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: 12,
  },
  presetCardSelected: {
    borderColor: '#FFD700',
    backgroundColor: '#26220E',
  },
  presetTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  presetTitleSelected: {
    color: '#FFD700',
  },
  presetDesc: {
    color: '#71717A',
    fontSize: 11,
    marginTop: 2,
  },
  saveGhostBtn: {
    backgroundColor: '#FFD700',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveGhostBtnText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '900',
  },
  gatePerks: {
    backgroundColor: '#1B1B22',
    borderRadius: 14,
    padding: 14,
    gap: 10,
    marginBottom: 18,
  },
  gatePerkItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gatePerkText: {
    color: '#E4E4E7',
    fontSize: 12,
    fontWeight: '500',
  },

  // ACTIVE GHOST HUD STYLES
  activeGhostHud: {
    position: 'absolute',
    top: 50,
    left: 14,
    right: 14,
    zIndex: 10,
    backgroundColor: 'rgba(15, 15, 20, 0.94)',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#FFD700',
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  activeGhostRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  activeGhostTitle: {
    color: '#FFD700',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  ghostStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  ghostAheadPill: {
    backgroundColor: '#1E3A1A',
    borderColor: '#30D158',
    borderWidth: 1,
  },
  ghostBehindPill: {
    backgroundColor: '#3C2010',
    borderColor: '#FF9F0A',
    borderWidth: 1,
  },
  ghostStatusPillText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  ghostAheadText: {
    color: '#30D158',
  },
  ghostBehindText: {
    color: '#FF9F0A',
  },
  activeGhostSubtitle: {
    color: '#D4D4D8',
    fontSize: 11,
    lineHeight: 15,
  }
});
