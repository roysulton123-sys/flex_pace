import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Dimensions, 
  ActivityIndicator, 
  RefreshControl,
  Share,
  Alert,
  Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import LeafletMap from '../components/LeafletMap';
import { supabase } from '../lib/supabase';
import { useNavigation } from '@react-navigation/native';

interface RecordedRoute {
  id: string;
  sport_type: string;
  distance_meters: number;
  duration_seconds: number;
  route_coordinates: { latitude: number; longitude: number }[];
  created_at: string;
}

export default function ExploreScreen() {
  const navigation = useNavigation();
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const [routes, setRoutes] = useState<RecordedRoute[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<RecordedRoute | null>(null);
  const [loadingRoutes, setLoadingRoutes] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // VIP Membership & GPX Export State
  const [isVipMember, setIsVipMember] = useState(false);
  const [vipModalVisible, setVipModalVisible] = useState(false);

  useEffect(() => {
    fetchCurrentLocation();
    fetchUserRoutes();
    checkMembership();
  }, []);

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

  // Generator File GPX 1.1 Standar Internasional (Garmin, Coros, Suunto)
  const generateGpxString = (route: RecordedRoute) => {
    const coords = route.route_coordinates || [];
    const dateStr = route.created_at || new Date().toISOString();
    const trkpts = coords.map((pt) => {
      return `      <trkpt lat="${pt.latitude}" lon="${pt.longitude}">
        <ele>15.0</ele>
        <time>${dateStr}</time>
      </trkpt>`;
    }).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Flex Pace PRO Athlete Hub" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <metadata>
    <name>Flex Pace - ${route.sport_type} ${(route.distance_meters / 1000).toFixed(2)} KM</name>
    <desc>Rute olahraga resmi Flex Pace PRO. Kompatibel dengan Garmin, Coros, Suunto, Wahoo, &amp; Strava.</desc>
    <time>${dateStr}</time>
  </metadata>
  <trk>
    <name>${route.sport_type} ${(route.distance_meters / 1000).toFixed(2)} KM</name>
    <type>${route.sport_type.toUpperCase()}</type>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`;
  };

  const handleExportGpx = async (route: RecordedRoute) => {
    if (!isVipMember) {
      setVipModalVisible(true);
      return;
    }

    try {
      const gpxContent = generateGpxString(route);
      await Share.share({
        title: `Flex Pace Route - ${route.sport_type} ${(route.distance_meters / 1000).toFixed(2)}KM.gpx`,
        message: gpxContent,
      });
    } catch (e: any) {
      Alert.alert('Gagal Ekspor GPX', e.message || 'Terjadi kesalahan saat memproses file GPX.');
    }
  };

  const fetchCurrentLocation = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setCurrentLocation({ coords: { latitude: -6.200000, longitude: 106.816666 } } as any);
        return;
      }

      let location = await Location.getLastKnownPositionAsync({});
      if (!location) {
        location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      }

      if (location) {
        setCurrentLocation(location);
      } else {
        setCurrentLocation({ coords: { latitude: -6.200000, longitude: 106.816666 } } as any);
      }
    } catch (error) {
      console.log("Error getting location:", error);
      setCurrentLocation({ coords: { latitude: -6.200000, longitude: 106.816666 } } as any);
    }
  };

  const fetchUserRoutes = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        // Filter aktivitas yang memiliki koordinat rute
        const withRoutes = data.filter((a: any) => a.route_coordinates && a.route_coordinates.length > 0);
        setRoutes(withRoutes);
        if (withRoutes.length > 0 && !selectedRoute) {
          setSelectedRoute(withRoutes[0]);
        }
      }
    } catch (e) {
      console.log('Error fetching routes:', e);
    } finally {
      setLoadingRoutes(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchUserRoutes();
    fetchCurrentLocation();
  };

  // Format durasi
  const formatDuration = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    if (h > 0) return `${h}j ${m}m ${s}s`;
    return `${m}m ${s}s`;
  };

  // Format pace
  const formatPace = (distanceMeters: number, seconds: number, sportType: string) => {
    if (distanceMeters === 0 || seconds === 0) return '-:-- /km';
    const distKm = distanceMeters / 1000;
    if (sportType === 'Ride') {
      const hours = seconds / 3600;
      return (distKm / hours).toFixed(1) + ' km/j';
    } else {
      const paceDecimal = (seconds / 60) / distKm;
      const m = Math.floor(paceDecimal);
      const s = Math.floor((paceDecimal - m) * 60);
      return `${m}:${s < 10 ? '0' : ''}${s} /km`;
    }
  };

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    return d.toLocaleDateString('id-ID', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleDeleteRoute = (route: RecordedRoute) => {
    Alert.alert(
      'Hapus Riwayat Rute?',
      `Hapus rekaman rute ${route.sport_type} ${(route.distance_meters / 1000).toFixed(2)} KM dari riwayat?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('activities')
                .delete()
                .eq('id', route.id);

              if (error) {
                console.error('Error deleting activity from db:', error.message);
              }

              const updated = routes.filter(r => r.id !== route.id);
              setRoutes(updated);
              if (selectedRoute?.id === route.id) {
                setSelectedRoute(updated.length > 0 ? updated[0] : null);
              }
              Alert.alert('Sukses', 'Riwayat rute berhasil dihapus.');
            } catch (e: any) {
              Alert.alert('Gagal Menghapus Rute', e.message || 'Terjadi kesalahan.');
            }
          }
        }
      ]
    );
  };

  const handleClearAllRoutes = () => {
    if (routes.length === 0) return;
    Alert.alert(
      'Hapus Semua Riwayat Rute?',
      'Seluruh rute yang tercatat di riwayat Anda akan dihapus secara permanen.',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus Semua',
          style: 'destructive',
          onPress: async () => {
            try {
              const { data: { user } } = await supabase.auth.getUser();
              if (user) {
                await supabase.from('activities').delete().eq('user_id', user.id);
              }
              setRoutes([]);
              setSelectedRoute(null);
              Alert.alert('Sukses', 'Seluruh riwayat rute telah dibersihkan.');
            } catch (e: any) {
              Alert.alert('Gagal', e.message || 'Terjadi kesalahan.');
            }
          }
        }
      ]
    );
  };

  // Tentukan koordinat untuk peta
  const activeCoordinates = selectedRoute?.route_coordinates || [];
  const mapCenter = activeCoordinates.length > 0 
    ? activeCoordinates[0] 
    : (currentLocation ? currentLocation.coords : { latitude: -6.200000, longitude: 106.816666 });

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl 
          refreshing={refreshing} 
          onRefresh={onRefresh} 
          colors={['#D7FF00']} 
          tintColor="#D7FF00" 
        />
      }
    >
      {/* PETA RADAR RUTE */}
      <View style={styles.mapContainer}>
        <LeafletMap 
          currentLocation={mapCenter} 
          routeCoordinates={activeCoordinates} 
          height={320} 
        />
        {selectedRoute && (
          <View style={styles.mapBadge}>
            <Ionicons name="location-sharp" size={14} color="#D7FF00" style={{ marginRight: 4 }} />
            <Text style={styles.mapBadgeText}>
              Menampilkan Rute {(selectedRoute.distance_meters / 1000).toFixed(2)} KM
            </Text>
          </View>
        )}
      </View>

      {/* RIWAYAT RUTE YANG DILALUI */}
      <View style={styles.routesSection}>
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={styles.sectionTitle}>RIWAYAT RUTE YANG DILALUI</Text>
            <Text style={styles.sectionSubtitle}>Pilih rute untuk melihat garis jalur di radar peta</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={styles.countPill}>
              <Text style={styles.countPillText}>{routes.length} Rute</Text>
            </View>
            {routes.length > 0 && (
              <TouchableOpacity 
                style={styles.clearAllRoutesBtn}
                onPress={handleClearAllRoutes}
                activeOpacity={0.8}
              >
                <Ionicons name="trash-outline" size={16} color="#FF453A" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {loadingRoutes ? (
          <ActivityIndicator color="#D7FF00" style={{ marginVertical: 30 }} />
        ) : routes.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="map-outline" size={30} color="#71717A" />
            </View>
            <Text style={styles.emptyTitle}>Belum Ada Riwayat Rute</Text>
            <Text style={styles.emptyDesc}>
              Buka tab Track (tombol bulat di tengah) dan rekam sesi olahraga lari atau gowes Anda untuk mulai merekam peta rute.
            </Text>
            <TouchableOpacity 
              style={styles.startRecordBtn}
              onPress={() => {
                // @ts-ignore
                navigation.navigate('Record');
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="play" size={16} color="#000000" style={{ marginRight: 6 }} />
              <Text style={styles.startRecordBtnText}>Mulai Rekam Rute Sekarang</Text>
            </TouchableOpacity>
          </View>
        ) : (
          routes.map((item) => {
            const isSelected = selectedRoute?.id === item.id;
            const distKm = (item.distance_meters / 1000).toFixed(2);
            const isRide = item.sport_type === 'Ride';

            return (
              <TouchableOpacity 
                key={item.id} 
                style={[styles.routeCard, isSelected && styles.routeCardActive]}
                onPress={() => setSelectedRoute(item)}
                activeOpacity={0.85}
              >
                <View style={styles.routeCardHeader}>
                  <View style={styles.routeHeaderLeft}>
                    <View style={[styles.sportTag, isRide ? styles.rideTag : styles.runTag]}>
                      <Ionicons name={isRide ? "bicycle" : "walk"} size={12} color="#000000" style={{ marginRight: 3 }} />
                      <Text style={styles.sportTagText}>{isRide ? 'RIDE' : 'RUN'}</Text>
                    </View>
                    <Text style={styles.routeDate}>{formatDate(item.created_at)}</Text>
                  </View>

                  {isSelected && (
                    <View style={styles.activeTag}>
                      <Text style={styles.activeTagText}>Sedang Dilihat</Text>
                    </View>
                  )}
                </View>

                {/* METRICS ROW */}
                <View style={styles.metricsRow}>
                  <View style={styles.metricCol}>
                    <Text style={styles.metricLabel}>JARAK</Text>
                    <Text style={styles.metricValuePrimary}>{distKm} <Text style={styles.metricUnit}>KM</Text></Text>
                  </View>

                  <View style={styles.metricDivider} />

                  <View style={styles.metricCol}>
                    <Text style={styles.metricLabel}>{isRide ? 'SPEED' : 'PACE'}</Text>
                    <Text style={styles.metricValue}>
                      {formatPace(item.distance_meters, item.duration_seconds, item.sport_type)}
                    </Text>
                  </View>

                  <View style={styles.metricDivider} />

                  <View style={styles.metricCol}>
                    <Text style={styles.metricLabel}>DURASI</Text>
                    <Text style={styles.metricValue}>{formatDuration(item.duration_seconds)}</Text>
                  </View>
                </View>

                {/* ACTION BUTTONS */}
                <View style={styles.routeActionsRow}>
                  <TouchableOpacity 
                    style={[styles.actionBtn, isSelected ? styles.actionBtnActive : styles.actionBtnOutline]}
                    onPress={() => setSelectedRoute(item)}
                  >
                    <Ionicons 
                      name={isSelected ? "eye" : "eye-outline"} 
                      size={14} 
                      color={isSelected ? "#000000" : "#D7FF00"} 
                      style={{ marginRight: 4 }} 
                    />
                    <Text style={[styles.actionBtnText, isSelected && styles.actionBtnTextActive]}>
                      {isSelected ? 'Peta Aktif' : 'Lihat'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={styles.storyActionBtn}
                    onPress={() => {
                      // @ts-ignore
                      navigation.navigate('ShareStory', {
                        distance_meters: item.distance_meters,
                        duration_seconds: item.duration_seconds,
                        sport_type: item.sport_type,
                        created_at: item.created_at,
                      });
                    }}
                  >
                    <Ionicons name="camera-outline" size={14} color="#FFFFFF" style={{ marginRight: 3 }} />
                    <Text style={styles.storyActionBtnText}>Story</Text>
                  </TouchableOpacity>

                  {/* EKSPOR GPX (Eksklusif VIP) */}
                  <TouchableOpacity 
                    style={[styles.gpxActionBtn, isVipMember ? styles.gpxBtnVip : styles.gpxBtnLocked]}
                    onPress={() => handleExportGpx(item)}
                    activeOpacity={0.8}
                  >
                    <Ionicons 
                      name={isVipMember ? "download-outline" : "lock-closed"} 
                      size={13} 
                      color={isVipMember ? "#000000" : "#71717A"} 
                      style={{ marginRight: 3 }} 
                    />
                    <Text style={[styles.gpxActionBtnText, isVipMember ? styles.gpxTextVip : styles.gpxTextLocked]}>
                      {isVipMember ? 'Ekspor GPX' : 'GPX 🔒'}
                    </Text>
                  </TouchableOpacity>

                  {/* HAPUS RUTE */}
                  <TouchableOpacity 
                    style={styles.deleteRouteActionBtn}
                    onPress={() => handleDeleteRoute(item)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="trash-outline" size={13} color="#FF453A" style={{ marginRight: 3 }} />
                    <Text style={styles.deleteRouteActionBtnText}>Hapus</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </View>

      {/* MODAL VIP PRO EKSPOR GPX */}
      <Modal
        visible={vipModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setVipModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.vipModalCard}>
            <View style={styles.vipModalIconBox}>
              <Ionicons name="watch-outline" size={28} color="#000000" />
            </View>
            <Text style={styles.vipModalTitle}>EKSPOR RUTE GPX KE SMARTWATCH</Text>
            <Text style={styles.vipModalDesc}>
              Fitur canggih eksklusif Membership VIP PRO. Ekspor file rute GPX berstandar internasional untuk diimpor ke Garmin Connect, Coros Pace, Suunto, Wahoo, atau Google Earth.
            </Text>

            <View style={styles.gpxPerksBox}>
              <View style={styles.gpxPerkItem}>
                <Ionicons name="checkmark-circle" size={16} color="#FFD700" style={{ marginRight: 6 }} />
                <Text style={styles.gpxPerkText}>File XML GPX 1.1 lengkap dengan koordinat rute GPS</Text>
              </View>
              <View style={styles.gpxPerkItem}>
                <Ionicons name="checkmark-circle" size={16} color="#FFD700" style={{ marginRight: 6 }} />
                <Text style={styles.gpxPerkText}>Kompatibel 100% dengan jam tangan lari Garmin &amp; Coros</Text>
              </View>
              <View style={styles.gpxPerkItem}>
                <Ionicons name="checkmark-circle" size={16} color="#FFD700" style={{ marginRight: 6 }} />
                <Text style={styles.gpxPerkText}>Bebas ekspor semua riwayat rute tanpa batas kuota</Text>
              </View>
            </View>

            <TouchableOpacity 
              style={styles.vipUpgradeBtn}
              onPress={() => {
                setVipModalVisible(false);
                // @ts-ignore
                navigation.navigate('Profile');
              }}
            >
              <Ionicons name="trophy" size={16} color="#000000" style={{ marginRight: 6 }} />
              <Text style={styles.vipUpgradeBtnText}>Upgrade ke VIP PRO (Mulai Rp 49rb)</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={{ alignItems: 'center', marginTop: 12 }}
              onPress={() => setVipModalVisible(false)}
            >
              <Text style={{ color: '#71717A', fontSize: 13, fontWeight: '600' }}>Tutup</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0C',
  },
  mapContainer: {
    width: Dimensions.get('window').width,
    height: 320,
    backgroundColor: '#111111',
    position: 'relative',
  },
  mapBadge: {
    position: 'absolute',
    top: 14,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(10, 10, 14, 0.85)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(215, 255, 0, 0.3)',
  },
  mapBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },

  // ROUTES SECTION
  routesSection: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  sectionSubtitle: {
    color: '#71717A',
    fontSize: 11,
    marginTop: 2,
  },
  countPill: {
    backgroundColor: 'rgba(215, 255, 0, 0.1)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(215, 255, 0, 0.25)',
  },
  countPillText: {
    color: '#D7FF00',
    fontSize: 11,
    fontWeight: '800',
  },

  // ROUTE CARD
  routeCard: {
    backgroundColor: '#131317',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  routeCardActive: {
    borderColor: '#D7FF00',
    backgroundColor: '#17171E',
    shadowColor: '#D7FF00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  routeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  routeHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sportTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginRight: 8,
  },
  runTag: {
    backgroundColor: '#D7FF00',
  },
  rideTag: {
    backgroundColor: '#30D158',
  },
  sportTagText: {
    color: '#000000',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  routeDate: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '600',
  },
  activeTag: {
    backgroundColor: 'rgba(215, 255, 0, 0.12)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(215, 255, 0, 0.3)',
  },
  activeTagText: {
    color: '#D7FF00',
    fontSize: 10,
    fontWeight: '800',
  },

  // METRICS
  metricsRow: {
    flexDirection: 'row',
    backgroundColor: '#1B1B22',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  metricCol: {
    flex: 1,
    alignItems: 'center',
  },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  metricLabel: {
    color: '#71717A',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  metricValuePrimary: {
    color: '#D7FF00',
    fontSize: 16,
    fontWeight: '900',
  },
  metricUnit: {
    fontSize: 10,
    color: '#A1A1AA',
  },
  metricValue: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },

  // ACTIONS
  routeActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionBtn: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 12,
    marginRight: 8,
  },
  actionBtnOutline: {
    backgroundColor: 'rgba(215, 255, 0, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(215, 255, 0, 0.25)',
  },
  actionBtnActive: {
    backgroundColor: '#D7FF00',
  },
  actionBtnText: {
    color: '#D7FF00',
    fontSize: 12,
    fontWeight: '800',
  },
  actionBtnTextActive: {
    color: '#000000',
  },
  storyActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#27272A',
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  storyActionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },

  // EMPTY STATE
  emptyCard: {
    backgroundColor: '#131317',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    marginTop: 10,
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#1E1E24',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  emptyDesc: {
    color: '#71717A',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
  },
  startRecordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D7FF00',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 16,
  },
  startRecordBtnText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '900',
  },

  clearAllRoutesBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#1E1214',
    borderWidth: 1,
    borderColor: '#38161A',
  },
  // GPX BUTTON & VIP MODAL
  gpxActionBtn: {
    flex: 1.1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 12,
    marginLeft: 6,
    borderWidth: 1,
  },
  gpxBtnVip: {
    backgroundColor: '#FFD700',
    borderColor: '#FFD700',
  },
  gpxBtnLocked: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  gpxActionBtnText: {
    fontSize: 11,
    fontWeight: '800',
  },
  gpxTextVip: {
    color: '#000000',
  },
  gpxTextLocked: {
    color: '#71717A',
  },
  deleteRouteActionBtn: {
    flex: 0.9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E1214',
    paddingVertical: 8,
    borderRadius: 12,
    marginLeft: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 69, 58, 0.25)',
  },
  deleteRouteActionBtnText: {
    color: '#FF453A',
    fontSize: 11,
    fontWeight: '800',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'flex-end',
  },
  vipModalCard: {
    backgroundColor: '#14141A',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1.5,
    borderColor: '#FFD700',
    padding: 24,
    paddingBottom: 36,
  },
  vipModalIconBox: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 12,
  },
  vipModalTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  vipModalDesc: {
    color: '#A1A1AA',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 16,
    paddingHorizontal: 6,
  },
  gpxPerksBox: {
    backgroundColor: '#1C1C24',
    borderRadius: 14,
    padding: 14,
    gap: 10,
    marginBottom: 18,
  },
  gpxPerkItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gpxPerkText: {
    color: '#E4E4E7',
    fontSize: 12,
    fontWeight: '500',
  },
  vipUpgradeBtn: {
    flexDirection: 'row',
    backgroundColor: '#FFD700',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vipUpgradeBtnText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '900',
  }
});
