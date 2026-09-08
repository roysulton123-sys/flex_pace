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
  Switch,
  Modal
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

  // Membership Subscription Modal State
  const [membershipModalVisible, setMembershipModalVisible] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('yearly');
  const [paymentMethod, setPaymentMethod] = useState<'qris' | 'va'>('qris');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const handlePayMembership = async () => {
    setIsProcessingPayment(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Silakan login terlebih dahulu.");

      await new Promise(res => setTimeout(res, 1500));

      await supabase
        .from('profiles')
        .update({ is_premium: true, role: 'organizer' })
        .eq('id', user.id);

      await AsyncStorage.setItem('@fp_membership_active', 'true');
      await AsyncStorage.setItem('@fp_membership_plan', selectedPlan);
      await AsyncStorage.setItem('@fp_membership_date', new Date().toISOString());

      setIsProcessingPayment(false);
      setMembershipModalVisible(false);
      loadProfileAndStats();

      Alert.alert(
        '🎉 Membership Aktif!',
        `Selamat! Akun Anda kini berstatus Flex Pace PRO Organizer (${selectedPlan === 'yearly' ? 'Paket Tahunan' : 'Paket Bulanan'}). Tampilan akun VIP dan akses buat event telah aktif.`
      );
    } catch (err: any) {
      setIsProcessingPayment(false);
      Alert.alert('Gagal Aktivasi', err.message || 'Terjadi kesalahan sistem.');
    }
  };

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
          <View style={[styles.avatarContainer, profile?.is_premium && styles.avatarContainerVip]}>
            <Image source={{ uri: displayAvatar }} style={[styles.avatar, profile?.is_premium && styles.avatarVip]} />
            <View style={styles.onlineBadge} />
          </View>

          <View style={styles.headerInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.displayName}>{displayName}</Text>
              {profile?.is_premium && (
                <View style={styles.vipCrownBadge}>
                  <Ionicons name="trophy" size={11} color="#000000" style={{ marginRight: 3 }} />
                  <Text style={styles.vipCrownText}>VIP PRO</Text>
                </View>
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

      {/* KARTU VIP MEMBERSHIP / UPGRADE GATEWAY */}
      {profile?.is_premium ? (
        <View style={styles.vipMembershipCard}>
          <View style={styles.vipCardHeader}>
            <View style={styles.vipCrownIconBox}>
              <Ionicons name="trophy" size={20} color="#000000" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.vipCardTitle}>FLEX PACE PRO ORGANIZER</Text>
              <Text style={styles.vipCardStatus}>Status: Berlangganan Aktif (Tahunan/Bulanan)</Text>
            </View>
            <View style={styles.vipActiveBadge}>
              <Text style={styles.vipActiveText}>VIP AKTIF</Text>
            </View>
          </View>
          <View style={styles.vipDivider} />
          <View style={styles.vipPerksRow}>
            <View style={styles.vipPerkItem}>
              <Ionicons name="checkmark-circle" size={14} color="#FFD700" style={{ marginRight: 4 }} />
              <Text style={styles.vipPerkText}>Akses Penuh Publikasi Event</Text>
            </View>
            <View style={styles.vipPerkItem}>
              <Ionicons name="checkmark-circle" size={14} color="#FFD700" style={{ marginRight: 4 }} />
              <Text style={styles.vipPerkText}>Lencana Emas & Proteksi Anti-Spam</Text>
            </View>
          </View>
        </View>
      ) : (
        <TouchableOpacity 
          style={styles.upgradeCard}
          onPress={() => setMembershipModalVisible(true)}
          activeOpacity={0.85}
        >
          <View style={styles.upgradeIconBox}>
            <Ionicons name="trophy" size={22} color="#FFD700" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.upgradeTitle}>Upgrade ke Membership PRO</Text>
            <Text style={styles.upgradeDesc}>Buka akses publikasi event Fun Run & dapatkan lencana mahkota emas.</Text>
          </View>
          <View style={styles.upgradeBtn}>
            <Text style={styles.upgradeBtnText}>Langganan</Text>
          </View>
        </TouchableOpacity>
      )}

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

      {/* MODAL SUBSCRIPTION GATEWAY MEMBERSHIP PRO */}
      <Modal
        visible={membershipModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setMembershipModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.membershipModalCard}>
            <View style={styles.crownIconModalBadge}>
              <Ionicons name="trophy" size={28} color="#000000" />
            </View>
            <Text style={styles.membershipModalTitle}>FLEX PACE PRO ORGANIZER</Text>
            <Text style={styles.membershipModalDesc}>
              Akses eksklusif untuk mempublikasikan event lari & gowes komunitas serta lencana mahkota emas di profil dan feed sosial.
            </Text>

            {/* Pilihan Paket Langganan */}
            <View style={styles.plansContainer}>
              <TouchableOpacity 
                style={[styles.planCard, selectedPlan === 'monthly' && styles.planCardActive]}
                onPress={() => setSelectedPlan('monthly')}
                activeOpacity={0.8}
              >
                <View style={styles.planRadio}>
                  {selectedPlan === 'monthly' && <View style={styles.planRadioInner} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.planTitle}>Paket Bulanan</Text>
                  <Text style={styles.planPrice}>Rp 49.000 <Text style={styles.planPeriod}>/ bulan</Text></Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.planCard, selectedPlan === 'yearly' && styles.planCardActive]}
                onPress={() => setSelectedPlan('yearly')}
                activeOpacity={0.8}
              >
                <View style={styles.saveBadge}>
                  <Text style={styles.saveBadgeText}>HEMAT 40%</Text>
                </View>
                <View style={styles.planRadio}>
                  {selectedPlan === 'yearly' && <View style={styles.planRadioInner} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.planTitle}>Paket Tahunan (Paling Populer)</Text>
                  <Text style={styles.planPrice}>Rp 399.000 <Text style={styles.planPeriod}>/ tahun</Text></Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Benefit Member */}
            <View style={styles.perksList}>
              <View style={styles.perkItem}>
                <Ionicons name="checkmark-circle" size={16} color="#FFD700" style={{ marginRight: 6 }} />
                <Text style={styles.perkText}>Publikasi Event Fun Run & Marathon Tak Terbatas</Text>
              </View>
              <View style={styles.perkItem}>
                <Ionicons name="checkmark-circle" size={16} color="#FFD700" style={{ marginRight: 6 }} />
                <Text style={styles.perkText}>Lencana Mahkota Emas 👑 & Profil VIP</Text>
              </View>
              <View style={styles.perkItem}>
                <Ionicons name="checkmark-circle" size={16} color="#FFD700" style={{ marginRight: 6 }} />
                <Text style={styles.perkText}>Proteksi Anti-Spam Komunitas & Prioritas Tayang</Text>
              </View>
            </View>

            {/* Pilihan Metode Bayar */}
            <View style={styles.methodToggle}>
              <TouchableOpacity 
                style={[styles.methodBtn, paymentMethod === 'qris' && styles.methodBtnActive]}
                onPress={() => setPaymentMethod('qris')}
              >
                <Text style={[styles.methodText, paymentMethod === 'qris' && styles.methodTextActive]}>QRIS</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.methodBtn, paymentMethod === 'va' && styles.methodBtnActive]}
                onPress={() => setPaymentMethod('va')}
              >
                <Text style={[styles.methodText, paymentMethod === 'va' && styles.methodTextActive]}>Virtual Account</Text>
              </TouchableOpacity>
            </View>

            {/* Action Buttons */}
            <TouchableOpacity 
              style={styles.payBtn}
              onPress={handlePayMembership}
              disabled={isProcessingPayment}
              activeOpacity={0.85}
            >
              {isProcessingPayment ? (
                <ActivityIndicator color="#000000" size="small" />
              ) : (
                <>
                  <Ionicons name="card" size={18} color="#000000" style={{ marginRight: 6 }} />
                  <Text style={styles.payBtnText}>
                    Bayar & Aktifkan {selectedPlan === 'yearly' ? 'Rp 399.000' : 'Rp 49.000'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.closeModalBtn}
              onPress={() => setMembershipModalVisible(false)}
            >
              <Text style={styles.closeModalText}>Nanti Saja (Tutup)</Text>
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
  },

  // VIP BADGE & AVATAR
  avatarContainerVip: {
    borderWidth: 2,
    borderColor: '#FFD700',
    borderRadius: 43,
    padding: 2,
  },
  avatarVip: {
    borderColor: '#FFD700',
  },
  vipCrownBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFD700',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  vipCrownText: {
    color: '#000000',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  // VIP MEMBERSHIP CARD (ACTIVE)
  vipMembershipCard: {
    backgroundColor: '#1C190D',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#FFD700',
    padding: 16,
    marginBottom: 20,
  },
  vipCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vipCrownIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  vipCardTitle: {
    color: '#FFD700',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  vipCardStatus: {
    color: '#D4D4D8',
    fontSize: 11,
    marginTop: 2,
  },
  vipActiveBadge: {
    backgroundColor: '#2E2405',
    borderColor: '#FFD700',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  vipActiveText: {
    color: '#FFD700',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  vipDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    marginVertical: 12,
  },
  vipPerksRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  vipPerkItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vipPerkText: {
    color: '#E4E4E7',
    fontSize: 11,
    fontWeight: '500',
  },

  // UPGRADE CALL TO ACTION CARD
  upgradeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16151E',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#3F3B20',
    padding: 16,
    marginBottom: 20,
  },
  upgradeIconBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  upgradeTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  upgradeDesc: {
    color: '#9CA3AF',
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
    paddingRight: 6,
  },
  upgradeBtn: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  upgradeBtnText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '800',
  },

  // MODAL STYLES
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  membershipModalCard: {
    backgroundColor: '#141418',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1.5,
    borderColor: '#FFD700',
    padding: 24,
    paddingBottom: 36,
  },
  crownIconModalBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 14,
  },
  membershipModalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  membershipModalDesc: {
    color: '#A1A1AA',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 6,
    marginBottom: 18,
  },
  plansContainer: {
    gap: 10,
    marginBottom: 16,
  },
  planCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E24',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 14,
    position: 'relative',
    overflow: 'hidden',
  },
  planCardActive: {
    borderColor: '#FFD700',
    backgroundColor: '#252110',
  },
  planRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  planRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFD700',
  },
  planTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  planPrice: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 2,
  },
  planPeriod: {
    fontSize: 11,
    color: '#A1A1AA',
    fontWeight: '500',
  },
  saveBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#FF3B30',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderBottomLeftRadius: 10,
  },
  saveBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  perksList: {
    backgroundColor: '#18181D',
    borderRadius: 14,
    padding: 12,
    gap: 8,
    marginBottom: 16,
  },
  perkItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  perkText: {
    color: '#D4D4D8',
    fontSize: 12,
    fontWeight: '500',
  },
  methodToggle: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  methodBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#1E1E24',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  methodBtnActive: {
    borderColor: '#FFD700',
    backgroundColor: '#2A240E',
  },
  methodText: {
    color: '#71717A',
    fontSize: 12,
    fontWeight: '700',
  },
  methodTextActive: {
    color: '#FFD700',
  },
  payBtn: {
    flexDirection: 'row',
    backgroundColor: '#FFD700',
    paddingVertical: 14,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  payBtnText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '900',
  },
  closeModalBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  closeModalText: {
    color: '#71717A',
    fontSize: 13,
    fontWeight: '600',
  }
});
