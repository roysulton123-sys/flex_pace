import React, { useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Image, 
  TouchableOpacity, 
  ScrollView, 
  ActivityIndicator, 
  RefreshControl,
  Share,
  Alert,
  Switch
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface UserStats {
  totalDistanceKm: number;
  totalActivities: number;
  totalTimeSeconds: number;
  longestRunKm: number;
}

export default function ProfileScreen() {
  const navigation = useNavigation();
  const [profile, setProfile] = useState<any>(null);
  const [userEmail, setUserEmail] = useState<string>('');
  const [stats, setStats] = useState<UserStats>({
    totalDistanceKm: 0,
    totalActivities: 0,
    totalTimeSeconds: 0,
    longestRunKm: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Privacy Settings
  const [isPrivateAccount, setIsPrivateAccount] = useState(false);
  const [hideGpsRoute, setHideGpsRoute] = useState(false);
  const [hideBiometrics, setHideBiometrics] = useState(false);

  const loadPrivacySettings = async () => {
    try {
      const p1 = await AsyncStorage.getItem('fp_private_account');
      const p2 = await AsyncStorage.getItem('fp_hide_gps');
      const p3 = await AsyncStorage.getItem('fp_hide_biometrics');
      if (p1 !== null) setIsPrivateAccount(p1 === 'true');
      if (p2 !== null) setHideGpsRoute(p2 === 'true');
      if (p3 !== null) setHideBiometrics(p3 === 'true');
    } catch (e) {
      console.log('Error loading privacy settings:', e);
    }
  };

  const togglePrivateAccount = async (val: boolean) => {
    setIsPrivateAccount(val);
    await AsyncStorage.setItem('fp_private_account', String(val));
    Alert.alert('Privasi Diperbarui', val ? 'Akun Anda kini Privat. Hanya pengikut terverifikasi yang dapat melihat aktivitas Anda.' : 'Akun Anda kini Publik.');
  };

  const toggleHideGpsRoute = async (val: boolean) => {
    setHideGpsRoute(val);
    await AsyncStorage.setItem('fp_hide_gps', String(val));
    Alert.alert('Privasi Diperbarui', val ? 'Peta rute GPS disembunyikan dari feed publik.' : 'Peta rute GPS ditampilkan di feed publik.');
  };

  const toggleHideBiometrics = async (val: boolean) => {
    setHideBiometrics(val);
    await AsyncStorage.setItem('fp_hide_biometrics', String(val));
  };

  const loadProfileAndStats = async () => {
    loadPrivacySettings();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setUserEmail(user.email || '');

      // 1. Ambil data profil dari tabel profiles
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (profileData) {
        setProfile(profileData);
      } else {
        // Jika data profil belum ada, buat fallback dari auth metadata
        const fallbackProfile = {
          id: user.id,
          name: user.user_metadata?.name || user.email?.split('@')[0] || 'Athlete',
          bio: user.user_metadata?.bio || '',
          avatar_url: user.user_metadata?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
          role: 'user',
          is_premium: false
        };
        setProfile(fallbackProfile);
      }

      // 2. Ambil statistik aktivitas real dari database
      const { data: activitiesData } = await supabase
        .from('activities')
        .select('distance, duration')
        .order('created_at', { ascending: false });

      if (activitiesData && activitiesData.length > 0) {
        const totalDist = activitiesData.reduce((acc, curr) => acc + (curr.distance || 0), 0);
        const totalSec = activitiesData.reduce((acc, curr) => acc + (curr.duration || 0), 0);
        const maxDist = Math.max(...activitiesData.map(a => a.distance || 0));

        setStats({
          totalDistanceKm: totalDist / 1000,
          totalActivities: activitiesData.length,
          totalTimeSeconds: totalSec,
          longestRunKm: maxDist / 1000,
        });
      }
    } catch (err) {
      console.log('Error loading profile data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // useFocusEffect menjamin data profil SELALU ter-update otomatis saat kembali dari Edit Profil
  useFocusEffect(
    useCallback(() => {
      loadProfileAndStats();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadProfileAndStats();
  };

  const handleShareProfile = async () => {
    try {
      const displayName = profile?.name || 'Atlet Flex Pace';
      await Share.share({
        message: `Ikuti aktivitas olahraga saya di Flex Pace! Profil: ${displayName}`,
      });
    } catch (error) {
      console.log('Error sharing profile:', error);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Konfirmasi Keluar',
      'Apakah Anda yakin ingin keluar dari akun Flex Pace?',
      [
        { text: 'Batal', style: 'cancel' },
        { 
          text: 'Keluar', 
          style: 'destructive', 
          onPress: async () => {
            await supabase.auth.signOut();
          } 
        },
      ]
    );
  };

  const formatHoursMinutes = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    if (hours === 0) return `${minutes}m`;
    return `${hours}j ${minutes}m`;
  };

  if (loading && !profile) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#D7FF00" />
      </View>
    );
  }

  const displayName = profile?.name || userEmail.split('@')[0] || 'Flex Athlete';
  const displayAvatar = profile?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80';
  const handleTag = `@${displayName.toLowerCase().replace(/\s+/g, '')}`;

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl 
          refreshing={refreshing} 
          onRefresh={onRefresh} 
          colors={['#D7FF00']} 
          tintColor="#D7FF00" 
        />
      }
    >
      {/* PROFILE HEADER CARD */}
      <View style={styles.profileHeaderCard}>
        {/* Glow accent */}
        <View style={styles.glowOrb} />

        <View style={styles.avatarRow}>
          <View style={styles.avatarContainer}>
            <Image source={{ uri: displayAvatar }} style={styles.avatar} />
            <View style={styles.onlineBadge} />
          </View>

          <View style={styles.headerInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.displayName}>{displayName}</Text>
              {profile?.is_premium && (
                <Ionicons name="checkmark-circle" size={18} color="#D7FF00" style={{ marginLeft: 4 }} />
              )}
            </View>
            <Text style={styles.handleText}>{handleTag}</Text>

            {/* BADGES ROW */}
            <View style={styles.badgeRow}>
              {profile?.role === 'organizer' ? (
                <View style={[styles.capsuleBadge, styles.organizerBadge]}>
                  <Ionicons name="flash" size={11} color="#D7FF00" style={{ marginRight: 4 }} />
                  <Text style={styles.organizerText}>ORGANIZER</Text>
                </View>
              ) : (
                <View style={styles.capsuleBadge}>
                  <Ionicons name="barbell-outline" size={12} color="#A1A1AA" style={{ marginRight: 4 }} />
                  <Text style={styles.capsuleText}>ATHLETE</Text>
                </View>
              )}

              {profile?.is_premium && (
                <View style={[styles.capsuleBadge, styles.premiumBadge]}>
                  <Ionicons name="star" size={11} color="#000000" style={{ marginRight: 3 }} />
                  <Text style={styles.premiumText}>PRO</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* BIO SECTION */}
        {profile?.bio ? (
          <View style={styles.bioContainer}>
            <Text style={styles.bioText}>{profile.bio}</Text>
          </View>
        ) : (
          <TouchableOpacity 
            style={styles.emptyBioPrompt}
            onPress={() => {
              // @ts-ignore
              navigation.navigate('EditProfile');
            }}
          >
            <Text style={styles.emptyBioText}>+ Tambahkan bio profilmu</Text>
          </TouchableOpacity>
        )}

        {/* ACTION BUTTONS */}
        <View style={styles.actionsRow}>
          <TouchableOpacity 
            style={styles.editButton} 
            onPress={() => {
              // @ts-ignore
              navigation.navigate('EditProfile');
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="pencil" size={15} color="#000000" style={{ marginRight: 6 }} />
            <Text style={styles.editButtonText}>Edit Profil</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.iconActionButton} 
            onPress={handleShareProfile}
            activeOpacity={0.8}
          >
            <Ionicons name="share-social-outline" size={18} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.iconActionButton, styles.logoutIconBtn]} 
            onPress={handleLogout}
            activeOpacity={0.8}
          >
            <Ionicons name="log-out-outline" size={18} color="#FF453A" />
          </TouchableOpacity>
        </View>

        {/* BANNER UNDANG TEMAN & ATLET */}
        <TouchableOpacity 
          style={styles.inviteFriendsBanner}
          onPress={() => {
            // @ts-ignore
            navigation.navigate('InviteFriends');
          }}
          activeOpacity={0.85}
        >
          <View style={styles.inviteBannerLeft}>
            <View style={styles.inviteIconCircle}>
              <Ionicons name="people" size={16} color="#000000" />
            </View>
            <View>
              <Text style={styles.inviteBannerTitle}>Undang Teman & Atlet</Text>
              <Text style={styles.inviteBannerSub}>Bagikan kode & ikuti sesama atlet</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#D7FF00" />
        </TouchableOpacity>
      </View>

      {/* STATS OVERVIEW SECTION */}
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>STATISTIK PERFORMA</Text>
          <Text style={styles.sectionSubtitle}>Real-time tracking</Text>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statTile}>
            <View style={styles.statIconBadge}>
              <Ionicons name="speedometer-outline" size={18} color="#D7FF00" />
            </View>
            <Text style={styles.statMainValue}>
              {stats.totalDistanceKm.toFixed(1)}
              <Text style={styles.statUnit}> km</Text>
            </Text>
            <Text style={styles.statLabel}>Total Jarak</Text>
          </View>

          <View style={styles.statTile}>
            <View style={styles.statIconBadge}>
              <Ionicons name="flame-outline" size={18} color="#FF9F0A" />
            </View>
            <Text style={styles.statMainValue}>
              {stats.totalActivities}
              <Text style={styles.statUnit}> sesi</Text>
            </Text>
            <Text style={styles.statLabel}>Total Aktivitas</Text>
          </View>

          <View style={styles.statTile}>
            <View style={styles.statIconBadge}>
              <Ionicons name="time-outline" size={18} color="#30D158" />
            </View>
            <Text style={styles.statMainValue}>
              {formatHoursMinutes(stats.totalTimeSeconds)}
            </Text>
            <Text style={styles.statLabel}>Durasi Olahraga</Text>
          </View>

          <View style={styles.statTile}>
            <View style={styles.statIconBadge}>
              <Ionicons name="trophy-outline" size={18} color="#FFD60A" />
            </View>
            <Text style={styles.statMainValue}>
              {stats.longestRunKm.toFixed(1)}
              <Text style={styles.statUnit}> km</Text>
            </Text>
            <Text style={styles.statLabel}>Rekor Terjauh</Text>
          </View>
        </View>
      </View>

      {/* PENGATURAN PRIVASI & KEAMANAN AKUN */}
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>PRIVASI & KEAMANAN AKUN</Text>
          <Text style={styles.sectionSubtitle}>Kontrol visibilitas publik</Text>
        </View>

        <View style={styles.privacyCard}>
          {/* Akun Privat */}
          <View style={styles.privacyRow}>
            <View style={styles.privacyTextCol}>
              <View style={styles.privacyTitleRow}>
                <Ionicons name="lock-closed-outline" size={16} color="#D7FF00" style={{ marginRight: 6 }} />
                <Text style={styles.privacyTitle}>Akun Privat</Text>
              </View>
              <Text style={styles.privacyDesc}>
                Hanya pengikut terverifikasi yang dapat melihat linimasa dan riwayat aktivitas Anda.
              </Text>
            </View>
            <Switch
              value={isPrivateAccount}
              onValueChange={togglePrivateAccount}
              trackColor={{ false: '#26262E', true: '#D7FF00' }}
              thumbColor={isPrivateAccount ? '#000000' : '#8E8E93'}
            />
          </View>

          <View style={styles.privacyDivider} />

          {/* Sembunyikan Peta Rute */}
          <View style={styles.privacyRow}>
            <View style={styles.privacyTextCol}>
              <View style={styles.privacyTitleRow}>
                <Ionicons name="eye-off-outline" size={16} color="#D7FF00" style={{ marginRight: 6 }} />
                <Text style={styles.privacyTitle}>Sembunyikan Jalur Rute Peta</Text>
              </View>
              <Text style={styles.privacyDesc}>
                Menyembunyikan garis rute GPS di feed publik demi privasi lokasi rumah atau tempat kerja.
              </Text>
            </View>
            <Switch
              value={hideGpsRoute}
              onValueChange={toggleHideGpsRoute}
              trackColor={{ false: '#26262E', true: '#D7FF00' }}
              thumbColor={hideGpsRoute ? '#000000' : '#8E8E93'}
            />
          </View>

          <View style={styles.privacyDivider} />

          {/* Sembunyikan Metrik Kesehatan */}
          <View style={styles.privacyRow}>
            <View style={styles.privacyTextCol}>
              <View style={styles.privacyTitleRow}>
                <Ionicons name="fitness-outline" size={16} color="#D7FF00" style={{ marginRight: 6 }} />
                <Text style={styles.privacyTitle}>Sembunyikan Estimasi Biometrik</Text>
              </View>
              <Text style={styles.privacyDesc}>
                Hanya tampilkan jarak tempuh dan waktu; sembunyikan estimasi kalori dan detak jantung dari profil publik.
              </Text>
            </View>
            <Switch
              value={hideBiometrics}
              onValueChange={toggleHideBiometrics}
              trackColor={{ false: '#26262E', true: '#D7FF00' }}
              thumbColor={hideBiometrics ? '#000000' : '#8E8E93'}
            />
          </View>
        </View>
      </View>

      {/* FOOTER APP BRANDING */}
      <View style={styles.footerBranding}>
        <Text style={styles.brandTitle}>FLEX PACE</Text>
        <Text style={styles.brandVersion}>v1.0.0 • Designed for Athletes</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0C',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0A0A0C',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  profileHeaderCard: {
    backgroundColor: '#131317',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    padding: 20,
    marginBottom: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  glowOrb: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(215, 255, 0, 0.06)',
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  avatar: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: '#1E1E24',
    borderWidth: 2.5,
    borderColor: '#D7FF00',
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#30D158',
    borderWidth: 2.5,
    borderColor: '#131317',
  },
  headerInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  displayName: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  handleText: {
    color: '#71717A',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  capsuleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginRight: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  capsuleText: {
    color: '#A1A1AA',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  organizerBadge: {
    backgroundColor: 'rgba(215, 255, 0, 0.12)',
    borderColor: 'rgba(215, 255, 0, 0.3)',
  },
  organizerText: {
    color: '#D7FF00',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  premiumBadge: {
    backgroundColor: '#FFD60A',
    borderColor: '#FFD60A',
  },
  premiumText: {
    color: '#000000',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  bioContainer: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  bioText: {
    color: '#D4D4D8',
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '400',
  },
  emptyBioPrompt: {
    marginTop: 14,
    paddingVertical: 8,
  },
  emptyBioText: {
    color: '#D7FF00',
    fontSize: 13,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
  },
  editButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D7FF00',
    paddingVertical: 11,
    borderRadius: 16,
    marginRight: 10,
    shadowColor: '#D7FF00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  editButtonText: {
    color: '#000000',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.2,
  },
  iconActionButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: '#1E1E26',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  logoutIconBtn: {
    backgroundColor: 'rgba(255, 69, 58, 0.1)',
    borderColor: 'rgba(255, 69, 58, 0.2)',
    marginRight: 0,
  },
  inviteFriendsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#191920',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 14,
    borderWidth: 1,
    borderColor: 'rgba(215, 255, 0, 0.2)',
  },
  inviteBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inviteIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#D7FF00',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  inviteBannerTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  inviteBannerSub: {
    color: '#71717A',
    fontSize: 11,
    marginTop: 1,
  },

  // SECTION STYLES
  sectionContainer: {
    marginBottom: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  sectionSubtitle: {
    color: '#52525B',
    fontSize: 11,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statTile: {
    width: '48%',
    backgroundColor: '#131317',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  statIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statMainValue: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  statUnit: {
    fontSize: 13,
    fontWeight: '600',
    color: '#A1A1AA',
  },
  statLabel: {
    color: '#71717A',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },

  // PRIVACY CARD STYLES
  privacyCard: {
    backgroundColor: '#131317',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  privacyTextCol: {
    flex: 1,
    paddingRight: 14,
  },
  privacyTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  privacyTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  privacyDesc: {
    color: '#71717A',
    fontSize: 11,
    lineHeight: 16,
  },
  privacyDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },

  footerBranding: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  brandTitle: {
    color: '#3F3F46',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 2,
  },
  brandVersion: {
    color: '#27272A',
    fontSize: 11,
    marginTop: 2,
  }
});
