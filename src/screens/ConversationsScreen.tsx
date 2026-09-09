import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  Image, 
  TextInput, 
  ActivityIndicator,
  RefreshControl 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

interface ConversationItem {
  recipientId: string;
  recipientName: string;
  recipientAvatar: string;
  isVip?: boolean;
  lastMessage: string;
  timestamp: string;
  pin: string;
}

export default function ConversationsScreen() {
  const navigation = useNavigation<any>();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      const convKey = '@fp_active_conversations';
      const convJson = await AsyncStorage.getItem(convKey);
      let list: ConversationItem[] = convJson ? JSON.parse(convJson) : [];

      // Jika belum ada riwayat chat sama sekali, buatkan kontak awal atlet komunitas
      if (list.length === 0) {
        const { data: athletes } = await supabase
          .from('profiles')
          .select('id, name, avatar_url, is_premium')
          .limit(4);

        if (athletes && athletes.length > 0) {
          list = athletes.map((a, idx) => ({
            recipientId: a.id,
            recipientName: a.name || `Atlet ${idx + 1}`,
            recipientAvatar: a.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&q=80',
            isVip: !!a.is_premium,
            lastMessage: idx === 0 ? '⚡ * P I N G ! ! ! *' : 'Halo! Salam kenal sesama pelari Flex Pace! 🏃',
            timestamp: new Date(Date.now() - idx * 7200000).toISOString(),
            pin: a.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase(),
          }));
          await AsyncStorage.setItem(convKey, JSON.stringify(list));
        }
      }

      setConversations(list);
    } catch (e) {
      console.log('Error loading conversations:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadConversations();
  };

  const filtered = conversations.filter(c => 
    c.recipientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.pin.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatTime = (isoString: string) => {
    const d = new Date(isoString);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  };

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>CHAT TEMAN ATLET</Text>
        <TouchableOpacity 
          style={styles.newChatBtn}
          onPress={() => navigation.navigate('InviteFriends')}
          activeOpacity={0.8}
        >
          <Ionicons name="create-outline" size={22} color="#D7FF00" />
        </TouchableOpacity>
      </View>

      {/* SEARCH BAR */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={16} color="#71717A" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Cari teman atau PIN BBM atlet..."
            placeholderTextColor="#71717A"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color="#71717A" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* CONVERSATION LIST */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#D7FF00" size="large" />
          <Text style={styles.loadingText}>Memuat percakapan...</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.recipientId}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#D7FF00']} tintColor="#D7FF00" />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubbles-outline" size={44} color="#3F3F46" />
              <Text style={styles.emptyTitle}>Belum Ada Obrolan</Text>
              <Text style={styles.emptySubtitle}>
                Mulai percakapan dengan teman atlet atau invite PIN mereka untuk tanding pace bersama.
              </Text>
              <TouchableOpacity 
                style={styles.emptyActionBtn}
                onPress={() => navigation.navigate('InviteFriends')}
                activeOpacity={0.8}
              >
                <Ionicons name="person-add" size={16} color="#000000" style={{ marginRight: 6 }} />
                <Text style={styles.emptyActionBtnText}>Temukan Teman Atlet</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => {
            const isPing = item.lastMessage.includes('P I N G');
            return (
              <TouchableOpacity 
                style={styles.convCard}
                onPress={() => {
                  navigation.navigate('Chat', {
                    recipientId: item.recipientId,
                    recipientName: item.recipientName,
                    recipientAvatar: item.recipientAvatar,
                    isVip: item.isVip,
                  });
                }}
                activeOpacity={0.8}
              >
                <View style={[styles.avatarWrap, item.isVip && styles.avatarWrapVip]}>
                  <Image source={{ uri: item.recipientAvatar }} style={styles.avatar} />
                  <View style={styles.onlineDot} />
                </View>

                <View style={styles.convInfo}>
                  <View style={styles.convTopRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={styles.convName}>{item.recipientName}</Text>
                      {item.isVip && (
                        <View style={styles.vipBadge}>
                          <Text style={styles.vipBadgeText}>VIP</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.timestampText}>{formatTime(item.timestamp)}</Text>
                  </View>

                  <View style={styles.convPinRow}>
                    <Ionicons name="keypad" size={10} color="#FFD700" style={{ marginRight: 3 }} />
                    <Text style={styles.convPinText}>PIN: {item.pin}</Text>
                  </View>

                  <Text 
                    style={[styles.lastMessageText, isPing && styles.lastMessagePing]} 
                    numberOfLines={1}
                  >
                    {item.lastMessage}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
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
  },
  loadingText: {
    color: '#71717A',
    fontSize: 13,
    marginTop: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 52,
    paddingBottom: 14,
    backgroundColor: '#121217',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  backBtn: {
    padding: 6,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  newChatBtn: {
    padding: 6,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#0E0E12',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#191920',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
  },
  listContent: {
    paddingVertical: 8,
  },
  convCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  avatarWrap: {
    position: 'relative',
    marginRight: 14,
  },
  avatarWrapVip: {
    borderWidth: 2,
    borderColor: '#FFD700',
    borderRadius: 26,
    padding: 1.5,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#27272A',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#30D158',
    borderWidth: 2,
    borderColor: '#0A0A0C',
  },
  convInfo: {
    flex: 1,
  },
  convTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  convName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  vipBadge: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
    marginLeft: 6,
  },
  vipBadgeText: {
    color: '#000000',
    fontSize: 9,
    fontWeight: '900',
  },
  timestampText: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '600',
  },
  convPinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    marginBottom: 4,
  },
  convPinText: {
    color: '#FFD700',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  lastMessageText: {
    color: '#A1A1AA',
    fontSize: 13,
  },
  lastMessagePing: {
    color: '#FFD700',
    fontWeight: '900',
    letterSpacing: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 60,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 14,
    marginBottom: 6,
  },
  emptySubtitle: {
    color: '#71717A',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D7FF00',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 16,
  },
  emptyActionBtnText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '800',
  }
});
