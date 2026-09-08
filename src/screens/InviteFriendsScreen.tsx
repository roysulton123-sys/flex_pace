import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  TextInput, 
  FlatList, 
  Image, 
  Share, 
  ActivityIndicator, 
  Alert,
  Modal,
  Linking
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

interface AthleteProfile {
  id: string;
  name: string;
  avatar_url?: string;
  role?: string;
  is_premium?: boolean;
}

const STORAGE_KEY_WEB_URL = '@flexpace_download_website_url';
const DEFAULT_WEB_URL = 'https://flexpace.my.id/download';

export default function InviteFriendsScreen() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [inviteCode, setInviteCode] = useState('FP-ATHLETE');
  const [websiteUrl, setWebsiteUrl] = useState(DEFAULT_WEB_URL);
  const [searchQuery, setSearchQuery] = useState('');
  const [athletes, setAthletes] = useState<AthleteProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [followingMap, setFollowingMap] = useState<{ [key: string]: boolean }>({});

  // Modal Setting Website URL
  const [modalVisible, setModalVisible] = useState(false);
  const [inputWebUrl, setInputWebUrl] = useState('');

  useEffect(() => {
    initData();
  }, []);

  const initData = async () => {
    try {
      // Load saved website URL
      const savedWeb = await AsyncStorage.getItem(STORAGE_KEY_WEB_URL);
      if (savedWeb && savedWeb.trim()) {
        setWebsiteUrl(savedWeb.trim());
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUser(user);
        const code = `FP-${(user.email?.split('@')[0] || user.id.slice(0, 5)).toUpperCase()}`;
        setInviteCode(code);
      }
      await fetchAthletes();
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchAthletes = async (query = '') => {
    try {
      let req = supabase.from('profiles').select('id, name, avatar_url, role, is_premium').limit(20);
      if (query.trim()) {
        req = req.ilike('name', `%${query.trim()}%`);
      }
      const { data, error } = await req;
      if (!error && data) {
        const { data: { user } } = await supabase.auth.getUser();
        const filtered = data.filter((a: any) => a.id !== user?.id);
        setAthletes(filtered);
      }
    } catch (e) {
      console.log(e);
    }
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    fetchAthletes(text);
  };

  const getFullDownloadUrl = () => {
    const cleanUrl = websiteUrl.endsWith('/') ? websiteUrl.slice(0, -1) : websiteUrl;
    const separator = cleanUrl.includes('?') ? '&' : '?';
    return `${cleanUrl}${separator}ref=${inviteCode}`;
  };

  const handleShareInvite = async () => {
    try {
      const athleteName = currentUser?.user_metadata?.name || currentUser?.email?.split('@')[0] || 'Temanmu';
      const downloadLink = getFullDownloadUrl();

      await Share.share({
        message: `🔥 Ayo gabung dan ukur pacemu bareng ${athleteName} di Flex Pace!\n\n📲 Unduh aplikasi APK resmi melalui website:\n${downloadLink}\n\n🔑 Kode Undangan: *${inviteCode}*\n(Masukkan kode saat mendaftar untuk terhubung langsung sebagai rekan lari!)`,
        title: 'Undangan Bergabung Flex Pace',
      });
    } catch (error: any) {
      console.log('Error sharing invite:', error.message);
    }
  };

  const handleCopyLink = () => {
    const downloadLink = getFullDownloadUrl();
    Alert.alert(
      'Tautan Web Download Tersalin!', 
      `Tautan berhasil disalin:\n\n${downloadLink}\n\nTeman yang mengklik tautan ini akan langsung diarahkan ke halaman unduh APK di website Anda!`
    );
  };

  const handleOpenInBrowser = async () => {
    const downloadLink = getFullDownloadUrl();
    try {
      const supported = await Linking.canOpenURL(downloadLink);
      if (supported) {
        await Linking.openURL(downloadLink);
      } else {
        Alert.alert('Info', `Tidak dapat membuka URL: ${downloadLink}`);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Gagal membuka browser');
    }
  };

  const openSettingsModal = () => {
    setInputWebUrl(websiteUrl);
    setModalVisible(true);
  };

  const saveWebsiteUrl = async () => {
    let clean = inputWebUrl.trim();
    if (!clean) {
      clean = DEFAULT_WEB_URL;
    }
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = `https://${clean}`;
    }
    setWebsiteUrl(clean);
    await AsyncStorage.setItem(STORAGE_KEY_WEB_URL, clean);
    setModalVisible(false);
    Alert.alert('Tersimpan', 'Domain website unduh aplikasi berhasil diperbarui!');
  };

  const toggleFollow = (athleteId: string) => {
    setFollowingMap(prev => ({
      ...prev,
      [athleteId]: !prev[athleteId]
    }));
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={athletes}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            {/* HERO INVITE CARD */}
            <View style={styles.inviteHeroCard}>
              <View style={styles.heroGlowOrb} />
              
              <View style={styles.heroTopBar}>
                <View style={styles.heroIconBadge}>
                  <Ionicons name="people" size={26} color="#000000" />
                </View>
                <TouchableOpacity 
                  style={styles.domainConfigBtn} 
                  onPress={openSettingsModal}
                  activeOpacity={0.8}
                >
                  <Ionicons name="globe-outline" size={14} color="#D7FF00" style={{ marginRight: 4 }} />
                  <Text style={styles.domainConfigText}>Domain Web</Text>
                  <Ionicons name="pencil" size={11} color="#D7FF00" style={{ marginLeft: 3 }} />
                </TouchableOpacity>
              </View>

              <Text style={styles.heroTitle}>UNDANG ATLET KE FLEX PACE</Text>
              <Text style={styles.heroDescription}>
                Bagikan tautan download website resmi Anda ke WhatsApp / medsos. Teman yang membuka akan langsung diarahkan ke halaman unduh APK!
              </Text>

              {/* TAUTAN DOWNLOAD WEBSITE CARD */}
              <View style={styles.webLinkBox}>
                <View style={styles.webLinkHeader}>
                  <Ionicons name="link" size={14} color="#D7FF00" style={{ marginRight: 6 }} />
                  <Text style={styles.webLinkLabel}>TAUTAN DOWNLOAD WEBSITE ANDA</Text>
                </View>
                <Text style={styles.webLinkText} numberOfLines={1}>
                  {getFullDownloadUrl()}
                </Text>
              </View>

              {/* INVITE CODE BOX */}
              <View style={styles.codeContainer}>
                <View>
                  <Text style={styles.codeLabel}>KODE REFERRAL ANDA</Text>
                  <Text style={styles.codeValue}>{inviteCode}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity style={styles.testWebBtn} onPress={handleOpenInBrowser} activeOpacity={0.8}>
                    <Ionicons name="open-outline" size={14} color="#A1A1AA" style={{ marginRight: 4 }} />
                    <Text style={styles.testWebBtnText}>Uji Web</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.copyBtn} onPress={handleCopyLink} activeOpacity={0.8}>
                    <Ionicons name="copy-outline" size={14} color="#D7FF00" style={{ marginRight: 4 }} />
                    <Text style={styles.copyBtnText}>Salin</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* ACTION SHARE BUTTON */}
              <TouchableOpacity style={styles.shareBtn} onPress={handleShareInvite} activeOpacity={0.85}>
                <Ionicons name="logo-whatsapp" size={18} color="#000000" style={{ marginRight: 8 }} />
                <Text style={styles.shareBtnText}>Bagikan Tautan Undangan Web</Text>
              </TouchableOpacity>
            </View>

            {/* SEARCH SECTION */}
            <View style={styles.searchSection}>
              <Text style={styles.sectionTitle}>TEMUKAN ATLET LAIN DI SEKITAR</Text>
              <View style={styles.searchBar}>
                <Ionicons name="search-outline" size={18} color="#71717A" style={{ marginRight: 10 }} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Cari atlet berdasarkan nama..."
                  placeholderTextColor="#52525B"
                  value={searchQuery}
                  onChangeText={handleSearch}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => handleSearch('')}>
                    <Ionicons name="close-circle" size={18} color="#71717A" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color="#D7FF00" style={{ marginTop: 30 }} />
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="person-outline" size={40} color="#3F3F46" />
              <Text style={styles.emptyText}>Belum ada atlet yang cocok ditemukan.</Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          const isFollowing = !!followingMap[item.id];
          return (
            <View style={styles.athleteCard}>
              <Image 
                source={{ uri: item.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80' }} 
                style={styles.athleteAvatar} 
              />
              <View style={styles.athleteInfo}>
                <View style={styles.athleteNameRow}>
                  <Text style={styles.athleteName}>{item.name || 'Flex Athlete'}</Text>
                  {item.role === 'organizer' && (
                    <View style={styles.organizerBadge}>
                      <Text style={styles.organizerBadgeText}>ORGANIZER</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.athleteTag}>🏃 Atlet Flex Pace</Text>
              </View>

              <TouchableOpacity 
                style={[styles.followBtn, isFollowing && styles.followBtnActive]}
                onPress={() => toggleFollow(item.id)}
                activeOpacity={0.8}
              >
                <Ionicons 
                  name={isFollowing ? "checkmark" : "person-add"} 
                  size={14} 
                  color={isFollowing ? "#A1A1AA" : "#000000"} 
                  style={{ marginRight: 4 }} 
                />
                <Text style={[styles.followBtnText, isFollowing && styles.followBtnTextActive]}>
                  {isFollowing ? 'Mengikuti' : 'Ikuti'}
                </Text>
              </TouchableOpacity>
            </View>
          );
        }}
      />

      {/* MODAL PENGATURAN DOMAIN WEBSITE HOSTINGER */}
      <Modal
        visible={modalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="globe" size={20} color="#D7FF00" style={{ marginRight: 8 }} />
                <Text style={styles.modalTitle}>Domain Website Download</Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={22} color="#A1A1AA" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalDesc}>
              Masukkan alamat website Hostinger Pro atau GitHub Pages Anda di mana pengunjung dapat mengunduh APK aplikasi:
            </Text>

            <TextInput
              style={styles.modalInput}
              value={inputWebUrl}
              onChangeText={setInputWebUrl}
              placeholder="https://namadomainanda.com/download"
              placeholderTextColor="#666"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={styles.modalTipBox}>
              <Ionicons name="information-circle-outline" size={16} color="#D7FF00" style={{ marginRight: 6 }} />
              <Text style={styles.modalTipText}>
                File template website siap pakai (HTML & CSS) telah kami siapkan di folder <Text style={{ color: '#D7FF00', fontWeight: 'bold' }}>website_hostinger/</Text> untuk di-upload ke Hostinger!
              </Text>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalCancelBtn} 
                onPress={() => setModalVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCancelText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.modalSaveBtn} 
                onPress={saveWebsiteUrl}
                activeOpacity={0.8}
              >
                <Text style={styles.modalSaveText}>Simpan Perubahan</Text>
              </TouchableOpacity>
            </View>
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
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  inviteHeroCard: {
    backgroundColor: '#131317',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    position: 'relative',
    overflow: 'hidden',
    marginBottom: 24,
  },
  heroGlowOrb: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(215, 255, 0, 0.08)',
  },
  heroTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  heroIconBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#D7FF00',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#D7FF00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  domainConfigBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(215, 255, 0, 0.12)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(215, 255, 0, 0.3)',
  },
  domainConfigText: {
    color: '#D7FF00',
    fontSize: 12,
    fontWeight: '800',
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  heroDescription: {
    color: '#A1A1AA',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
    marginBottom: 16,
  },
  webLinkBox: {
    backgroundColor: '#181820',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(215, 255, 0, 0.2)',
    marginBottom: 12,
  },
  webLinkHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  webLinkLabel: {
    color: '#D7FF00',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  webLinkText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1C1C22',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 14,
  },
  codeLabel: {
    color: '#71717A',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  codeValue: {
    color: '#D7FF00',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
    marginTop: 2,
  },
  testWebBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#27272A',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  testWebBtnText: {
    color: '#D4D4D8',
    fontSize: 11,
    fontWeight: '700',
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(215, 255, 0, 0.1)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(215, 255, 0, 0.3)',
  },
  copyBtnText: {
    color: '#D7FF00',
    fontSize: 12,
    fontWeight: '800',
  },
  shareBtn: {
    flexDirection: 'row',
    backgroundColor: '#D7FF00',
    paddingVertical: 14,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#D7FF00',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  shareBtnText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  searchSection: {
    marginBottom: 14,
  },
  sectionTitle: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141418',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  athleteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141418',
    borderRadius: 18,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  athleteAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1E1E24',
    borderWidth: 1.5,
    borderColor: '#D7FF00',
    marginRight: 12,
  },
  athleteInfo: {
    flex: 1,
  },
  athleteNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  athleteName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  organizerBadge: {
    backgroundColor: 'rgba(215, 255, 0, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 6,
  },
  organizerBadgeText: {
    color: '#D7FF00',
    fontSize: 9,
    fontWeight: '900',
  },
  athleteTag: {
    color: '#71717A',
    fontSize: 12,
    marginTop: 2,
  },
  followBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D7FF00',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  followBtnActive: {
    backgroundColor: '#27272A',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  followBtnText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '800',
  },
  followBtnTextActive: {
    color: '#E4E4E7',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  emptyText: {
    color: '#71717A',
    fontSize: 13,
    marginTop: 8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#141419',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  modalDesc: {
    fontSize: 13,
    color: '#A1A1AA',
    lineHeight: 18,
    marginBottom: 14,
  },
  modalInput: {
    backgroundColor: '#0A0A0C',
    borderRadius: 12,
    padding: 12,
    color: '#FFFFFF',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#333338',
    marginBottom: 14,
  },
  modalTipBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(215, 255, 0, 0.08)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 18,
    alignItems: 'flex-start',
  },
  modalTipText: {
    flex: 1,
    color: '#D4D4D8',
    fontSize: 12,
    lineHeight: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#27272A',
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  modalSaveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#D7FF00',
    alignItems: 'center',
  },
  modalSaveText: {
    color: '#000000',
    fontWeight: '900',
    fontSize: 13,
  }
});
