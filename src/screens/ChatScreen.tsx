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
  ScrollView
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

interface ChatMessage {
  id: string;
  senderId: string;
  recipientId: string;
  text: string;
  isPing?: boolean;
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
      } else {
        // Pesan sambutan awal otomatis
        loadedMessages = [
          {
            id: 'init-1',
            senderId: recipientId || 'other',
            recipientId: myId,
            text: `Halo! Salam kenal, mari pacu target pace bareng di Flex Pace! 🏃⚡`,
            created_at: new Date(Date.now() - 3600000).toISOString(),
          }
        ];
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
      }

      setMessages(loadedMessages);
      await AsyncStorage.setItem(chatStorageKey, JSON.stringify(loadedMessages));

      // Catat juga ke percakapan aktif
      await saveConversationEntry(myId, loadedMessages[loadedMessages.length - 1]);
    } catch (e) {
      console.log('Error init chat:', e);
    }
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
        lastMessage: lastMsg.isPing ? '⚡ * P I N G ! ! ! *' : lastMsg.text,
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

    // Simulasi balasan cerdas atlet jika PING atau pertanyaan
    simulateAthleteReply(newMsg);
  };

  const simulateAthleteReply = (lastUserMsg: ChatMessage) => {
    setIsTyping(true);
    setTimeout(async () => {
      setIsTyping(false);
      let replyText = 'Siap! Mau jadwalkan lari bareng kapan nih? 🏃';

      if (lastUserMsg.isPing) {
        replyText = '⚡ PING juga bro! Ada info rute atau event Fun Run baru?';
        triggerPingBuzz();
      } else if (lastUserMsg.text.toLowerCase().includes('pace')) {
        replyText = 'Target pace saya besok pagi kisaran 05:15 /km jarak 10K. Ayo gabung!';
      } else if (lastUserMsg.promoCard) {
        replyText = `Wah mantap, terima kasih rekomendasinya! Langsung saya invite PIN atlet ${lastUserMsg.promoCard.name} 👍`;
      }

      const replyMsg: ChatMessage = {
        id: `reply-${Date.now()}`,
        senderId: recipientId || 'other',
        recipientId: currentUserId,
        text: replyText,
        created_at: new Date().toISOString(),
      };

      setMessages(prev => {
        const next = [...prev, replyMsg];
        AsyncStorage.setItem(chatStorageKey, JSON.stringify(next));
        saveConversationEntry(currentUserId, replyMsg);
        return next;
      });

      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }, 1600);
  };

  const sendBbmPing = () => {
    sendMessage(undefined, true);
  };

  const formatMessageTime = (isoString: string) => {
    const d = new Date(isoString);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <Animated.View style={[styles.container, { transform: [{ translateX: shakeAnim }] }]}>
      {/* HEADER OBROLAN */}
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

        <TouchableOpacity 
          style={styles.viewProfileBtn}
          onPress={() => {
            navigation.navigate('UserProfile', {
              userId: recipientId,
              userName: recipientName,
              userAvatar: recipientAvatar,
            });
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="person-circle-outline" size={26} color="#D7FF00" />
        </TouchableOpacity>
      </View>

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
        renderItem={({ item }) => {
          const isMine = item.senderId === currentUserId;

          // 1. Render Pesan PING!!! BBM
          if (item.isPing) {
            return (
              <View style={[styles.pingContainer, isMine ? styles.pingRight : styles.pingLeft]}>
                <View style={[styles.pingBubble, isMine ? styles.pingBubbleMine : styles.pingBubbleOther]}>
                  <Ionicons name="flash" size={16} color={isMine ? "#000000" : "#FFD700"} style={{ marginRight: 6 }} />
                  <Text style={[styles.pingText, isMine ? styles.pingTextMine : styles.pingTextOther]}>
                    * P I N G ! ! ! *
                  </Text>
                </View>
                <Text style={styles.messageTimestamp}>{formatMessageTime(item.created_at)}</Text>
              </View>
            );
          }

          // 2. Render Kartu Kontak Promosi Atlet (BBM Style)
          if (item.promoCard) {
            const card = item.promoCard;
            return (
              <View style={[styles.msgWrapper, isMine ? styles.msgRight : styles.msgLeft]}>
                <View style={[styles.cardBubble, isMine ? styles.cardBubbleMine : styles.cardBubbleOther]}>
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
            );
          }

          // 3. Render Pesan Teks Standar
          return (
            <View style={[styles.msgWrapper, isMine ? styles.msgRight : styles.msgLeft]}>
              <View style={[styles.msgBubble, isMine ? styles.msgBubbleMine : styles.msgBubbleOther]}>
                <Text style={[styles.msgText, isMine ? styles.msgTextMine : styles.msgTextOther]}>
                  {item.text}
                </Text>
              </View>
              <Text style={styles.messageTimestamp}>{formatMessageTime(item.created_at)}</Text>
            </View>
          );
        }}
      />

      {/* INDIKATOR SEDANG MENGETIK */}
      {isTyping && (
        <View style={styles.typingIndicator}>
          <Text style={styles.typingText}>⚡ {recipientName || 'Teman'} sedang mengetik...</Text>
        </View>
      )}

      {/* BILAH INPUT PESAN & TOMBOL PING BBM */}
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.inputContainer}>
          {/* TOMBOL PING!!! BBM */}
          <TouchableOpacity 
            style={styles.pingActionBtn}
            onPress={sendBbmPing}
            activeOpacity={0.8}
          >
            <Ionicons name="flash" size={15} color="#000000" />
            <Text style={styles.pingActionBtnText}>PING!</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFD700',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    marginRight: 8,
  },
  pingActionBtnText: {
    color: '#000000',
    fontSize: 11,
    fontWeight: '900',
    marginLeft: 3,
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
  }
});
