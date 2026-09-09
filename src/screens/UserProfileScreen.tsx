import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Image, 
  Dimensions, 
  ActivityIndicator, 
  Alert, 
  Modal, 
  Share,
  RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface UserProfileData {
  id: string;
  name: string;
  avatar_url?: string;
  bio?: string;
  role?: string;
  is_premium?: boolean;
}

export default function UserProfileScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { userId, userName, userAvatar } = route.params || {};

  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [stats, setStats] = useState({
    totalDistanceKm: 0,
    totalActivities: 0,
    longestRunKm: 0,
  });
  const [userPosts, setUserPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);

  // Modal 1: Preview Foto Profil (Fullscreen Lightbox)
  const [lightboxVisible, setLightboxVisible] = useState(false);

  // Modal 2: Promosikan Akun (BBM Style Broadcast)
  const [promoteModalVisible, setPromoteModalVisible] = useState(false);

  // Generate BBM-Style PIN (8-Karakter Alfanumerik Unik)
  const athletePin = userId 
    ? userId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase()
    : 'FP2026AT';

  useEffect(() => {
    loadUserProfile();
    loadFollowStatus();
  }, [userId]);

  const loadFollowStatus = async () => {
    if (!userId) return;
    try {
      const saved = await AsyncStorage.getItem(`@fp_following_${userId}`);
      if (saved !== null) {
        setIsFollowing(saved === 'true');
      }
    } catch (e) {
      console.log('Error loading follow status:', e);
    }
  };

  const toggleFollow = async () => {
    if (!userId) return;
    const nextState = !isFollowing;
    setIsFollowing(nextState);
    await AsyncStorage.setItem(`@fp_following_${userId}`, String(nextState));
    Alert.alert(
      nextState ? 'Mengikuti Atlet' : 'Berhenti Mengikuti',
      nextState 
        ? `Anda kini mengikuti ${profile?.name || 'atlet ini'}. Aktivitas mereka akan muncul di radar Anda.`
        : `Anda telah berhenti mengikuti ${profile?.name || 'atlet ini'}.`
    );
  };

  const loadUserProfile = async () => {
    try {
      if (!userId) {
        setLoading(false);
        return;
      }

      // 1. Ambil data profil
      const { data: profData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profData) {
        setProfile(profData);
      } else {
        setProfile({
          id: userId,
          name: userName || 'Flex Athlete',
          avatar_url: userAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80',
          bio: 'Pelari antusias Flex Pace.',
          role: 'user',
          is_premium: false
        });
      }

      // 2. Ambil aktivitas atlet
      const { data: actData } = await supabase
        .from('activities')
        .select('distance, duration')
        .eq('user_id', userId);

      if (actData && actData.length > 0) {
        const totalDist = actData.reduce((acc, curr) => acc + (curr.distance || 0), 0);
        const maxDist = Math.max(...actData.map(a => a.distance || 0));
        setStats({
          totalDistanceKm: totalDist / 1000,
          totalActivities: actData.length,
          longestRunKm: maxDist / 1000,
        });
      }

      // 3. Ambil postingan atlet
      const { data: postData } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (postData) {
        setUserPosts(postData);
      }
    } catch (e) {
      console.log('Error fetching user profile:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadUserProfile();
  };

  // BROADCAST TEKS ALA BLACKBERRY MESSENGER (BBM PIN PROMOTION)
  const getBbmBroadcastText = () => {
    const name = profile?.name || userName || 'Atlet Flex Pace';
    const statusVip = profile?.is_premium ? '👑 VIP PRO ATHLETE' : '🏃 Atlet Resmi Flex Pace';
    const bioText = profile?.bio ? `"${profile.bio}"` : '"Semangat pacu rekor lari bareng di Flex Pace!"';
    
    return `📱 *PROMOSI KONTAK ATLET FLEX PACE* ⚡
========================================
👤 *Nama*       : ${name}
🔑 *PIN BBM*    : [${athletePin}]
🏅 *Status*     : ${statusVip}
🏃‍♂️ *Total Jarak*: ${stats.totalDistanceKm.toFixed(1)} KM • Rekor: ${stats.longestRunKm.toFixed(1)} KM
💬 *Bio*        : ${bioText}

Ayo invite PIN-nya, tanding pace, & chat bareng di aplikasi Flex Pace!
📲 Tambahkan Kontak: https://flexpace.my.id/profile?pin=${athletePin}
========================================`;
  };

  const handleShareBbmBroadcast = async () => {
    try {
      await Share.share({
        title: `Promosi PIN Atlet ${profile?.name || 'Flex Pace'}`,
        message: getBbmBroadcastText(),
      });
      setPromoteModalVisible(false);
    } catch (e: any) {
      Alert.alert('Gagal Membagikan', e.message);
    }
  };

  const handleStartChat = () => {
    navigation.navigate('Chat', {
      recipientId: userId,
      recipientName: profile?.name || userName || 'Flex Athlete',
      recipientAvatar: profile?.avatar_url || userAvatar,
      isVip: profile?.is_premium,
    });
  };

  const handleSendContactCardToChat = () => {
    setPromoteModalVisible(false);
    // Langsung navigasi ke obrolan dengan kartu kontak terlampir
    navigation.navigate('Chat', {
      recipientId: userId,
      recipientName: profile?.name || userName || 'Flex Athlete',
      recipientAvatar: profile?.avatar_url || userAvatar,
      isVip: profile?.is_premium,
      promoCard: {
        pin: athletePin,
        name: profile?.name || userName,
        avatar: profile?.avatar_url || userAvatar,
        stats: `${stats.totalDistanceKm.toFixed(1)} KM • ${stats.totalActivities} sesi`,
        isVip: profile?.is_premium
      }
    });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#D7FF00" />
        <Text style={styles.loadingText}>Memuat profil atlet...</Text>
      </View>
    );
  }

  const displayAvatar = profile?.avatar_url || userAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80';
  const displayName = profile?.name || userName || 'Flex Athlete';
  const isVip = !!profile?.is_premium;

  return (
    <View style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#D7FF00']} tintColor="#D7FF00" />
        }
      >
        {/* HEADER COVER CARD */}
        <View style={styles.profileHeaderCard}>
          <View style={styles.glowOrb} />

          <View style={styles.avatarRow}>
            {/* AVATAR DENGAN PREVIEW ON PRESS */}
            <TouchableOpacity 
              onPress={() => setLightboxVisible(true)}
              activeOpacity={0.85}
              style={[styles.avatarContainer, isVip && styles.avatarContainerVip]}
            >
              <Image source={{ uri: displayAvatar }} style={[styles.avatar, isVip && styles.avatarVip]} />
              <View style={styles.zoomIconBadge}>
                <Ionicons name="expand" size={12} color="#000000" />
              </View>
            </TouchableOpacity>

            <View style={styles.headerInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.displayName}>{displayName}</Text>
                {isVip && (
                  <View style={styles.vipCrownBadge}>
                    <Ionicons name="trophy" size={11} color="#000000" style={{ marginRight: 3 }} />
                    <Text style={styles.vipCrownText}>VIP PRO</Text>
                  </View>
                )}
              </View>

              {/* PIN ATLET ALA BBM */}
              <View style={styles.pinRow}>
                <Ionicons name="keypad" size={12} color="#FFD700" style={{ marginRight: 4 }} />
                <Text style={styles.pinLabel}>PIN ATLET: </Text>
                <Text style={styles.pinValue}>{athletePin}</Text>
              </View>

              {/* BADGES */}
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
                {isVip && (
                  <View style={[styles.capsuleBadge, styles.premiumBadge]}>
                    <Ionicons name="star" size={10} color="#000000" style={{ marginRight: 3 }} />
                    <Text style={styles.premiumText}>PRO</Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* BIO */}
          <View style={styles.bioContainer}>
            <Text style={styles.bioText}>
              {profile?.bio || 'Tidak ada bio yang dicantumkan oleh atlet ini.'}
            </Text>
          </View>

          {/* ACTION BUTTONS: IKUTI, CHAT, PROMOSIKAN (BBM) */}
          <View style={styles.actionsRow}>
            {/* Tombol Ikuti / Mengikuti */}
            <TouchableOpacity 
              style={[styles.followBtn, isFollowing && styles.followBtnActive]}
              onPress={toggleFollow}
              activeOpacity={0.8}
            >
              <Ionicons 
                name={isFollowing ? "checkmark" : "person-add"} 
                size={16} 
                color={isFollowing ? "#FFFFFF" : "#000000"} 
                style={{ marginRight: 6 }} 
              />
              <Text style={[styles.followBtnText, isFollowing && styles.followBtnTextActive]}>
                {isFollowing ? 'Mengikuti' : 'Ikuti Atlet'}
              </Text>
            </TouchableOpacity>

            {/* Tombol Chat Langsung */}
            <TouchableOpacity 
              style={styles.chatActionBtn} 
              onPress={handleStartChat}
              activeOpacity={0.8}
            >
              <Ionicons name="chatbubbles" size={18} color="#D7FF00" style={{ marginRight: 6 }} />
              <Text style={styles.chatActionBtnText}>Chat</Text>
            </TouchableOpacity>

            {/* Tombol Promosikan (BBM Style) */}
            <TouchableOpacity 
              style={styles.promoteActionBtn} 
              onPress={() => setPromoteModalVisible(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="megaphone" size={18} color="#FFD700" />
            </TouchableOpacity>
          </View>
        </View>

        {/* STATS OVERVIEW */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>STATISTIK ATLET</Text>
            <Text style={styles.sectionSubtitle}>Catatan resmi Flex Pace</Text>
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

            <View style={[styles.statTile, { width: '100%' }]}>
              <View style={styles.statIconBadge}>
                <Ionicons name="trophy-outline" size={18} color="#FFD60A" />
              </View>
              <Text style={styles.statMainValue}>
                {stats.longestRunKm.toFixed(1)}
                <Text style={styles.statUnit}> km</Text>
              </Text>
              <Text style={styles.statLabel}>Rekor Sesi Terjauh</Text>
            </View>
          </View>
        </View>

        {/* FEED POSTINGAN ATLET */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>POSTINGAN & MOMEN</Text>
            <Text style={styles.sectionSubtitle}>{userPosts.length} post</Text>
          </View>

          {userPosts.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="images-outline" size={32} color="#52525B" />
              <Text style={styles.emptyCardText}>Belum ada foto atau momen yang dibagikan atlet ini.</Text>
            </View>
          ) : (
            <View style={styles.postsGrid}>
              {userPosts.map((p) => (
                <View key={p.id} style={styles.postThumbnailBox}>
                  {p.image_url ? (
                    <Image source={{ uri: p.image_url }} style={styles.postThumbnail} resizeMode="cover" />
                  ) : (
                    <View style={styles.textOnlyPostBox}>
                      <Text style={styles.textOnlyPost} numberOfLines={3}>{p.caption}</Text>
                    </View>
                  )}
                  {p.sport_type && (
                    <View style={styles.postSportBadge}>
                      <Text style={styles.postSportText}>{p.sport_type}</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* ============================================================ */}
      {/* MODAL 1: PREVIEW FOTO PROFIL (FULLSCREEN LIGHTBOX ZOOM)      */}
      {/* ============================================================ */}
      <Modal
        visible={lightboxVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setLightboxVisible(false)}
      >
        <View style={styles.lightboxBackdrop}>
          {/* Header Lightbox */}
          <View style={styles.lightboxHeader}>
            <View>
              <Text style={styles.lightboxTitle}>{displayName}</Text>
              <Text style={styles.lightboxSub}>PIN: {athletePin}</Text>
            </View>
            <TouchableOpacity 
              style={styles.lightboxCloseBtn} 
              onPress={() => setLightboxVisible(false)}
              activeOpacity={0.8}
            >
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Foto Ukuran Penuh */}
          <View style={styles.lightboxImageContainer}>
            <Image 
              source={{ uri: displayAvatar }} 
              style={styles.lightboxImage} 
              resizeMode="contain" 
            />
          </View>

          {/* Footer Lightbox */}
          <View style={styles.lightboxFooter}>
            <Text style={styles.lightboxFooterText}>Foto Profil Resmi Atlet Flex Pace</Text>
            <TouchableOpacity 
              style={styles.lightboxActionBtn}
              onPress={() => {
                Share.share({
                  title: `Foto Profil ${displayName}`,
                  message: `Lihat profil atlet ${displayName} di Flex Pace: ${displayAvatar}`,
                });
              }}
            >
              <Ionicons name="share-outline" size={16} color="#000000" style={{ marginRight: 6 }} />
              <Text style={styles.lightboxActionBtnText}>Bagikan Foto</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ============================================================ */}
      {/* MODAL 2: PROMOSIKAN AKUN (BBM STYLE BROADCAST & PIN CARD)    */}
      {/* ============================================================ */}
      <Modal
        visible={promoteModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setPromoteModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.promoteSheetCard}>
            <View style={styles.promoteSheetHeader}>
              <View style={styles.bbmIconBadge}>
                <Ionicons name="megaphone" size={22} color="#000000" />
              </View>
              <Text style={styles.promoteSheetTitle}>PROMOSIKAN ATLET (BBM STYLE)</Text>
              <Text style={styles.promoteSheetSub}>
                Bagikan PIN dan profil atlet ini kepada rekan atau grup olahraga Anda layaknya fitur legendaris BlackBerry Messenger!
              </Text>
            </View>

            {/* PREVIEW KARTU KONTAK BBM */}
            <View style={styles.bbmCardPreview}>
              <View style={styles.bbmCardTop}>
                <Image source={{ uri: displayAvatar }} style={styles.bbmAvatar} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.bbmName}>{displayName}</Text>
                  <View style={styles.bbmPinBadge}>
                    <Ionicons name="keypad" size={11} color="#000000" style={{ marginRight: 4 }} />
                    <Text style={styles.bbmPinText}>PIN: {athletePin}</Text>
                  </View>
                  <Text style={styles.bbmStatsText}>
                    ⚡ {stats.totalDistanceKm.toFixed(1)} KM • Rekor {stats.longestRunKm.toFixed(1)} KM
                  </Text>
                </View>
              </View>

              <View style={styles.bbmDivider} />
              
              <Text style={styles.bbmQuoteText}>
                {profile?.bio || 'Mari ukur kecepatan dan tanding lari bareng di Flex Pace!'}
              </Text>
            </View>

            {/* PILIHAN DISTRIBUSI */}
            <TouchableOpacity 
              style={styles.bbmBroadcastBtn}
              onPress={handleShareBbmBroadcast}
              activeOpacity={0.85}
            >
              <Ionicons name="share-social" size={18} color="#000000" style={{ marginRight: 8 }} />
              <Text style={styles.bbmBroadcastBtnText}>Broadcast ke WhatsApp / Sosmed</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.bbmChatSendBtn}
              onPress={handleSendContactCardToChat}
              activeOpacity={0.85}
            >
              <Ionicons name="chatbubble-ellipses" size={18} color="#D7FF00" style={{ marginRight: 8 }} />
              <Text style={styles.bbmChatSendBtnText}>Kirim Kartu Kontak ke Chat Flex Pace</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.closeSheetBtn}
              onPress={() => setPromoteModalVisible(false)}
            >
              <Text style={styles.closeSheetText}>Batal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
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
  loadingText: {
    color: '#71717A',
    fontSize: 13,
    marginTop: 12,
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
  avatarContainerVip: {
    borderWidth: 2.5,
    borderColor: '#FFD700',
    borderRadius: 45,
    padding: 2,
  },
  avatar: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: '#1E1E24',
    borderWidth: 2,
    borderColor: '#D7FF00',
  },
  avatarVip: {
    borderColor: '#FFD700',
  },
  zoomIconBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#D7FF00',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#131317',
  },
  headerInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  displayName: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.2,
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
  pinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  pinLabel: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '700',
  },
  pinValue: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
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
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  bioText: {
    color: '#D4D4D8',
    fontSize: 13,
    lineHeight: 19,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 8,
  },
  followBtn: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D7FF00',
    paddingVertical: 10,
    borderRadius: 14,
  },
  followBtnActive: {
    backgroundColor: '#27272A',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  followBtnText: {
    color: '#000000',
    fontWeight: '800',
    fontSize: 13,
  },
  followBtnTextActive: {
    color: '#FFFFFF',
  },
  chatActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E1E26',
    borderWidth: 1,
    borderColor: 'rgba(215, 255, 0, 0.3)',
    paddingVertical: 10,
    borderRadius: 14,
  },
  chatActionBtnText: {
    color: '#D7FF00',
    fontWeight: '800',
    fontSize: 13,
  },
  promoteActionBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#26220E',
    borderWidth: 1.5,
    borderColor: '#FFD700',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // STATS
  sectionContainer: {
    marginBottom: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
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
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  statIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  statMainValue: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  statUnit: {
    fontSize: 12,
    fontWeight: '600',
    color: '#A1A1AA',
  },
  statLabel: {
    color: '#71717A',
    fontSize: 11,
    marginTop: 2,
  },

  // POSTS
  emptyCard: {
    backgroundColor: '#131317',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  emptyCardText: {
    color: '#71717A',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
  postsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  postThumbnailBox: {
    width: (SCREEN_WIDTH - 48) / 3,
    height: (SCREEN_WIDTH - 48) / 3,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1C1C24',
    position: 'relative',
  },
  postThumbnail: {
    width: '100%',
    height: '100%',
  },
  textOnlyPostBox: {
    flex: 1,
    padding: 8,
    justifyContent: 'center',
  },
  textOnlyPost: {
    color: '#D4D4D8',
    fontSize: 10,
    lineHeight: 14,
  },
  postSportBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  postSportText: {
    color: '#D7FF00',
    fontSize: 8,
    fontWeight: '800',
  },

  // FULLSCREEN LIGHTBOX MODAL
  lightboxBackdrop: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'space-between',
  },
  lightboxHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 54,
    paddingBottom: 16,
  },
  lightboxTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  lightboxSub: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  lightboxCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lightboxImageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  lightboxImage: {
    width: SCREEN_WIDTH - 20,
    height: SCREEN_WIDTH - 20,
    borderRadius: 20,
  },
  lightboxFooter: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  lightboxFooterText: {
    color: '#71717A',
    fontSize: 12,
    marginBottom: 14,
  },
  lightboxActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D7FF00',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
  },
  lightboxActionBtnText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '800',
  },

  // BBM PROMOTE MODAL
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'flex-end',
  },
  promoteSheetCard: {
    backgroundColor: '#14141A',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1.5,
    borderColor: '#FFD700',
    padding: 22,
    paddingBottom: 36,
  },
  promoteSheetHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  bbmIconBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  promoteSheetTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  promoteSheetSub: {
    color: '#A1A1AA',
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 10,
  },
  bbmCardPreview: {
    backgroundColor: '#1C1C24',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#3F3B20',
    padding: 14,
    marginBottom: 18,
  },
  bbmCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bbmAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  bbmName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  bbmPinBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#FFD700',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    marginVertical: 4,
  },
  bbmPinText: {
    color: '#000000',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  bbmStatsText: {
    color: '#D7FF00',
    fontSize: 11,
    fontWeight: '700',
  },
  bbmDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: 10,
  },
  bbmQuoteText: {
    color: '#A1A1AA',
    fontSize: 11,
    fontStyle: 'italic',
    lineHeight: 15,
  },
  bbmBroadcastBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFD700',
    paddingVertical: 14,
    borderRadius: 16,
    marginBottom: 10,
  },
  bbmBroadcastBtnText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '900',
  },
  bbmChatSendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1F1F28',
    borderWidth: 1,
    borderColor: '#D7FF00',
    paddingVertical: 13,
    borderRadius: 16,
    marginBottom: 10,
  },
  bbmChatSendBtnText: {
    color: '#D7FF00',
    fontSize: 13,
    fontWeight: '800',
  },
  closeSheetBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  closeSheetText: {
    color: '#71717A',
    fontSize: 13,
    fontWeight: '600',
  }
});
