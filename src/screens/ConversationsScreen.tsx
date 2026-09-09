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
  RefreshControl, 
  Alert,
  Modal,
  ScrollView,
  Switch
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
  isMuted?: boolean;
}

interface BlockedUser {
  id: string;
  name: string;
  avatar: string;
  pin: string;
  blockedAt: string;
}

interface ChatSettings {
  pingBuzz: boolean;
  notifications: boolean;
  messagePreview: boolean;
  readReceipts: boolean;
}

export default function ConversationsScreen() {
  const navigation = useNavigation<any>();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // 3-Dots Main Menu Modal
  const [menuModalVisible, setMenuModalVisible] = useState(false);

  // Sub-Modals: 'archive' | 'blocked' | 'broadcast' | 'settings' | null
  const [activeSubModal, setActiveSubModal] = useState<'archive' | 'blocked' | 'broadcast' | 'settings' | null>(null);

  // Long-Pressed Conversation (for action sheet / modal)
  const [selectedConv, setSelectedConv] = useState<ConversationItem | null>(null);

  // Sub-feature states
  const [archivedChats, setArchivedChats] = useState<ConversationItem[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [chatSettings, setChatSettings] = useState<ChatSettings>({
    pingBuzz: true,
    notifications: true,
    messagePreview: true,
    readReceipts: true,
  });

  useEffect(() => {
    loadConversations();
    loadArchivedChats();
    loadBlockedUsers();
    loadChatSettings();
  }, []);

  const loadConversations = async () => {
    try {
      const convKey = '@fp_active_conversations';
      const convJson = await AsyncStorage.getItem(convKey);
      const list: ConversationItem[] = convJson ? JSON.parse(convJson) : [];
      setConversations(list);
    } catch (e) {
      console.log('Error loading conversations:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadArchivedChats = async () => {
    try {
      const arcKey = '@fp_archived_chats';
      const arcJson = await AsyncStorage.getItem(arcKey);
      const list: ConversationItem[] = arcJson ? JSON.parse(arcJson) : [];
      setArchivedChats(list);
    } catch (e) {
      console.log('Error loading archived chats:', e);
    }
  };

  const loadBlockedUsers = async () => {
    try {
      const blkKey = '@fp_blocked_users';
      const blkJson = await AsyncStorage.getItem(blkKey);
      const list: BlockedUser[] = blkJson ? JSON.parse(blkJson) : [];
      setBlockedUsers(list);
    } catch (e) {
      console.log('Error loading blocked users:', e);
    }
  };

  const loadChatSettings = async () => {
    try {
      const setKey = '@fp_chat_settings';
      const setJson = await AsyncStorage.getItem(setKey);
      if (setJson) {
        setChatSettings(JSON.parse(setJson));
      }
    } catch (e) {
      console.log('Error loading chat settings:', e);
    }
  };

  const updateSetting = async (key: keyof ChatSettings, val: boolean) => {
    try {
      const updated = { ...chatSettings, [key]: val };
      setChatSettings(updated);
      await AsyncStorage.setItem('@fp_chat_settings', JSON.stringify(updated));
    } catch (e) {
      console.log('Error updating setting:', e);
    }
  };

  // --- ACTIONS FOR LONG-PRESSED CONVERSATION ---
  const handleArchiveConversation = async (item: ConversationItem) => {
    setSelectedConv(null);
    try {
      const arcKey = '@fp_archived_chats';
      const arcJson = await AsyncStorage.getItem(arcKey);
      let arcList: ConversationItem[] = arcJson ? JSON.parse(arcJson) : [];
      if (!arcList.some(c => c.recipientId === item.recipientId)) {
        arcList.unshift(item);
        await AsyncStorage.setItem(arcKey, JSON.stringify(arcList));
        setArchivedChats(arcList);
      }

      const convKey = '@fp_active_conversations';
      const updatedConvs = conversations.filter(c => c.recipientId !== item.recipientId);
      setConversations(updatedConvs);
      await AsyncStorage.setItem(convKey, JSON.stringify(updatedConvs));

      Alert.alert('Obrolan Diarsipkan', `Percakapan dengan ${item.recipientName} telah dipindahkan ke Arsip Chat.`);
    } catch (e) {
      console.log('Error archiving conversation:', e);
    }
  };

  const handleToggleMuteConversation = async (item: ConversationItem) => {
    setSelectedConv(null);
    try {
      const updatedConvs = conversations.map(c => {
        if (c.recipientId === item.recipientId) {
          return { ...c, isMuted: !c.isMuted };
        }
        return c;
      });
      setConversations(updatedConvs);
      await AsyncStorage.setItem('@fp_active_conversations', JSON.stringify(updatedConvs));

      const isNowMuted = !item.isMuted;
      Alert.alert(
        isNowMuted ? 'Obrolan Dibisukan' : 'Bunyikan Obrolan',
        `Notifikasi dari ${item.recipientName} ${isNowMuted ? 'telah dibisukan.' : 'kini diaktifkan kembali.'}`
      );
    } catch (e) {
      console.log('Error toggling mute:', e);
    }
  };

  const handleBlockFromCard = (item: ConversationItem) => {
    setSelectedConv(null);
    Alert.alert(
      'Blokir Kontak Atlet?',
      `Apakah Anda yakin ingin memblokir ${item.recipientName}? Anda tidak akan menerima pesan dari pengguna ini.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Blokir',
          style: 'destructive',
          onPress: async () => {
            try {
              const blkKey = '@fp_blocked_users';
              const blkJson = await AsyncStorage.getItem(blkKey);
              let blkList: BlockedUser[] = blkJson ? JSON.parse(blkJson) : [];
              if (!blkList.some(u => u.id === item.recipientId)) {
                blkList.push({
                  id: item.recipientId,
                  name: item.recipientName,
                  avatar: item.recipientAvatar,
                  pin: item.pin,
                  blockedAt: new Date().toISOString(),
                });
                await AsyncStorage.setItem(blkKey, JSON.stringify(blkList));
                setBlockedUsers(blkList);
              }

              const updatedConvs = conversations.filter(c => c.recipientId !== item.recipientId);
              setConversations(updatedConvs);
              await AsyncStorage.setItem('@fp_active_conversations', JSON.stringify(updatedConvs));

              Alert.alert('Pengguna Diblokir', `${item.recipientName} telah ditambahkan ke daftar blokir.`);
            } catch (e) {
              console.log('Error blocking user:', e);
            }
          }
        }
      ]
    );
  };

  const handleDeleteConversation = (item: ConversationItem) => {
    setSelectedConv(null);
    Alert.alert(
      'Hapus Percakapan?',
      `Apakah Anda yakin ingin menghapus seluruh percakapan dengan ${item.recipientName}? Riwayat pesan akan dibersihkan permanen.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              const convKey = '@fp_active_conversations';
              const updated = conversations.filter(c => c.recipientId !== item.recipientId);
              setConversations(updated);
              await AsyncStorage.setItem(convKey, JSON.stringify(updated));
              await AsyncStorage.removeItem(`@fp_chat_${item.recipientId}`);
            } catch (e) {
              console.log('Error deleting conversation:', e);
            }
          }
        }
      ]
    );
  };

  // --- ACTIONS FOR ARCHIVED CHATS ---
  const handleRestoreArchived = async (item: ConversationItem) => {
    try {
      const updatedArc = archivedChats.filter(c => c.recipientId !== item.recipientId);
      setArchivedChats(updatedArc);
      await AsyncStorage.setItem('@fp_archived_chats', JSON.stringify(updatedArc));

      const updatedConvs = [item, ...conversations.filter(c => c.recipientId !== item.recipientId)];
      setConversations(updatedConvs);
      await AsyncStorage.setItem('@fp_active_conversations', JSON.stringify(updatedConvs));

      Alert.alert('Arsip Dipulihkan', `Percakapan dengan ${item.recipientName} dikembalikan ke daftar chat.`);
    } catch (e) {
      console.log('Error restoring archived chat:', e);
    }
  };

  const handleDeleteArchived = (item: ConversationItem) => {
    Alert.alert(
      'Hapus Arsip Permanen?',
      `Hapus permanen arsip percakapan dengan ${item.recipientName}?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              const updated = archivedChats.filter(c => c.recipientId !== item.recipientId);
              setArchivedChats(updated);
              await AsyncStorage.setItem('@fp_archived_chats', JSON.stringify(updated));
              await AsyncStorage.removeItem(`@fp_chat_${item.recipientId}`);
            } catch (e) {
              console.log('Error deleting archived chat:', e);
            }
          }
        }
      ]
    );
  };

  // --- ACTIONS FOR BLOCKED USERS ---
  const handleUnblockUser = async (user: BlockedUser) => {
    Alert.alert(
      'Buka Blokir?',
      `Buka blokir untuk ${user.name}? Pengguna ini akan dapat mengirim pesan kepada Anda lagi.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Buka Blokir',
          onPress: async () => {
            try {
              const updated = blockedUsers.filter(u => u.id !== user.id);
              setBlockedUsers(updated);
              await AsyncStorage.setItem('@fp_blocked_users', JSON.stringify(updated));
              Alert.alert('Sukses', `Blokir ${user.name} telah dibuka.`);
            } catch (e) {
              console.log('Error unblocking user:', e);
            }
          }
        }
      ]
    );
  };

  // --- ACTIONS FOR BROADCAST MESSAGE ---
  const handleSendBroadcast = async () => {
    const text = broadcastMessage.trim();
    if (!text) {
      Alert.alert('Pesan Kosong', 'Silakan ketikkan pesan siaran terlebih dahulu.');
      return;
    }
    if (conversations.length === 0) {
      Alert.alert('Tidak Ada Kontak', 'Anda belum memiliki kontak obrolan aktif untuk menerima siaran.');
      return;
    }

    Alert.alert(
      'Kirim Pesan Siaran?',
      `Pesan ini akan dikirimkan ke ${conversations.length} rekan chat atlet Anda secara bersamaan.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Kirim Sekarang',
          onPress: async () => {
            setIsBroadcasting(true);
            try {
              const { data: { user } } = await supabase.auth.getUser();
              const myId = user ? user.id : 'me';

              const nowIso = new Date().toISOString();
              const updatedConvs = [...conversations];

              for (let i = 0; i < updatedConvs.length; i++) {
                const target = updatedConvs[i];
                const key = `@fp_chat_${target.recipientId}`;
                const savedJson = await AsyncStorage.getItem(key);
                let msgs = savedJson ? JSON.parse(savedJson) : [];

                const broadcastMsg = {
                  id: `broadcast-${Date.now()}-${i}`,
                  senderId: myId,
                  recipientId: target.recipientId,
                  text: `📢 [PESAN SIARAN]\n${text}`,
                  created_at: nowIso,
                };
                msgs.push(broadcastMsg);
                await AsyncStorage.setItem(key, JSON.stringify(msgs));

                updatedConvs[i] = {
                  ...target,
                  lastMessage: `📢 ${text}`,
                  timestamp: nowIso,
                };
              }

              await AsyncStorage.setItem('@fp_active_conversations', JSON.stringify(updatedConvs));
              setConversations(updatedConvs);
              setBroadcastMessage('');
              setActiveSubModal(null);
              Alert.alert('Siaran Berhasil 📢', `Pesan berhasil dikirimkan ke ${updatedConvs.length} rekan atlet!`);
            } catch (e) {
              console.log('Error broadcasting message:', e);
              Alert.alert('Gagal', 'Terjadi kendala saat mengirim pesan siaran.');
            } finally {
              setIsBroadcasting(false);
            }
          }
        }
      ]
    );
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadConversations();
    loadArchivedChats();
    loadBlockedUsers();
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
      {/* HEADER UTAMA */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>CHAT TEMAN ATLET</Text>
        
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <TouchableOpacity 
            style={styles.newChatBtn}
            onPress={() => navigation.navigate('InviteFriends')}
            activeOpacity={0.8}
          >
            <Ionicons name="create-outline" size={22} color="#D7FF00" />
          </TouchableOpacity>

          {/* Tombol Titik 3 Menu Utama */}
          <TouchableOpacity 
            style={styles.threeDotsBtn}
            onPress={() => setMenuModalVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="ellipsis-vertical" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
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

      {/* CONVERSATION LIST (Tanpa tombol hapus langsung, ganti dengan tekan lama) */}
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
                onLongPress={() => setSelectedConv(item)}
                delayLongPress={300}
                activeOpacity={0.75}
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
                      {item.isMuted && (
                        <Ionicons name="volume-mute" size={14} color="#71717A" style={{ marginLeft: 5 }} />
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

      {/* MODAL TITIK 3 MENU UTAMA */}
      <Modal
        visible={menuModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setMenuModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalBackdrop} 
          activeOpacity={1} 
          onPress={() => setMenuModalVisible(false)}
        >
          <View style={styles.menuCard}>
            <View style={styles.menuHeader}>
              <Text style={styles.menuHeaderTitle}>PENGATURAN CHAT & KONTAK</Text>
            </View>

            {/* 1. Arsip Chat */}
            <TouchableOpacity 
              style={styles.menuRow} 
              onPress={() => {
                setMenuModalVisible(false);
                setActiveSubModal('archive');
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconBox, { backgroundColor: '#1E2538' }]}>
                <Ionicons name="archive-outline" size={20} color="#60A5FA" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={styles.menuRowTitle}>Arsip Chat</Text>
                  {archivedChats.length > 0 && (
                    <View style={styles.badgePill}>
                      <Text style={styles.badgePillText}>{archivedChats.length}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.menuRowSub}>Daftar obrolan yang disimpan terpisah</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#71717A" />
            </TouchableOpacity>

            {/* 2. Daftar Blokir */}
            <TouchableOpacity 
              style={styles.menuRow} 
              onPress={() => {
                setMenuModalVisible(false);
                setActiveSubModal('blocked');
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconBox, { backgroundColor: '#38231E' }]}>
                <Ionicons name="ban-outline" size={20} color="#FF9F0A" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={styles.menuRowTitle}>Daftar Blokir</Text>
                  {blockedUsers.length > 0 && (
                    <View style={[styles.badgePill, { backgroundColor: '#FF9F0A' }]}>
                      <Text style={[styles.badgePillText, { color: '#000' }]}>{blockedUsers.length}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.menuRowSub}>Kelola kontak atlet yang diblokir</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#71717A" />
            </TouchableOpacity>

            {/* 3. Pesan Siaran */}
            <TouchableOpacity 
              style={styles.menuRow} 
              onPress={() => {
                setMenuModalVisible(false);
                setActiveSubModal('broadcast');
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconBox, { backgroundColor: '#1E3326' }]}>
                <Ionicons name="radio-outline" size={20} color="#30D158" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.menuRowTitle}>Pesan Siaran</Text>
                <Text style={styles.menuRowSub}>Kirim pengumuman ke seluruh rekan atlet</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#71717A" />
            </TouchableOpacity>

            {/* 4. Setelan */}
            <TouchableOpacity 
              style={styles.menuRow} 
              onPress={() => {
                setMenuModalVisible(false);
                setActiveSubModal('settings');
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconBox, { backgroundColor: '#2B2B38' }]}>
                <Ionicons name="settings-outline" size={20} color="#D7FF00" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.menuRowTitle}>Setelan Chat</Text>
                <Text style={styles.menuRowSub}>Suara PING buzz, privasi, dan notifikasi</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#71717A" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuCancelBtn}
              onPress={() => setMenuModalVisible(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.menuCancelBtnText}>Tutup</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* MODAL TEKAN LAMA KARTU OBROLAN (Minimalisir Tombol) */}
      <Modal
        visible={selectedConv !== null}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setSelectedConv(null)}
      >
        <TouchableOpacity 
          style={styles.actionSheetBackdrop}
          activeOpacity={1}
          onPress={() => setSelectedConv(null)}
        >
          <View style={styles.actionSheetCard}>
            {selectedConv && (
              <>
                <View style={styles.actionSheetHeader}>
                  <Image source={{ uri: selectedConv.recipientAvatar }} style={styles.actionSheetAvatar} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.actionSheetName}>{selectedConv.recipientName}</Text>
                    <Text style={styles.actionSheetPin}>PIN: {selectedConv.pin}</Text>
                  </View>
                </View>

                {/* Opsi 1: Arsipkan */}
                <TouchableOpacity 
                  style={styles.actionSheetItem}
                  onPress={() => handleArchiveConversation(selectedConv)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="archive-outline" size={20} color="#60A5FA" style={styles.actionSheetIcon} />
                  <Text style={styles.actionSheetItemText}>Arsipkan Percakapan</Text>
                </TouchableOpacity>

                {/* Opsi 2: Bisukan / Bunyikan */}
                <TouchableOpacity 
                  style={styles.actionSheetItem}
                  onPress={() => handleToggleMuteConversation(selectedConv)}
                  activeOpacity={0.7}
                >
                  <Ionicons 
                    name={selectedConv.isMuted ? "volume-high-outline" : "volume-mute-outline"} 
                    size={20} 
                    color="#FFD700" 
                    style={styles.actionSheetIcon} 
                  />
                  <Text style={styles.actionSheetItemText}>
                    {selectedConv.isMuted ? "Bunyikan Notifikasi" : "Bisukan Notifikasi"}
                  </Text>
                </TouchableOpacity>

                {/* Opsi 3: Blokir */}
                <TouchableOpacity 
                  style={styles.actionSheetItem}
                  onPress={() => handleBlockFromCard(selectedConv)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="ban-outline" size={20} color="#FF9F0A" style={styles.actionSheetIcon} />
                  <Text style={[styles.actionSheetItemText, { color: '#FF9F0A' }]}>Blokir Kontak Atlet</Text>
                </TouchableOpacity>

                {/* Opsi 4: Hapus */}
                <TouchableOpacity 
                  style={styles.actionSheetItem}
                  onPress={() => handleDeleteConversation(selectedConv)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="trash-outline" size={20} color="#FF453A" style={styles.actionSheetIcon} />
                  <Text style={[styles.actionSheetItemText, { color: '#FF453A' }]}>Hapus Percakapan</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.actionSheetCancel}
                  onPress={() => setSelectedConv(null)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.actionSheetCancelText}>Batal</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* SUB-MODAL 1: ARSIP CHAT */}
      <Modal
        visible={activeSubModal === 'archive'}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setActiveSubModal(null)}
      >
        <View style={styles.fullModalWrap}>
          <View style={styles.fullModalHeader}>
            <TouchableOpacity onPress={() => setActiveSubModal(null)} style={{ padding: 6 }}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.fullModalTitle}>ARSIP PERCAKAPAN</Text>
            <View style={{ width: 32 }} />
          </View>

          {archivedChats.length === 0 ? (
            <View style={styles.emptySubBox}>
              <Ionicons name="archive-outline" size={50} color="#3F3F46" />
              <Text style={styles.emptySubTitle}>Belum Ada Chat Diarsipkan</Text>
              <Text style={styles.emptySubDesc}>
                Untuk mengarsipkan obrolan, tekan lama pada percakapan di halaman utama dan pilih 'Arsipkan Percakapan'.
              </Text>
            </View>
          ) : (
            <FlatList
              data={archivedChats}
              keyExtractor={(item) => item.recipientId}
              contentContainerStyle={{ paddingVertical: 10 }}
              renderItem={({ item }) => (
                <View style={styles.subItemRow}>
                  <Image source={{ uri: item.recipientAvatar }} style={styles.subItemAvatar} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.subItemName}>{item.recipientName}</Text>
                    <Text style={styles.subItemPin}>PIN: {item.pin}</Text>
                    <Text style={styles.subItemLast} numberOfLines={1}>{item.lastMessage}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TouchableOpacity 
                      style={styles.restoreBtn}
                      onPress={() => handleRestoreArchived(item)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="arrow-undo" size={16} color="#000000" />
                      <Text style={styles.restoreBtnText}>Buka</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.delArchivedBtn}
                      onPress={() => handleDeleteArchived(item)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="trash-outline" size={18} color="#FF453A" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            />
          )}
        </View>
      </Modal>

      {/* SUB-MODAL 2: DAFTAR BLOKIR */}
      <Modal
        visible={activeSubModal === 'blocked'}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setActiveSubModal(null)}
      >
        <View style={styles.fullModalWrap}>
          <View style={styles.fullModalHeader}>
            <TouchableOpacity onPress={() => setActiveSubModal(null)} style={{ padding: 6 }}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.fullModalTitle}>KONTAK DIBLOKIR</Text>
            <View style={{ width: 32 }} />
          </View>

          {blockedUsers.length === 0 ? (
            <View style={styles.emptySubBox}>
              <Ionicons name="shield-checkmark-outline" size={50} color="#30D158" />
              <Text style={styles.emptySubTitle}>Tidak Ada Kontak Diblokir</Text>
              <Text style={styles.emptySubDesc}>
                Semua atlet di Flex Pace dapat menghubungi dan mengirimkan tantangan pace kepada Anda.
              </Text>
            </View>
          ) : (
            <FlatList
              data={blockedUsers}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingVertical: 10 }}
              renderItem={({ item }) => (
                <View style={styles.subItemRow}>
                  <Image source={{ uri: item.avatar }} style={styles.subItemAvatar} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.subItemName}>{item.name}</Text>
                    <Text style={styles.subItemPin}>PIN: {item.pin}</Text>
                    <Text style={styles.blockedDateText}>
                      Diblokir pada {new Date(item.blockedAt).toLocaleDateString('id-ID')}
                    </Text>
                  </View>
                  <TouchableOpacity 
                    style={styles.unblockBtn}
                    onPress={() => handleUnblockUser(item)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.unblockBtnText}>Buka Blokir</Text>
                  </TouchableOpacity>
                </View>
              )}
            />
          )}
        </View>
      </Modal>

      {/* SUB-MODAL 3: PESAN SIARAN */}
      <Modal
        visible={activeSubModal === 'broadcast'}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setActiveSubModal(null)}
      >
        <View style={styles.fullModalWrap}>
          <View style={styles.fullModalHeader}>
            <TouchableOpacity onPress={() => setActiveSubModal(null)} style={{ padding: 6 }}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.fullModalTitle}>PESAN SIARAN (BROADCAST)</Text>
            <View style={{ width: 32 }} />
          </View>

          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <View style={styles.broadcastBanner}>
              <Ionicons name="megaphone" size={24} color="#30D158" style={{ marginRight: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.broadcastBannerTitle}>Siarkan ke {conversations.length} Rekan Chat</Text>
                <Text style={styles.broadcastBannerDesc}>
                  Pesan siaran akan terkirim sekaligus ke setiap jendela obrolan teman atlet Anda secara serentak.
                </Text>
              </View>
            </View>

            <Text style={styles.inputLabel}>TULIS PESAN SIARAN:</Text>
            <TextInput
              style={styles.broadcastInput}
              value={broadcastMessage}
              onChangeText={setBroadcastMessage}
              placeholder="Contoh: Ayo gabung Fun Run pagi besok di GBK jam 06.00 WIB! 🏃⚡"
              placeholderTextColor="#71717A"
              multiline={true}
              numberOfLines={4}
            />

            <TouchableOpacity 
              style={[
                styles.broadcastSendBtn, 
                (!broadcastMessage.trim() || isBroadcasting) && styles.broadcastSendBtnDisabled
              ]}
              onPress={handleSendBroadcast}
              disabled={!broadcastMessage.trim() || isBroadcasting}
              activeOpacity={0.85}
            >
              {isBroadcasting ? (
                <ActivityIndicator color="#000000" size="small" />
              ) : (
                <>
                  <Ionicons name="paper-plane" size={18} color="#000000" style={{ marginRight: 8 }} />
                  <Text style={styles.broadcastSendBtnText}>Kirim Pesan Siaran</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* SUB-MODAL 4: SETELAN CHAT */}
      <Modal
        visible={activeSubModal === 'settings'}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setActiveSubModal(null)}
      >
        <View style={styles.fullModalWrap}>
          <View style={styles.fullModalHeader}>
            <TouchableOpacity onPress={() => setActiveSubModal(null)} style={{ padding: 6 }}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.fullModalTitle}>SETELAN OBROLAN</Text>
            <View style={{ width: 32 }} />
          </View>

          <ScrollView contentContainerStyle={{ padding: 20 }}>
            {/* Setting 1: Suara & PING Buzz */}
            <View style={styles.settingToggleCard}>
              <View style={{ flex: 1, marginRight: 16 }}>
                <Text style={styles.settingToggleTitle}>Suara Notifikasi & Buzz PING</Text>
                <Text style={styles.settingToggleSub}>
                  Efek getar animasi goyang layar saat rekan atlet mengirimkan PING!
                </Text>
              </View>
              <Switch 
                value={chatSettings.pingBuzz} 
                onValueChange={(val) => updateSetting('pingBuzz', val)}
                thumbColor={chatSettings.pingBuzz ? '#D7FF00' : '#71717A'}
                trackColor={{ false: '#27272A', true: '#5A6E00' }}
              />
            </View>

            {/* Setting 2: Notifikasi Pesan */}
            <View style={styles.settingToggleCard}>
              <View style={{ flex: 1, marginRight: 16 }}>
                <Text style={styles.settingToggleTitle}>Pemberitahuan Pesan Baru</Text>
                <Text style={styles.settingToggleSub}>
                  Dapatkan pop-up saat Anda menerima ajakan lari atau pesan obrolan
                </Text>
              </View>
              <Switch 
                value={chatSettings.notifications} 
                onValueChange={(val) => updateSetting('notifications', val)}
                thumbColor={chatSettings.notifications ? '#D7FF00' : '#71717A'}
                trackColor={{ false: '#27272A', true: '#5A6E00' }}
              />
            </View>

            {/* Setting 3: Pratinjau Pesan */}
            <View style={styles.settingToggleCard}>
              <View style={{ flex: 1, marginRight: 16 }}>
                <Text style={styles.settingToggleTitle}>Pratinjau Isi Pesan</Text>
                <Text style={styles.settingToggleSub}>
                  Menampilkan cuplikan teks pesan pada bilah notifikasi sistem
                </Text>
              </View>
              <Switch 
                value={chatSettings.messagePreview} 
                onValueChange={(val) => updateSetting('messagePreview', val)}
                thumbColor={chatSettings.messagePreview ? '#D7FF00' : '#71717A'}
                trackColor={{ false: '#27272A', true: '#5A6E00' }}
              />
            </View>

            {/* Setting 4: Tanda Dibaca */}
            <View style={styles.settingToggleCard}>
              <View style={{ flex: 1, marginRight: 16 }}>
                <Text style={styles.settingToggleTitle}>Konfirmasi Terbaca</Text>
                <Text style={styles.settingToggleSub}>
                  Tampilkan centang ganda ketika pesan telah Anda buka
                </Text>
              </View>
              <Switch 
                value={chatSettings.readReceipts} 
                onValueChange={(val) => updateSetting('readReceipts', val)}
                thumbColor={chatSettings.readReceipts ? '#D7FF00' : '#71717A'}
                trackColor={{ false: '#27272A', true: '#5A6E00' }}
              />
            </View>
          </ScrollView>
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
  threeDotsBtn: {
    padding: 6,
    marginLeft: 4,
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
  },

  // 3-DOTS MENU MODAL
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  menuCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#16161E',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  menuHeader: {
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 8,
  },
  menuHeaderTitle: {
    color: '#D7FF00',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  menuIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuRowTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  menuRowSub: {
    color: '#71717A',
    fontSize: 11,
    marginTop: 2,
  },
  badgePill: {
    backgroundColor: '#60A5FA',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgePillText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  menuCancelBtn: {
    marginTop: 14,
    backgroundColor: '#20202A',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  menuCancelBtnText: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '700',
  },

  // ACTION SHEET (LONG-PRESS CONVERSATION)
  actionSheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  actionSheetCard: {
    backgroundColor: '#16161E',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 36,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  actionSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 8,
  },
  actionSheetAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#27272A',
  },
  actionSheetName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  actionSheetPin: {
    color: '#FFD700',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  actionSheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  actionSheetIcon: {
    marginRight: 14,
  },
  actionSheetItemText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  actionSheetCancel: {
    marginTop: 16,
    backgroundColor: '#20202A',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  actionSheetCancelText: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '700',
  },

  // FULL SCREEN SUB-MODALS
  fullModalWrap: {
    flex: 1,
    backgroundColor: '#0A0A0C',
    paddingTop: 48,
  },
  fullModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  fullModalTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  emptySubBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    paddingTop: 100,
  },
  emptySubTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubDesc: {
    color: '#71717A',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  subItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  subItemAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#27272A',
  },
  subItemName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  subItemPin: {
    color: '#FFD700',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 1,
  },
  subItemLast: {
    color: '#71717A',
    fontSize: 12,
    marginTop: 2,
  },
  restoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D7FF00',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  restoreBtnText: {
    color: '#000000',
    fontSize: 11,
    fontWeight: '800',
    marginLeft: 4,
  },
  delArchivedBtn: {
    padding: 6,
    backgroundColor: 'rgba(255, 69, 58, 0.12)',
    borderRadius: 8,
  },
  blockedDateText: {
    color: '#71717A',
    fontSize: 11,
    marginTop: 2,
  },
  unblockBtn: {
    backgroundColor: '#272732',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  unblockBtnText: {
    color: '#30D158',
    fontSize: 12,
    fontWeight: '700',
  },

  // BROADCAST STYLES
  broadcastBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#122018',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(48, 209, 88, 0.2)',
    marginBottom: 20,
  },
  broadcastBannerTitle: {
    color: '#30D158',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  broadcastBannerDesc: {
    color: '#A1A1AA',
    fontSize: 12,
    lineHeight: 16,
  },
  inputLabel: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  broadcastInput: {
    backgroundColor: '#16161E',
    borderRadius: 16,
    padding: 14,
    color: '#FFFFFF',
    fontSize: 14,
    minHeight: 110,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 20,
  },
  broadcastSendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D7FF00',
    paddingVertical: 14,
    borderRadius: 14,
  },
  broadcastSendBtnDisabled: {
    backgroundColor: '#3F3F46',
    opacity: 0.5,
  },
  broadcastSendBtnText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '900',
  },

  // SETTINGS STYLES
  settingToggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#14141B',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 12,
  },
  settingToggleTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  settingToggleSub: {
    color: '#71717A',
    fontSize: 11,
    lineHeight: 16,
  },
});

