import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import LeafletMap from './LeafletMap';
import { useNavigation } from '@react-navigation/native';

export interface ActivityData {
  id: string;
  user_id: string;
  sport_type: string;
  distance_meters: number;
  duration_seconds: number;
  route_coordinates: { latitude: number; longitude: number }[];
  created_at: string;
}

interface ActivityCardProps {
  activity: ActivityData;
}

function timeSince(dateString: string) {
  const date = new Date(dateString);
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "Baru saja";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}j lalu`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} hari lalu`;
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

function formatDuration(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}j ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

function getPace(distanceMeters: number, seconds: number, sportType: string) {
  if (distanceMeters === 0 || seconds === 0) return sportType === 'Ride' ? '0.0 km/j' : '-:-- /km';
  
  if (sportType === 'Ride') {
    const distanceKm = distanceMeters / 1000;
    const hours = seconds / 3600;
    return (distanceKm / hours).toFixed(1) + ' km/j';
  } else {
    const distanceKm = distanceMeters / 1000;
    const totalMinutes = seconds / 60;
    const paceDecimal = totalMinutes / distanceKm;
    
    const paceMinutes = Math.floor(paceDecimal);
    const paceSeconds = Math.floor((paceDecimal - paceMinutes) * 60);
    return `${paceMinutes}:${paceSeconds < 10 ? '0' : ''}${paceSeconds} /km`;
  }
}

export default function ActivityCard({ activity }: ActivityCardProps) {
  const navigation = useNavigation();
  const [boosted, setBoosted] = useState(false);
  const [boostCount, setBoostCount] = useState(Math.floor(Math.random() * 8) + 3);

  const startLocation = activity.route_coordinates && activity.route_coordinates.length > 0
    ? activity.route_coordinates[0]
    : null;

  const distanceKm = (activity.distance_meters / 1000).toFixed(2);
  const isRide = activity.sport_type === 'Ride';
  const estCalories = Math.round((activity.distance_meters / 1000) * (isRide ? 32 : 64));

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Lihat sesi olahraga ${activity.sport_type} sejauh ${distanceKm} km di Flex Pace!`,
      });
    } catch (e) {
      console.log(e);
    }
  };

  const handleBoost = () => {
    setBoosted(!boosted);
    setBoostCount(boosted ? boostCount - 1 : boostCount + 1);
  };

  return (
    <View style={styles.card}>
      {/* HEADER ATHLETE */}
      <View style={styles.header}>
        <Image 
          source={{ uri: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80' }} 
          style={styles.avatar} 
        />
        <View style={styles.headerInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.userName}>Flex Athlete</Text>
            <View style={styles.gpsVerifiedPill}>
              <Ionicons name="shield-checkmark" size={11} color="#D7FF00" />
              <Text style={styles.gpsVerifiedText}>GPS VERIFIED</Text>
            </View>
          </View>
          <Text style={styles.timestamp}>
            {timeSince(activity.created_at)} • Sesi Luar Ruangan
          </Text>
        </View>

        {/* SPORT BADGE */}
        <View style={[styles.sportPill, isRide ? styles.ridePill : styles.runPill]}>
          <Ionicons name={isRide ? "bicycle" : "walk"} size={13} color="#000000" style={{ marginRight: 4 }} />
          <Text style={styles.sportPillText}>{isRide ? 'RIDE' : 'RUN'}</Text>
        </View>
      </View>

      {/* HUD TELEMETRY METRICS */}
      <View style={styles.telemetryGrid}>
        {/* HERO METRIC: DISTANCE */}
        <View style={styles.heroMetricBox}>
          <Text style={styles.heroMetricLabel}>JARAK TEMPUH</Text>
          <View style={styles.heroValueRow}>
            <Text style={styles.heroValue}>{distanceKm}</Text>
            <Text style={styles.heroUnit}>KM</Text>
          </View>
        </View>

        {/* SUB METRICS */}
        <View style={styles.subMetricsCol}>
          <View style={styles.subMetricItem}>
            <Ionicons name="speedometer-outline" size={14} color="#D7FF00" style={{ marginRight: 6 }} />
            <View>
              <Text style={styles.subMetricLabel}>{isRide ? 'KECEPATAN' : 'PACE'}</Text>
              <Text style={styles.subMetricValue}>
                {getPace(activity.distance_meters, activity.duration_seconds, activity.sport_type)}
              </Text>
            </View>
          </View>

          <View style={styles.subMetricItem}>
            <Ionicons name="time-outline" size={14} color="#30D158" style={{ marginRight: 6 }} />
            <View>
              <Text style={styles.subMetricLabel}>WAKTU</Text>
              <Text style={styles.subMetricValue}>{formatDuration(activity.duration_seconds)}</Text>
            </View>
          </View>

          <View style={styles.subMetricItem}>
            <Ionicons name="flame-outline" size={14} color="#FF9F0A" style={{ marginRight: 6 }} />
            <View>
              <Text style={styles.subMetricLabel}>KALORI</Text>
              <Text style={styles.subMetricValue}>~{estCalories} kkal</Text>
            </View>
          </View>
        </View>
      </View>

      {/* MINI ROUTE MAP */}
      {startLocation && (
        <View style={styles.mapFrame}>
          <LeafletMap 
            currentLocation={startLocation} 
            routeCoordinates={activity.route_coordinates}
            height={180}
          />
        </View>
      )}

      {/* FOOTER ACTIONS */}
      <View style={styles.cardFooter}>
        <TouchableOpacity 
          style={[styles.boostButton, boosted && styles.boostButtonActive]} 
          onPress={handleBoost}
          activeOpacity={0.8}
        >
          <Ionicons 
            name={boosted ? "flash" : "flash-outline"} 
            size={16} 
            color={boosted ? "#000000" : "#D7FF00"} 
            style={{ marginRight: 6 }} 
          />
          <Text style={[styles.boostText, boosted && styles.boostTextActive]}>
            {boosted ? 'Boosted!' : 'Boost'} ({boostCount})
          </Text>
        </TouchableOpacity>

        <View style={styles.rightActions}>
          <TouchableOpacity 
            style={styles.storyButton}
            onPress={() => {
              // @ts-ignore
              navigation.navigate('ShareStory', {
                distance_meters: activity.distance_meters,
                duration_seconds: activity.duration_seconds,
                sport_type: activity.sport_type,
                created_at: activity.created_at,
              });
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="camera" size={14} color="#D7FF00" style={{ marginRight: 5 }} />
            <Text style={styles.storyButtonText}>Story 9:16</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionIconBtn} onPress={handleShare}>
            <Ionicons name="paper-plane-outline" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#131317',
    marginHorizontal: 14,
    marginBottom: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    overflow: 'hidden',
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#1E1E24',
    borderWidth: 1.5,
    borderColor: '#D7FF00',
    marginRight: 10,
  },
  headerInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userName: {
    fontWeight: '800',
    fontSize: 15,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  gpsVerifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(215, 255, 0, 0.1)',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 8,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: 'rgba(215, 255, 0, 0.25)',
  },
  gpsVerifiedText: {
    color: '#D7FF00',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginLeft: 3,
  },
  timestamp: {
    color: '#71717A',
    fontSize: 12,
    marginTop: 2,
  },
  sportPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 14,
  },
  runPill: {
    backgroundColor: '#D7FF00',
  },
  ridePill: {
    backgroundColor: '#30D158',
  },
  sportPillText: {
    color: '#000000',
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 0.5,
  },

  // TELEMETRY
  telemetryGrid: {
    flexDirection: 'row',
    backgroundColor: '#191920',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  heroMetricBox: {
    flex: 1.1,
    justifyContent: 'center',
    borderRightWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    paddingRight: 12,
  },
  heroMetricLabel: {
    color: '#71717A',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  heroValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  heroValue: {
    color: '#D7FF00',
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -1,
  },
  heroUnit: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '800',
    marginLeft: 4,
  },
  subMetricsCol: {
    flex: 1,
    paddingLeft: 12,
    justifyContent: 'space-around',
  },
  subMetricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 2,
  },
  subMetricLabel: {
    color: '#71717A',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  subMetricValue: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },

  mapFrame: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 12,
  },

  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
  },
  boostButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(215, 255, 0, 0.08)',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(215, 255, 0, 0.25)',
  },
  boostButtonActive: {
    backgroundColor: '#D7FF00',
    borderColor: '#D7FF00',
  },
  boostText: {
    color: '#D7FF00',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.2,
  },
  boostTextActive: {
    color: '#000000',
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  storyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#191920',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(215, 255, 0, 0.3)',
    marginRight: 6,
  },
  storyButtonText: {
    color: '#D7FF00',
    fontSize: 12,
    fontWeight: '800',
  },
  actionIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  }
});
