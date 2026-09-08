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
  Alert 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

interface AthleteProfile {
  id: string;
  name: string;
  avatar_url?: string;
  role?: string;
  is_premium?: boolean;
}

export default function InviteFriendsScreen() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [inviteCode, setInviteCode] = useState('FP-ATHLETE');
  const [searchQuery, setSearchQuery] = useState('');
  const [athletes, setAthletes] = useState<AthleteProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [followingMap, setFollowingMap] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    initData();
  }, []);

  const initData = async () => {
    try {
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
        // Filter agar akun sendiri tidak muncul di daftar pencarian
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

  const handleShareInvite = async () => {
    try {
      const athleteName = currentUser?.user_metadata?.name || currentUser?.email?.split('@')[0] || 'Temanmu';
      await Share.share({
        message: `🔥 Ayo gabung dan ukur pacemu bareng ${athleteName} di aplikasi Flex Pace!\n\nGunakan kode undangan: *${inviteCode}*\nUnduh aplikasi sekarang: https://flexpace.app/join?code=${inviteCode}`,
        title: 'Undangan Bergabung Flex Pace',
      });
    } catch (error: any) {
      console.log('Error sharing invite:', error.message);
    }
  };

  const handleCopyLink = () => {
    Alert.alert('Tautan Tersalin!', `Tautan undangan berhasil disalin:\nhttps://flexpace.app/join?code=${inviteCode}`);
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
              <View style={styles.heroIconBadge}>
                <Ionicons name="people" size={28} color="#000000" />
              </View>

              <Text style={styles.heroTitle}>UNDANG ATLET & TEMAN</Text>
              <Text style={styles.heroDescription}>
                Ajak teman lari dan gowesmu bergabung. Pantau kecepatan pace mereka di feed sosial secara real-time!
              </Text>

              {/* INVITE CODE BOX */}
              <View style={styles.codeContainer}>
                <View>
                  <Text style={styles.codeLabel}>KODE UNDANGAN ANDA</Text>
                  <Text style={styles.codeValue}>{inviteCode}</Text>
                </View>
                <TouchableOpacity style={styles.copyBtn} onPress={handleCopyLink} activeOpacity={0.8}>
                  <Ionicons name="copy-outline" size={16} color="#D7FF00" style={{ marginRight: 4 }} />
                  <Text style={styles.copyBtnText}>Salin</Text>
                </TouchableOpacity>
              </View>

              {/* ACTION SHARE BUTTON */}
              <TouchableOpacity style={styles.shareBtn} onPress={handleShareInvite} activeOpacity={0.85}>
                <Ionicons name="logo-whatsapp" size={18} color="#000000" style={{ marginRight: 8 }} />
                <Text style={styles.shareBtnText}>Bagikan Tautan Undangan</Text>
              </TouchableOpacity>
            </View>

            {/* SEARCH SECTION */}
            <View style={styles.searchSection}>
              <Text style={styles.sectionTitle}>TEMUKAN ATLET LAIN</Text>
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
                  {item.is_premium && (
                    <Ionicons name="checkmark-circle" size={14} color="#D7FF00" style={{ marginLeft: 4 }} />
                  )}
                </View>
                <Text style={styles.athleteTag}>
                  {item.role === 'organizer' ? '⚡ Organizer' : '🏃 Atlet Lari'}
                </Text>
              </View>

              <TouchableOpacity 
                style={[styles.followBtn, isFollowing && styles.followBtnActive]}
                onPress={() => toggleFollow(item.id)}
                activeOpacity={0.8}
              >
                <Ionicons 
                  name={isFollowing ? "checkmark" : "person-add"} 
                  size={14} 
                  color={isFollowing ? "#FFFFFF" : "#000000"} 
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
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(215, 255, 0, 0.08)',
  },
  heroIconBadge: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#D7FF00',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    shadowColor: '#D7FF00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1,
  },
  heroDescription: {
    color: '#A1A1AA',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
    marginBottom: 18,
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

  // SEARCH SECTION
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

  // ATHLETE CARD
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
  }
});
