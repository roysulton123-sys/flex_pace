import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  FlatList, 
  Image, 
  Animated, 
  KeyboardAvoidingView, 
  Platform, 
  Alert,
  ScrollView,
  Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

interface PromoCardData {
  pin: string;
  name: string;
  avatar: string;
  stats: string;
  isVip?: boolean;
}

export interface ChatSticker {
  id: string;
  emoji: string;
  title: string;
  category: 'lari' | 'sepeda' | 'motivasi' | 'fun';
  color: string;
  badgeBg: string;
}

export const ATHLETIC_STICKERS: Record<'lari' | 'sepeda' | 'motivasi' | 'fun', ChatSticker[]> = {
  lari: [
    { id: 'stk_sub4', emoji: '⚡', title: 'Sub-4 Pace!', category: 'lari', color: '#D7FF00', badgeBg: 'rgba(215, 255, 0, 0.18)' },
    { id: 'stk_easy', emoji: '👟', title: 'Easy Recovery Run', category: 'lari', color: '#60A5FA', badgeBg: 'rgba(96, 165, 250, 0.18)' },
    { id: 'stk_long', emoji: '🏃', title: 'Sunday Long Run', category: 'lari', color: '#F43F5E', badgeBg: 'rgba(244, 63, 94, 0.18)' },
    { id: 'stk_marathon', emoji: '🏅', title: 'Road to Marathon', category: 'lari', color: '#F59E0B', badgeBg: 'rgba(245, 158, 11, 0.18)' },
    { id: 'stk_gass', emoji: '🔥', title: 'Gass Tipis-Tipis!', category: 'lari', color: '#EF4444', badgeBg: 'rgba(239, 68, 68, 0.18)' },
    { id: 'stk_morning', emoji: '🌅', title: 'Morning Miles', category: 'lari', color: '#FBBF24', badgeBg: 'rgba(251, 191, 36, 0.18)' },
  ],
  sepeda: [
    { id: 'stk_gowes', emoji: '🚴', title: 'Gowes Pagi Seru', category: 'sepeda', color: '#10B981', badgeBg: 'rgba(16, 185, 129, 0.18)' },
    { id: 'stk_kom', emoji: '👑', title: 'King of Mountain', category: 'sepeda', color: '#FFD700', badgeBg: 'rgba(255, 215, 0, 0.18)' },
    { id: 'stk_peloton', emoji: '🚴‍♂️', title: 'Tarik Peloton!', category: 'sepeda', color: '#38BDF8', badgeBg: 'rgba(56, 189, 248, 0.18)' },
    { id: 'stk_pitstop', emoji: '☕', title: 'Pitstop Kopi Dulu', category: 'sepeda', color: '#F59E0B', badgeBg: 'rgba(245, 158, 11, 0.18)' },
  ],
  motivasi: [
    { id: 'stk_pb', emoji: '🚀', title: 'New Personal Best!', category: 'motivasi', color: '#D7FF00', badgeBg: 'rgba(215, 255, 0, 0.18)' },
    { id: 'stk_beast', emoji: '💪', title: 'No Excuses Today', category: 'motivasi', color: '#A855F7', badgeBg: 'rgba(168, 85, 247, 0.18)' },
    { id: 'stk_fire', emoji: '🦁', title: 'Beast Mode On', category: 'motivasi', color: '#F97316', badgeBg: 'rgba(249, 115, 22, 0.18)' },
    { id: 'stk_target', emoji: '🎯', title: 'Target Tercapai!', category: 'motivasi', color: '#34D399', badgeBg: 'rgba(52, 211, 153, 0.18)' },
  ],
  fun: [
    { id: 'stk_ayolari', emoji: '👀', title: 'Kuy Lari Bareng?', category: 'fun', color: '#38BDF8', badgeBg: 'rgba(56, 189, 248, 0.18)' },
    { id: 'stk_rehat', emoji: '🛋️', title: 'Rehat Dulu Sob', category: 'fun', color: '#9CA3AF', badgeBg: 'rgba(156, 163, 175, 0.18)' },
    { id: 'stk_carbo', emoji: '🍕', title: 'Carbo Loading!', category: 'fun', color: '#FBBF24', badgeBg: 'rgba(251, 191, 36, 0.18)' },
    { id: 'stk_respect', emoji: '👏', title: 'Respect Pace-mu!', category: 'fun', color: '#34D399', badgeBg: 'rgba(52, 211, 153, 0.18)' },
  ]
};

interface ChatMessage {
  id: string;
  senderId: string;
  recipientId: string;
  text: string;
  isPing?: boolean;
  sticker?: ChatSticker;
  promoCard?: PromoCardData;
  created_at: string;
}

export default function ChatScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { recipientId, recipientName, recipientAvatar, isVip, promoCard } = route.params || {};

  const [currentUserId, setCurrentUserId] = useState<string>('me');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // Multi-Select Message Deletion Mode (via Long Press)
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);

  // 3-Dots Menu Modal State
  const [menuModalVisible, setMenuModalVisible] = useState(false);

  // Sticker Picker Modal State
  const [stickerModalVisible, setStickerModalVisible] = useState(false);
  const [selectedStickerTab, setSelectedStickerTab] = useState<'lari' | 'sepeda' | 'motivasi' | 'fun'>('lari');

  // BBM PING Screen Buzz Shake Animation
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<FlatList>(null);

  const recipientPin = recipientId 
    ? recipientId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase()
    : 'FP789BBM';

  const chatStorageKey = `@fp_chat_${recipientId || 'default'}`;

  useEffect(() => {
    initChat();
  }, [recipientId]);

  // Trigger shake animation when receiving / sending PING
  const triggerPingBuzz = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true })
    ]).start();
  };

  const initChat = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const myId = user ? user.id : 'me';
      setCurrentUserId(myId);

      // Ambil pesan tersimpan dari storage lokal
      const savedMessagesJson = await AsyncStorage.getItem(chatStorageKey);
      let loadedMessages: ChatMessage[] = [];

      if (savedMessagesJson) {
        loadedMessages = JSON.parse(savedMessagesJson);
      }

      // Jika ada kartu kontak atlet yang dioper untuk dikirimkan (BBM Style)
      if (promoCard) {
        const promoMsg: ChatMessage = {
          id: `promo-${Date.now()}`,
          senderId: myId,
          recipientId: recipientId || 'other',
          text: `Rekomendasi Kontak Atlet Flex Pace:`,
          promoCard: promoCard,
          created_at: new Date().toISOString(),
        };
        loadedMessages.push(promoMsg);
        await AsyncStorage.setItem(chatStorageKey, JSON.stringify(loadedMessages));
      }

      setMessages(loadedMessages);

      // Catat ke percakapan aktif jika ada pesan
      if (loadedMessages.length > 0) {
        await saveConversationEntry(myId, loadedMessages[loadedMessages.length - 1]);
      }
    } catch (e) {
      console.log('Error init chat:', e);
    }
  };

  // Multi-Select Message Handlers via Long-Press
  const handleMessageLongPress = (msg: ChatMessage) => {
    if (!isSelectionMode) {
      setIsSelectionMode(true);
      setSelectedMessageIds([msg.id]);
    } else {
      toggleSelectMessage(msg.id);
    }
  };

  const handleMessagePress = (msg: ChatMessage) => {
    if (isSelectionMode) {
      toggleSelectMessage(msg.id);
    }
  };

  const toggleSelectMessage = (id: string) => {
    setSelectedMessageIds(prev => {
      if (prev.includes(id)) {
        const next = prev.filter(mId => mId !== id);
        if (next.length === 0) {
          setIsSelectionMode(false);
        }
        return next;
      } else {
        return [...prev, id];
      }
    });
  };

  const handleSelectAll = () => {
    if (selectedMessageIds.length === messages.length) {
      setSelectedMessageIds([]);
      setIsSelectionMode(false);
    } else {
      setSelectedMessageIds(messages.map(m => m.id));
    }
  };

  const handleCancelSelection = () => {
    setIsSelectionMode(false);
    setSelectedMessageIds([]);
  };

  const handleDeleteSelectedMessages = () => {
    if (selectedMessageIds.length === 0) return;
    Alert.alert(
      `Hapus ${selectedMessageIds.length} Pesan?`,
      'Pesan yang dipilih akan dihapus secara permanen dari percakapan.',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: `Hapus (${selectedMessageIds.length})`,
          style: 'destructive',
          onPress: async () => {
            try {
              const updated = messages.filter(m => !selectedMessageIds.includes(m.id));
              setMessages(updated);
              setIsSelectionMode(false);
              setSelectedMessageIds([]);
              await AsyncStorage.setItem(chatStorageKey, JSON.stringify(updated));
              if (updated.length > 0) {
                await saveConversationEntry(currentUserId, updated[updated.length - 1]);
              }
            } catch (e) {
              console.log('Error deleting selected messages:', e);
            }
          }
        }
      ]
    );
  };

  // 3-Dots Menu Actions
  const handleArchiveChat = async () => {
    setMenuModalVisible(false);
    try {
      const archiveKey = '@fp_archived_chats';
      const arcJson = await AsyncStorage.getItem(archiveKey);
      let arcList: any[] = arcJson ? JSON.parse(arcJson) : [];
      if (!arcList.some(c => c.recipientId === recipientId)) {
        arcList.unshift({
          recipientId,
          recipientName: recipientName || 'Flex Athlete',
          recipientAvatar: recipientAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&q=80',
          isVip: !!isVip,
          lastMessage: messages.length > 0 ? messages[messages.length - 1].text : 'Obrolan diarsipkan',
          timestamp: new Date().toISOString(),
          pin: recipientPin,
        });
        await AsyncStorage.setItem(archiveKey, JSON.stringify(arcList));
      }
      // Hapus dari percakapan aktif
      const convKey = '@fp_active_conversations';
      const convJson = await AsyncStorage.getItem(convKey);
      if (convJson) {
        let convs: any[] = JSON.parse(convJson);
        convs = convs.filter(c => c.recipientId !== recipientId);
        await AsyncStorage.setItem(convKey, JSON.stringify(convs));
      }
      Alert.alert('Arsip Berhasil', `Percakapan dengan ${recipientName || 'atlet ini'} telah diarsipkan.`);
      navigation.goBack();
    } catch (e) {
      console.log('Error archiving chat:', e);
    }
  };

  const handleBlockUser = async () => {
    setMenuModalVisible(false);
    Alert.alert(
      'Blokir Kontak Atlet?',
      `Apakah Anda yakin ingin memblokir ${recipientName || 'atlet ini'}? Anda tidak akan menerima pesan dari pengguna ini.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Blokir',
          style: 'destructive',
          onPress: async () => {
            try {
              const blockKey = '@fp_blocked_users';
              const blkJson = await AsyncStorage.getItem(blockKey);
              let blkList: any[] = blkJson ? JSON.parse(blkJson) : [];
              if (!blkList.some(u => u.id === recipientId)) {
                blkList.push({
                  id: recipientId,
                  name: recipientName || 'Flex Athlete',
                  avatar: recipientAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&q=80',
                  pin: recipientPin,
                  blockedAt: new Date().toISOString(),
                });
                await AsyncStorage.setItem(blockKey, JSON.stringify(blkList));
              }
              Alert.alert('Pengguna Diblokir', `${recipientName || 'Atlet ini'} berhasil ditambahkan ke daftar blokir.`);
              navigation.goBack();
            } catch (e) {
              console.log('Error blocking user:', e);
            }
          }
        }
      ]
    );
  };

  const handleClearChatHistory = () => {
    Alert.alert(
      'Hapus Riwayat Chat?',
      `Apakah Anda yakin ingin menghapus seluruh pesan percakapan dengan ${recipientName || 'atlet ini'}?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus Semua',
          style: 'destructive',
          onPress: async () => {
            try {
              setMessages([]);
              await AsyncStorage.removeItem(chatStorageKey);
              // Hapus juga entri dari daftar percakapan aktif
              const convKey = '@fp_active_conversations';
              const convJson = await AsyncStorage.getItem(convKey);
              if (convJson) {
                const convs: any[] = JSON.parse(convJson);
                const updated = convs.filter(c => c.recipientId !== recipientId);
                await AsyncStorage.setItem(convKey, JSON.stringify(updated));
              }
              Alert.alert('Sukses', 'Riwayat chat telah dibersihkan.');
            } catch (e) {
              console.log('Error clearing chat history:', e);
            }
          }
        }
      ]
    );
  };

  const saveConversationEntry = async (myId: string, lastMsg: ChatMessage) => {
    try {
      const convKey = '@fp_active_conversations';
      const convJson = await AsyncStorage.getItem(convKey);
      let convs: any[] = convJson ? JSON.parse(convJson) : [];

      const existingIndex = convs.findIndex(c => c.recipientId === recipientId);
      const entry = {
        recipientId,
        recipientName: recipientName || 'Flex Athlete',
        recipientAvatar: recipientAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&q=80',
        isVip: !!isVip,
        lastMessage: lastMsg.isPing 
          ? '⚡ * P I N G ! ! ! *' 
          : lastMsg.sticker 
            ? `${lastMsg.sticker.emoji} ${lastMsg.sticker.title}` 
            : lastMsg.text,
        timestamp: lastMsg.created_at,
        pin: recipientPin,
      };

      if (existingIndex >= 0) {
        convs[existingIndex] = entry;
      } else {
        convs.unshift(entry);
      }

      await AsyncStorage.setItem(convKey, JSON.stringify(convs));
    } catch (e) {
      console.log('Error saving conversation entry:', e);
    }
  };

  const sendMessage = async (textToSend?: string, isPing = false) => {
    const text = (textToSend || inputText).trim();
    if (!text && !isPing) return;

    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      senderId: currentUserId,
      recipientId: recipientId || 'other',
      text: isPing ? '* P I N G ! ! ! *' : text,
      isPing: isPing,
      created_at: new Date().toISOString(),
    };

    const updated = [...messages, newMsg];
    setMessages(updated);
    setInputText('');

    if (isPing) {
      triggerPingBuzz();
    }

    await AsyncStorage.setItem(chatStorageKey, JSON.stringify(updated));
    await saveConversationEntry(currentUserId, newMsg);

    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const sendBbmPing = () => {
    sendMessage(undefined, true);
  };

  const sendSticker = async (sticker: ChatSticker) => {
    setStickerModalVisible(false);
    const newMsg: ChatMessage = {
      id: `stk-${Date.now()}`,
      senderId: currentUserId,
      recipientId: recipientId || 'other',
      text: `[Stiker] ${sticker.title}`,
      sticker: sticker,
      created_at: new Date().toISOString(),
    };

    const updated = [...messages, newMsg];
    setMessages(updated);

    await AsyncStorage.setItem(chatStorageKey, JSON.stringify(updated));
    await saveConversationEntry(currentUserId, newMsg);

    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const formatMessageTime = (isoString: string) => {
    const d = new Date(isoString);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <Animated.View style={[styles.container, { transform: [{ translateX: shakeAnim }] }]}>
      {/* HEADER OBROLAN ATAU SELECTION BAR */}
      {isSelectionMode ? (
        <View style={styles.selectionHeader}>
          <TouchableOpacity 
            style={styles.selectionCancelBtn}
            onPress={handleCancelSelection}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <Text style={styles.selectionTitleText}>
            {selectedMessageIds.length} Pesan Dipilih
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TouchableOpacity 
              style={styles.selectAllChip}
              onPress={handleSelectAll}
              activeOpacity={0.7}
            >
              <Text style={styles.selectAllChipText}>
                {selectedMessageIds.length === messages.length ? 'Batal Semua' : 'Pilih Semua'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.selectionDeleteBtn}
              onPress={handleDeleteSelectedMessages}
              activeOpacity={0.7}
            >
              <Ionicons name="trash" size={20} color="#FF453A" />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.headerUserRow}
            onPress={() => {
              navigation.navigate('UserProfile', {
                userId: recipientId,
                userName: recipientName,
                userAvatar: recipientAvatar,
              });
            }}
            activeOpacity={0.8}
          >
            <View style={[styles.avatarWrap, isVip && styles.avatarWrapVip]}>
              <Image 
                source={{ uri: recipientAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&q=80' }} 
                style={styles.headerAvatar} 
              />
              <View style={styles.onlineDot} />
            </View>

            <View style={{ flex: 1, marginLeft: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.headerName} numberOfLines={1}>{recipientName || 'Flex Athlete'}</Text>
                {isVip && (
                  <View style={styles.vipBadge}>
                    <Text style={styles.vipBadgeText}>VIP</Text>
                  </View>
                )}
              </View>
              <Text style={styles.headerPinText}>PIN: {recipientPin} • Online</Text>
            </View>
          </TouchableOpacity>

          {/* Tombol Titik 3 Menu Setelan */}
          <TouchableOpacity 
            style={styles.threeDotsBtn}
            onPress={() => setMenuModalVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="ellipsis-vertical" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}

      {/* QUICK GREETING CHIPS */}
      <View style={styles.quickChipsBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12 }}>
          {[
            'Ayo lari bareng sore ini! 🏃',
            'Berapa target pace hari ini? ⚡',
            'Mantap rekor larimu! 👏',
            'Bagi rute GPS kemarin dong! 🚴',
          ].map((chip, idx) => (
            <TouchableOpacity 
              key={idx} 
              style={styles.quickChip}
              onPress={() => sendMessage(chip)}
              activeOpacity={0.8}
            >
              <Text style={styles.quickChipText}>{chip}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* DAFTAR PESAN OBROLAN */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyChatBox}>
            <View style={styles.emptyChatIconCircle}>
              <Ionicons name="chatbubbles-outline" size={40} color="#3F3F46" />
            </View>
            <Text style={styles.emptyChatTitle}>Mulai Percakapan</Text>
            <Text style={styles.emptyChatSub}>
              Kirim sapaan pertama atau tekan tombol PING! untuk menyapa {recipientName || 'rekan atlet ini'}.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const isMine = item.senderId === currentUserId;
          const isSelected = selectedMessageIds.includes(item.id);

          // 1. Render Pesan PING!!! BBM
          if (item.isPing) {
            return (
              <TouchableOpacity 
                activeOpacity={0.85} 
                onPress={() => handleMessagePress(item)}
                onLongPress={() => handleMessageLongPress(item)}
                style={[
                  styles.pingRowWrapper,
                  isSelected && styles.selectedRowWrapper,
                  isMine ? styles.pingRight : styles.pingLeft
                ]}
              >
                {isSelectionMode && (
                  <View style={styles.selectionCheckCircle}>
                    <Ionicons 
                      name={isSelected ? "checkbox" : "square-outline"} 
                      size={20} 
                      color={isSelected ? "#D7FF00" : "#71717A"} 
                    />
                  </View>
                )}
                <View style={styles.pingContainer}>
                  <View style={[
                    styles.pingBubble, 
                    isMine ? styles.pingBubbleMine : styles.pingBubbleOther,
                    isSelected && styles.pingBubbleSelected
                  ]}>
                    <Ionicons name="flash" size={16} color={isMine ? "#000000" : "#FFD700"} style={{ marginRight: 6 }} />
                    <Text style={[styles.pingText, isMine ? styles.pingTextMine : styles.pingTextOther]}>
                      * P I N G ! ! ! *
                    </Text>
                  </View>
                  <Text style={styles.messageTimestamp}>{formatMessageTime(item.created_at)}</Text>
                </View>
              </TouchableOpacity>
            );
          }

          // 2. Render Kartu Kontak Promosi Atlet (BBM Style)
          if (item.promoCard) {
            const card = item.promoCard;
            return (
              <TouchableOpacity 
                activeOpacity={0.9}
                onPress={() => handleMessagePress(item)}
                onLongPress={() => handleMessageLongPress(item)}
                style={[
                  styles.cardRowWrapper,
                  isSelected && styles.selectedRowWrapper,
                  isMine ? styles.msgRight : styles.msgLeft
                ]}
              >
                {isSelectionMode && (
                  <View style={styles.selectionCheckCircle}>
                    <Ionicons 
                      name={isSelected ? "checkbox" : "square-outline"} 
                      size={20} 
                      color={isSelected ? "#D7FF00" : "#71717A"} 
                    />
                  </View>
                )}
                <View style={styles.msgWrapper}>
                  <View style={[
                    styles.cardBubble, 
                    isMine ? styles.cardBubbleMine : styles.cardBubbleOther,
                    isSelected && styles.cardBubbleSelected
                  ]}>
                    <View style={styles.cardBubbleHeader}>
                      <Ionicons name="megaphone" size={13} color="#FFD700" style={{ marginRight: 4 }} />
                      <Text style={styles.cardBubbleLabel}>REKOMENDASI ATLET FLEX PACE</Text>
                    </View>

                    <View style={styles.cardBubbleBody}>
                      <Image source={{ uri: card.avatar }} style={styles.cardBubbleAvatar} />
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.cardBubbleName}>{card.name}</Text>
                        <View style={styles.cardPinPill}>
                          <Text style={styles.cardPinText}>PIN: {card.pin}</Text>
                        </View>
                        <Text style={styles.cardStatsText}>{card.stats}</Text>
                      </View>
                    </View>

                    <TouchableOpacity 
                      style={styles.cardActionBtn}
                      onPress={() => {
                        if (isSelectionMode) {
                          handleMessagePress(item);
                          return;
                        }
                        navigation.navigate('UserProfile', {
                          userId: recipientId,
                          userName: card.name,
                          userAvatar: card.avatar,
                        });
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.cardActionBtnText}>Lihat Profil & Tambahkan</Text>
                      <Ionicons name="chevron-forward" size={14} color="#000000" />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.messageTimestamp}>{formatMessageTime(item.created_at)}</Text>
                </View>
              </TouchableOpacity>
            );
          }

          // 3. Render Pesan Stiker Atletik
          if (item.sticker) {
            const stk = item.sticker;
            return (
              <TouchableOpacity 
                activeOpacity={0.9}
                onPress={() => handleMessagePress(item)}
                onLongPress={() => handleMessageLongPress(item)}
                style={[
                  styles.stickerRowWrapper,
                  isSelected && styles.selectedRowWrapper,
                  isMine ? styles.msgRight : styles.msgLeft
                ]}
              >
                {isSelectionMode && (
                  <View style={styles.selectionCheckCircle}>
                    <Ionicons 
                      name={isSelected ? "checkbox" : "square-outline"} 
                      size={20} 
                      color={isSelected ? "#D7FF00" : "#71717A"} 
                    />
                  </View>
                )}
                <View style={styles.msgWrapper}>
                  <View style={[
                    styles.stickerBubble, 
                    isMine ? styles.stickerBubbleMine : styles.stickerBubbleOther,
                    isSelected && styles.stickerBubbleSelected
                  ]}>
                    <View style={[styles.stickerEmojiContainer, { backgroundColor: stk.badgeBg || 'rgba(215, 255, 0, 0.15)' }]}>
                      <Text style={styles.stickerEmojiText}>{stk.emoji}</Text>
                    </View>
                    <Text style={[styles.stickerTitleText, { color: stk.color || '#FFFFFF' }]}>
                      {stk.title}
                    </Text>
                  </View>
                  <Text style={styles.messageTimestamp}>{formatMessageTime(item.created_at)}</Text>
                </View>
              </TouchableOpacity>
            );
          }

          // 4. Render Pesan Teks Standar
          return (
            <TouchableOpacity 
              activeOpacity={0.9}
              onPress={() => handleMessagePress(item)}
              onLongPress={() => handleMessageLongPress(item)}
              style={[
                styles.textRowWrapper,
                isSelected && styles.selectedRowWrapper,
                isMine ? styles.msgRight : styles.msgLeft
              ]}
            >
              {isSelectionMode && (
                <View style={styles.selectionCheckCircle}>
                  <Ionicons 
                    name={isSelected ? "checkbox" : "square-outline"} 
                    size={20} 
                    color={isSelected ? "#D7FF00" : "#71717A"} 
                  />
                </View>
              )}
              <View style={styles.msgWrapper}>
                <View style={[
                  styles.msgBubble, 
                  isMine ? styles.msgBubbleMine : styles.msgBubbleOther,
                  isSelected && styles.msgBubbleSelected
                ]}>
                  <Text style={[styles.msgText, isMine ? styles.msgTextMine : styles.msgTextOther]}>
                    {item.text}
                  </Text>
                </View>
                <Text style={styles.messageTimestamp}>{formatMessageTime(item.created_at)}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* INDIKATOR SEDANG MENGETIK */}
      {isTyping && (
        <View style={styles.typingIndicator}>
          <Text style={styles.typingText}>⚡ {recipientName || 'Teman'} sedang mengetik...</Text>
        </View>
      )}

      {/* BILAH INPUT PESAN & TOMBOL PING BBM & STIKER */}
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.inputContainer}>
          {/* TOMBOL PING!!! BBM (MINIMALIS & KOMPAK) */}
          <TouchableOpacity 
            style={styles.pingActionBtn}
            onPress={sendBbmPing}
            activeOpacity={0.8}
          >
            <Ionicons name="flash" size={16} color="#000000" />
          </TouchableOpacity>

          {/* TOMBOL STIKER CHAT ATLETIK */}
          <TouchableOpacity 
            style={styles.stickerPickerBtn}
            onPress={() => setStickerModalVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="happy" size={18} color="#D7FF00" />
          </TouchableOpacity>

          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Tulis pesan atau ajak lari bareng..."
            placeholderTextColor="#71717A"
            multiline={false}
          />

          <TouchableOpacity 
            style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
            onPress={() => sendMessage()}
            disabled={!inputText.trim()}
            activeOpacity={0.85}
          >
            <Ionicons name="send" size={18} color="#000000" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* 3-DOTS SETTINGS MODAL */}
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
          <View style={styles.menuDropdownCard}>
            <View style={styles.menuHeader}>
              <Text style={styles.menuHeaderTitle}>PILIHAN OBROLAN</Text>
              <Text style={styles.menuHeaderPin}>PIN: {recipientPin}</Text>
            </View>

            <TouchableOpacity 
              style={styles.menuRow} 
              onPress={() => {
                setMenuModalVisible(false);
                navigation.navigate('UserProfile', {
                  userId: recipientId,
                  userName: recipientName,
                  userAvatar: recipientAvatar,
                });
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconCircle, { backgroundColor: '#1E1E26' }]}>
                <Ionicons name="person-circle-outline" size={20} color="#D7FF00" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.menuRowTitle}>Lihat Profil Atlet</Text>
                <Text style={styles.menuRowSub}>Lihat statistik pace & bio atlet</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#71717A" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuRow} 
              onPress={handleArchiveChat}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconCircle, { backgroundColor: '#1E1E26' }]}>
                <Ionicons name="archive-outline" size={18} color="#60A5FA" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.menuRowTitle}>Arsipkan Chat</Text>
                <Text style={styles.menuRowSub}>Pindahkan ke folder arsip terpisah</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#71717A" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuRow} 
              onPress={handleBlockUser}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconCircle, { backgroundColor: '#2D1B1B' }]}>
                <Ionicons name="ban-outline" size={18} color="#FF9F0A" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.menuRowTitle, { color: '#FF9F0A' }]}>Blokir Kontak</Text>
                <Text style={styles.menuRowSub}>Hentikan pesan dari atlet ini</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#71717A" />
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <TouchableOpacity 
              style={styles.menuRow} 
              onPress={() => {
                setMenuModalVisible(false);
                handleClearChatHistory();
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconCircle, { backgroundColor: '#3A1414' }]}>
                <Ionicons name="trash-outline" size={18} color="#FF453A" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.menuRowTitle, { color: '#FF453A' }]}>Bersihkan Riwayat Chat</Text>
                <Text style={styles.menuRowSub}>Hapus seluruh pesan di obrolan ini</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#71717A" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuCloseBtn}
              onPress={() => setMenuModalVisible(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.menuCloseBtnText}>Tutup</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* MODAL STIKER ATLETIK FLEX PACE */}
      <Modal
        visible={stickerModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setStickerModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setStickerModalVisible(false)}
        >
          <TouchableOpacity 
            activeOpacity={1} 
            style={styles.stickerSheetCard}
            onPress={(e) => e.stopPropagation()}
          >
            {/* STICKER SHEET HEADER */}
            <View style={styles.stickerSheetHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="sparkles" size={16} color="#D7FF00" style={{ marginRight: 6 }} />
                <Text style={styles.stickerSheetTitle}>STIKER ATLETIK FLEX PACE</Text>
              </View>
              <TouchableOpacity 
                onPress={() => setStickerModalVisible(false)}
                style={styles.stickerCloseBtn}
              >
                <Ionicons name="close" size={20} color="#A1A1AA" />
              </TouchableOpacity>
            </View>

            {/* CATEGORY TABS */}
            <View style={styles.stickerCategoryTabs}>
              {(['lari', 'sepeda', 'motivasi', 'fun'] as const).map((tab) => {
                const isActive = selectedStickerTab === tab;
                const tabTitles = {
                  lari: '🏃 Lari',
                  sepeda: '🚴 Gowes',
                  motivasi: '🏆 Motivasi',
                  fun: '🎉 Fun'
                };
                return (
                  <TouchableOpacity
                    key={tab}
                    style={[styles.stickerCategoryTab, isActive && styles.stickerCategoryTabActive]}
                    onPress={() => setSelectedStickerTab(tab)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.stickerCategoryTabText, isActive && styles.stickerCategoryTabTextActive]}>
                      {tabTitles[tab]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* STICKER GRID */}
            <ScrollView 
              contentContainerStyle={styles.stickerGrid} 
              showsVerticalScrollIndicator={false}
            >
              {ATHLETIC_STICKERS[selectedStickerTab].map((sticker) => (
                <TouchableOpacity
                  key={sticker.id}
                  style={styles.stickerTile}
                  onPress={() => sendSticker(sticker)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.stickerTileEmojiBox, { backgroundColor: sticker.badgeBg }]}>
                    <Text style={styles.stickerTileEmoji}>{sticker.emoji}</Text>
                  </View>
                  <Text style={[styles.stickerTileTitle, { color: sticker.color }]} numberOfLines={2}>
                    {sticker.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0C',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 14,
    backgroundColor: '#121217',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  backBtn: {
    padding: 6,
    marginRight: 6,
  },
  headerUserRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrap: {
    position: 'relative',
  },
  avatarWrapVip: {
    borderWidth: 2,
    borderColor: '#FFD700',
    borderRadius: 22,
    padding: 1.5,
  },
  headerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#27272A',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#30D158',
    borderWidth: 2,
    borderColor: '#121217',
  },
  headerName: {
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
  headerPinText: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  viewProfileBtn: {
    padding: 6,
    marginLeft: 6,
  },
  quickChipsBar: {
    paddingVertical: 8,
    backgroundColor: '#0E0E12',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  quickChip: {
    backgroundColor: '#1A1A22',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  quickChipText: {
    color: '#D4D4D8',
    fontSize: 11,
    fontWeight: '600',
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  msgWrapper: {
    marginBottom: 14,
    maxWidth: '82%',
  },
  msgRight: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  msgLeft: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  msgBubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  msgBubbleMine: {
    backgroundColor: '#D7FF00',
    borderBottomRightRadius: 4,
  },
  msgBubbleOther: {
    backgroundColor: '#1C1C24',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  msgText: {
    fontSize: 14,
    lineHeight: 20,
  },
  msgTextMine: {
    color: '#000000',
    fontWeight: '600',
  },
  msgTextOther: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  messageTimestamp: {
    color: '#71717A',
    fontSize: 9,
    marginTop: 4,
    marginHorizontal: 4,
  },

  // PING BUBBLE (BBM STYLE)
  pingContainer: {
    marginBottom: 14,
  },
  pingRight: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  pingLeft: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  pingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  pingBubbleMine: {
    backgroundColor: '#D7FF00',
    borderColor: '#D7FF00',
  },
  pingBubbleOther: {
    backgroundColor: '#2E2206',
    borderColor: '#FFD700',
  },
  pingText: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 2,
  },
  pingTextMine: {
    color: '#000000',
  },
  pingTextOther: {
    color: '#FFD700',
  },

  // PROMO CONTACT CARD BUBBLE
  cardBubble: {
    borderRadius: 18,
    padding: 12,
    width: 250,
    borderWidth: 1.5,
  },
  cardBubbleMine: {
    backgroundColor: '#1E1E26',
    borderColor: '#D7FF00',
  },
  cardBubbleOther: {
    backgroundColor: '#1B1910',
    borderColor: '#FFD700',
  },
  cardBubbleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardBubbleLabel: {
    color: '#FFD700',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cardBubbleBody: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardBubbleAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#FFD700',
  },
  cardBubbleName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  cardPinPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFD700',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    marginVertical: 2,
  },
  cardPinText: {
    color: '#000000',
    fontSize: 9,
    fontWeight: '900',
  },
  cardStatsText: {
    color: '#A1A1AA',
    fontSize: 10,
  },
  cardActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#D7FF00',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  cardActionBtnText: {
    color: '#000000',
    fontSize: 11,
    fontWeight: '800',
  },

  typingIndicator: {
    paddingHorizontal: 20,
    paddingVertical: 4,
  },
  typingText: {
    color: '#D7FF00',
    fontSize: 11,
    fontWeight: '600',
  },

  // INPUT CONTAINER
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#121217',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  pingActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  stickerPickerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E1E28',
    borderWidth: 1,
    borderColor: 'rgba(215, 255, 0, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#1C1C24',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 9,
    color: '#FFFFFF',
    fontSize: 13,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    marginRight: 8,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#D7FF00',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#3F3F46',
    opacity: 0.5,
  },
  clearChatBtn: {
    padding: 6,
    marginRight: 2,
  },
  threeDotsBtn: {
    padding: 6,
  },
  selectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 14,
    backgroundColor: '#181820',
    borderBottomWidth: 1,
    borderBottomColor: '#D7FF00',
  },
  selectionCancelBtn: {
    padding: 6,
  },
  selectionTitleText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  selectAllChip: {
    backgroundColor: '#272732',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  selectAllChipText: {
    color: '#D7FF00',
    fontSize: 12,
    fontWeight: '700',
  },
  selectionDeleteBtn: {
    padding: 6,
    backgroundColor: 'rgba(255, 69, 58, 0.15)',
    borderRadius: 8,
  },
  pingRowWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
    paddingHorizontal: 4,
    borderRadius: 12,
  },
  cardRowWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
    paddingHorizontal: 4,
    borderRadius: 12,
  },
  textRowWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
    paddingHorizontal: 4,
    borderRadius: 12,
  },
  selectedRowWrapper: {
    backgroundColor: 'rgba(215, 255, 0, 0.08)',
    borderRadius: 12,
  },
  selectionCheckCircle: {
    marginRight: 8,
    padding: 2,
  },
  pingBubbleSelected: {
    borderWidth: 2,
    borderColor: '#D7FF00',
  },
  cardBubbleSelected: {
    borderWidth: 2,
    borderColor: '#D7FF00',
  },
  msgBubbleSelected: {
    borderWidth: 2,
    borderColor: '#D7FF00',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  menuDropdownCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#16161E',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  menuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 8,
  },
  menuHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  menuHeaderPin: {
    color: '#FFD700',
    fontSize: 11,
    fontWeight: '700',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  menuIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuRowTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  menuRowSub: {
    color: '#71717A',
    fontSize: 11,
    marginTop: 2,
  },
  menuDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginVertical: 4,
  },
  menuCloseBtn: {
    marginTop: 12,
    backgroundColor: '#20202A',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  menuCloseBtnText: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '700',
  },
  emptyChatBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 30,
  },
  emptyChatIconCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#16161D',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  emptyChatTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyChatSub: {
    color: '#71717A',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },

  // STIKER ATLETIK CHAT
  stickerRowWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
    paddingHorizontal: 4,
    borderRadius: 14,
  },
  stickerBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    borderWidth: 1.5,
    maxWidth: 260,
  },
  stickerBubbleMine: {
    backgroundColor: '#1C1C24',
    borderColor: '#D7FF00',
  },
  stickerBubbleOther: {
    backgroundColor: '#181820',
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  stickerBubbleSelected: {
    borderWidth: 2,
    borderColor: '#D7FF00',
  },
  stickerEmojiContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  stickerEmojiText: {
    fontSize: 24,
  },
  stickerTitleText: {
    fontSize: 13,
    fontWeight: '800',
    flexShrink: 1,
  },

  // STIKER BOTTOM SHEET MODAL
  stickerSheetCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#14141B',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(215, 255, 0, 0.3)',
    maxHeight: 400,
  },
  stickerSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  stickerSheetTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  stickerCloseBtn: {
    padding: 6,
  },
  stickerCategoryTabs: {
    flexDirection: 'row',
    marginBottom: 14,
    gap: 6,
  },
  stickerCategoryTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#1E1E28',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  stickerCategoryTabActive: {
    backgroundColor: '#D7FF00',
    borderColor: '#D7FF00',
  },
  stickerCategoryTabText: {
    color: '#A1A1AA',
    fontSize: 11,
    fontWeight: '700',
  },
  stickerCategoryTabTextActive: {
    color: '#000000',
    fontWeight: '900',
  },
  stickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingBottom: 10,
  },
  stickerTile: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1B1B24',
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  stickerTileEmojiBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  stickerTileEmoji: {
    fontSize: 18,
  },
  stickerTileTitle: {
    fontSize: 11,
    fontWeight: '800',
    flex: 1,
  },
});
