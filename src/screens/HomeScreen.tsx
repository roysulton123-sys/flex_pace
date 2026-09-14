import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  View, 
  FlatList, 
  StyleSheet, 
  RefreshControl, 
  Text, 
  ActivityIndicator, 
  TouchableOpacity,
  Image, 
  ScrollView, 
  Modal, 
  Dimensions, 
  Animated,
  Alert 
} from 'react-native';
import ActivityCard, { ActivityData } from '../components/ActivityCard';
import PostCard, { PostData } from '../components/PostCard';
import { supabase } from '../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface AthleteStory {
  id: string;
  user_id?: string;
  name: string;
  avatar: string;
  photo: string;
  pace: string;
  distance: string;
  time: string;
  bpm: string;
  ringColor: string;
  badge: string;
  timeAgo: string;
  created_at?: string;
  hasBakedHud?: boolean;
}

export default function HomeScreen() {
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState<'social' | 'sports'>('social');
  const [socialViewMode, setSocialViewMode] = useState<'feed' | 'mosaic'>('feed');
  
  const [activities, setActivities] = useState<ActivityData[]>([]);
  const [posts, setPosts] = useState<PostData[]>([]);
  const [stories, setStories] = useState<AthleteStory[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>(undefined);
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Story Viewer Modal State
  const [selectedStory, setSelectedStory] = useState<AthleteStory | null>(null);
  const storyProgress = useRef(new Animated.Value(0)).current;

  // Add Story Action Modal State
  const [addStoryModalVisible, setAddStoryModalVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchCurrentUser();
      loadStories();
      if (activeTab === 'social') {
        fetchPosts();
      } else {
        fetchActivities();
      }
    }, [activeTab])
  );

  useEffect(() => {
    fetchCurrentUser();
    loadStories();
  }, []);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        const { data: prof } = await supabase
          .from('profiles')
          .select('name, avatar_url')
          .eq('id', user.id)
          .maybeSingle();
        if (prof) {
          setUserProfile(prof);
        }
      }
    } catch (e) {
      console.log('Error fetching current user:', e);
    }
  };

  const loadStories = async () => {
    try {
      const saved = await AsyncStorage.getItem('@fp_user_stories');
      if (saved) {
        const parsed: AthleteStory[] = JSON.parse(saved);
        const nowTime = Date.now();
        // Hanya simpan dan tampilkan story yang aktif dalam 24 jam terakhir
        const validStories = parsed.filter((s: AthleteStory) => {
          if (!s.created_at) return true;
          return nowTime - new Date(s.created_at).getTime() < 24 * 60 * 60 * 1000;
        });
        if (validStories.length !== parsed.length) {
          await AsyncStorage.setItem('@fp_user_stories', JSON.stringify(validStories));
        }
        setStories(validStories);
      } else {
        setStories([]);
      }
    } catch (e) {
      setStories([]);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    if (activeTab === 'social') {
      await fetchPosts();
    } else {
      await fetchActivities();
    }
    setLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStories();
    if (activeTab === 'social') {
      await fetchPosts();
    } else {
      await fetchActivities();
    }
    setRefreshing(false);
  };

  const fetchPosts = async () => {
    try {
      let { data, error } = await supabase
        .from('posts')
        .select(`
          id,
          user_id,
          image_url,
          caption,
          created_at,
          profiles (
            name,
            avatar_url,
            role,
            is_premium
          ),
          likes (
            user_id
          ),
          comments (
            id
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Error fetching posts with relations, trying fallback:', error.message);
        // Resilient Fallback 1: posts with profiles
        const fallback1 = await supabase
          .from('posts')
          .select(`
            id,
            user_id,
            image_url,
            caption,
            created_at,
            profiles (
              name,
              avatar_url,
              role,
              is_premium
            )
          `)
          .order('created_at', { ascending: false });

        if (!fallback1.error && fallback1.data) {
          data = fallback1.data as any[];
        } else {
          // Resilient Fallback 2: raw posts
          const fallback2 = await supabase
            .from('posts')
            .select('*')
            .order('created_at', { ascending: false });
          data = (fallback2.data as any[]) || [];
        }
      }

      if (data) {
        setPosts(data as any[]);
      }
    } catch (err) {
      console.error('Catch error fetching posts:', err);
    }
  };

  const fetchActivities = async () => {
    try {
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching activities:', error.message);
      } else {
        setActivities(data as ActivityData[]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Story Viewer Handlers
  const handleOpenStory = (story: AthleteStory) => {
    setSelectedStory(story);
    storyProgress.setValue(0);
    Animated.timing(storyProgress, {
      toValue: 1,
      duration: 5000,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) {
        setSelectedStory(null);
      }
    });
  };

  const handleCloseStory = () => {
    storyProgress.stopAnimation();
    setSelectedStory(null);
  };

  const handleDeleteStory = (storyId: string) => {
    Alert.alert(
      'Hapus Story',
      'Apakah Anda yakin ingin menghapus story ini dari Beranda?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              handleCloseStory();
              const updated = stories.filter(s => s.id !== storyId);
              setStories(updated);
              await AsyncStorage.setItem('@fp_user_stories', JSON.stringify(updated));
            } catch (e) {
              console.error('Error deleting story:', e);
            }
          }
        }
      ]
    );
  };

  // Render Horizontal Story Bar
  const renderStoryBar = () => {
    const myStory = stories.find(s => 
      (currentUserId && s.user_id === currentUserId) || 
      (userProfile?.name && s.name === userProfile.name)
    );
    const otherStories = stories.filter(s => s.id !== myStory?.id);

    return (
      <View style={styles.storyBarContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storyScroll}>
          {/* Tombol Cerita Anda */}
          <TouchableOpacity 
            style={styles.storyItem} 
            activeOpacity={0.8}
            onPress={() => {
              if (myStory) {
                handleOpenStory(myStory);
              } else {
                setAddStoryModalVisible(true);
              }
            }}
            onLongPress={() => setAddStoryModalVisible(true)}
          >
            <View style={[styles.myStoryRing, myStory ? styles.myStoryRingActive : null]}>
              <Image 
                source={{ uri: userProfile?.avatar_url || (myStory ? myStory.avatar : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&q=80') }} 
                style={styles.storyAvatar} 
              />
              <TouchableOpacity 
                style={[styles.myStoryAddBadge, myStory ? styles.myStoryActiveBadge : null]}
                onPress={() => setAddStoryModalVisible(true)}
                activeOpacity={0.85}
              >
                <Ionicons name="add" size={14} color="#000000" />
              </TouchableOpacity>
            </View>
            <Text style={[styles.storyName, myStory ? styles.myStoryNameActive : null]} numberOfLines={1}>
              Cerita Anda
            </Text>
          </TouchableOpacity>

          {/* Story Riil Pengguna */}
          {otherStories.map((story) => (
            <TouchableOpacity 
              key={story.id} 
              style={styles.storyItem} 
              activeOpacity={0.8}
              onPress={() => handleOpenStory(story)}
            >
              <View style={[styles.athleteStoryRing, { borderColor: story.ringColor || '#D7FF00' }]}>
                <Image source={{ uri: story.avatar }} style={styles.storyAvatar} />
                <View style={[styles.storyPaceBadge, { backgroundColor: story.ringColor || '#D7FF00' }]}>
                  <Text style={styles.storyPaceBadgeText}>{story.badge || 'PACE'}</Text>
                </View>
              </View>
              <Text style={styles.storyName} numberOfLines={1}>{story.name}</Text>
            </TouchableOpacity>
          ))}

        {stories.length === 0 && (
          <TouchableOpacity 
            style={styles.emptyStoryHint}
            onPress={() => setAddStoryModalVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="camera-outline" size={14} color="#A1A1AA" style={{ marginRight: 6 }} />
            <Text style={styles.emptyStoryHintText}>Buat Story Pace</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* View Mode Switcher for Social Tab */}
      <View style={styles.socialHeaderRow}>
        <View style={styles.socialHeaderTitleBox}>
          <Text style={styles.socialHeaderTitle}>FEED ATLET</Text>
          <Text style={styles.socialHeaderSub}>Momen Olahraga Terkini</Text>
        </View>

        <View style={styles.viewModeToggle}>
          <TouchableOpacity 
            style={[styles.viewModeBtn, socialViewMode === 'feed' && styles.viewModeBtnActive]}
            onPress={() => setSocialViewMode('feed')}
            activeOpacity={0.8}
          >
            <Ionicons name="albums-outline" size={16} color={socialViewMode === 'feed' ? '#000000' : '#A1A1AA'} />
            <Text style={[styles.viewModeText, socialViewMode === 'feed' && styles.viewModeTextActive]}>Feed</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.viewModeBtn, socialViewMode === 'mosaic' && styles.viewModeBtnActive]}
            onPress={() => setSocialViewMode('mosaic')}
            activeOpacity={0.8}
          >
            <Ionicons name="grid-outline" size={16} color={socialViewMode === 'mosaic' ? '#000000' : '#A1A1AA'} />
            <Text style={[styles.viewModeText, socialViewMode === 'mosaic' && styles.viewModeTextActive]}>Mozaik</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

  // Render Mosaic (2-Column Grid) Item
  const renderMosaicItem = ({ item }: { item: PostData }) => {
    const userName = item.profiles?.name || 'Flex Athlete';
    return (
      <TouchableOpacity 
        style={styles.mosaicCard} 
        activeOpacity={0.85}
        onPress={() => {
          // Switch ke feed mode dan scroll ke post
          setSocialViewMode('feed');
        }}
      >
        <Image 
          source={{ uri: item.image_url || 'https://images.unsplash.com/photo-1552674605-15c2198ea1b2?w=800&q=80' }} 
          style={styles.mosaicImage} 
          resizeMode="cover"
        />
        
        {/* Telemetry Pill Overlay */}
        <View style={styles.mosaicTelemetryBadge}>
          <Ionicons name="flash" size={10} color="#D7FF00" style={{ marginRight: 3 }} />
          <Text style={styles.mosaicTelemetryText} numberOfLines={1}>
            {item.telemetry ? item.telemetry.split('•')[0] : '5.2 KM'}
          </Text>
        </View>

        {/* Bottom Details Overlay */}
        <View style={styles.mosaicBottomRow}>
          <Text style={styles.mosaicAuthor} numberOfLines={1}>@{userName}</Text>
          <View style={styles.mosaicLikesRow}>
            <Ionicons name="heart" size={12} color="#FF3B30" style={{ marginRight: 3 }} />
            <Text style={styles.mosaicLikesCount}>{item.likes?.length || 0}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyFeed = () => (
    <View style={styles.emptyFeedBox}>
      <View style={styles.emptyFeedIconCircle}>
        <Ionicons name="images-outline" size={38} color="#71717A" />
      </View>
      <Text style={styles.emptyFeedTitle}>Belum Ada Postingan Atlet</Text>
      <Text style={styles.emptyFeedDesc}>
        Feed masih bersih. Jadilah yang pertama membagikan foto lari, pacemu, atau rute olahraga ke feed Flex Pace!
      </Text>
      <TouchableOpacity 
        style={styles.emptyFeedBtn}
        onPress={() => (navigation as any).navigate('CreatePost')}
        activeOpacity={0.85}
      >
        <Ionicons name="add-circle" size={18} color="#000000" style={{ marginRight: 6 }} />
        <Text style={styles.emptyFeedBtnText}>Bagikan Postingan Sekarang</Text>
      </TouchableOpacity>
    </View>
  );

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#D7FF00" />
        </View>
      );
    }

    if (activeTab === 'social') {
      if (socialViewMode === 'mosaic') {
        return (
          <FlatList
            data={posts}
            key="mosaic-grid"
            numColumns={2}
            keyExtractor={(item) => item.id}
            ListHeaderComponent={renderStoryBar}
            ListEmptyComponent={renderEmptyFeed}
            renderItem={renderMosaicItem}
            columnWrapperStyle={styles.mosaicRow}
            contentContainerStyle={styles.listContainer}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#D7FF00']} tintColor="#D7FF00" />
            }
          />
        );
      }

      return (
        <FlatList
          data={posts}
          key="feed-single"
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderStoryBar}
          ListEmptyComponent={renderEmptyFeed}
          renderItem={({ item }) => (
            <PostCard 
              post={item} 
              currentUserId={currentUserId} 
              onPostUpdated={fetchPosts} 
            />
          )}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#D7FF00']} tintColor="#D7FF00" />
          }
        />
      );
    } else {
      if (activities.length === 0) {
        return (
          <View style={styles.center}>
            <Ionicons name="bicycle-outline" size={60} color="#444" />
            <Text style={styles.emptyText}>Belum ada aktivitas yang direkam.</Text>
            <Text style={styles.emptySubText}>Mulai lari atau bersepeda di tab Record!</Text>
          </View>
        );
      }
      return (
        <FlatList
          data={activities}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ActivityCard activity={item} />}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#D7FF00']} tintColor="#D7FF00" />
          }
        />
      );
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Segmented Control */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'social' && styles.activeTab]}
          onPress={() => setActiveTab('social')}
        >
          <Ionicons name="flame" size={15} color={activeTab === 'social' ? '#000000' : '#71717A'} style={{ marginRight: 6 }} />
          <Text style={[styles.tabText, activeTab === 'social' && styles.activeTabText]}>Sosial & Stories</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'sports' && styles.activeTab]}
          onPress={() => setActiveTab('sports')}
        >
          <Ionicons name="fitness" size={15} color={activeTab === 'sports' ? '#000000' : '#71717A'} style={{ marginRight: 6 }} />
          <Text style={[styles.tabText, activeTab === 'sports' && styles.activeTabText]}>Aktivitas Saya</Text>
        </TouchableOpacity>
      </View>

      {/* Main Feed Content */}
      {renderContent()}

      {/* Floating Action Button for Posting */}
      {activeTab === 'social' && (
        <TouchableOpacity 
          style={styles.fab}
          onPress={() => setAddStoryModalVisible(true)}
          activeOpacity={0.85}
        >
          <Ionicons name="camera" size={18} color="#000000" style={{ marginRight: 6 }} />
          <Text style={{ color: '#000000', fontWeight: '900', fontSize: 13, letterSpacing: 0.2 }}>Buat Momen</Text>
        </TouchableOpacity>
      )}

      {/* MODAL PILIHAN BUAT KONTEN (STORY 9:16 VS POST FOTO) */}
      <Modal
        visible={addStoryModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setAddStoryModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalBackdrop} 
          activeOpacity={1} 
          onPress={() => setAddStoryModalVisible(false)}
        >
          <View style={styles.actionSheetCard}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>BAGIKAN MOMEN OLAHRAGA</Text>
            <Text style={styles.sheetDesc}>Pilih format tampilan untuk berbagi pencapaian Anda:</Text>

            {/* Opsi 1: Story 9:16 dengan HUD Pace */}
            <TouchableOpacity 
              style={styles.sheetOption}
              activeOpacity={0.8}
              onPress={() => {
                setAddStoryModalVisible(false);
                // @ts-ignore
                navigation.navigate('ShareStory');
              }}
            >
              <View style={[styles.sheetIconBox, { backgroundColor: '#D7FF00' }]}>
                <Ionicons name="phone-portrait" size={24} color="#000000" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetOptionTitle}>Story 9:16 Pace Selfie</Text>
                <Text style={styles.sheetOptionSub}>Post ke Story Beranda atau bagikan ke WhatsApp & Instagram.</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#71717A" />
            </TouchableOpacity>

            {/* Opsi 2: Post Feed Standar */}
            <TouchableOpacity 
              style={styles.sheetOption}
              activeOpacity={0.8}
              onPress={() => {
                setAddStoryModalVisible(false);
                // @ts-ignore
                navigation.navigate('CreatePost');
              }}
            >
              <View style={[styles.sheetIconBox, { backgroundColor: '#00F0FF' }]}>
                <Ionicons name="images" size={24} color="#000000" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetOptionTitle}>Post Foto Feed</Text>
                <Text style={styles.sheetOptionSub}>Unggah foto ke feed sosial lengkap dengan caption & like.</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#71717A" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.sheetCancelBtn}
              onPress={() => setAddStoryModalVisible(false)}
            >
              <Text style={styles.sheetCancelText}>Batal</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* FULLSCREEN 9:16 ATHLETE STORY VIEWER MODAL */}
      {selectedStory && (
        <Modal
          visible={!!selectedStory}
          animationType="fade"
          transparent={false}
          onRequestClose={handleCloseStory}
        >
          <View style={styles.storyViewerContainer}>
            {/* Background 9:16 Photo */}
            <Image 
              source={{ uri: selectedStory.photo }} 
              style={styles.storyViewerPhoto} 
              resizeMode="cover"
            />

            {/* Dark gradient overlay */}
            <View style={styles.storyViewerOverlay} />

            {/* Progress Bar at Top */}
            <View style={styles.progressBarBg}>
              <Animated.View 
                style={[
                  styles.progressBarFill, 
                  {
                    width: storyProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%']
                    })
                  }
                ]} 
              />
            </View>

            {/* Header: Athlete Avatar & Close / Delete Action */}
            <View style={styles.storyViewerHeader}>
              <View style={styles.storyViewerUser}>
                <Image source={{ uri: selectedStory.avatar }} style={styles.storyViewerAvatar} />
                <View>
                  <Text style={styles.storyViewerName}>{selectedStory.name}</Text>
                  <Text style={styles.storyViewerTime}>{selectedStory.timeAgo || 'Baru saja'}</Text>
                </View>
              </View>

              <View style={styles.storyViewerActions}>
                {/* Tombol Hapus Story jika milik akun pengguna sendiri */}
                {(selectedStory.user_id === currentUserId || (userProfile?.name && selectedStory.name === userProfile.name)) && (
                  <TouchableOpacity 
                    onPress={() => handleDeleteStory(selectedStory.id)} 
                    style={styles.storyViewerDeleteBtn}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="trash-outline" size={18} color="#FF453A" />
                  </TouchableOpacity>
                )}

                <TouchableOpacity onPress={handleCloseStory} style={styles.storyViewerClose}>
                  <Ionicons name="close" size={26} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Center HUD Telemetry Overlay Card - Hanya tampil bila foto tidak memiliki baked HUD */}
            {!selectedStory.hasBakedHud && (
              <View style={styles.storyViewerHud}>
                <View style={styles.hudHeader}>
                  <Ionicons name="flash" size={16} color="#D7FF00" style={{ marginRight: 6 }} />
                  <Text style={styles.hudBrand}>FLEX PACE TELEMETRY</Text>
                </View>

                <View style={styles.hudStatsGrid}>
                  <View style={styles.hudStatBox}>
                    <Text style={styles.hudLabel}>PACE</Text>
                    <Text style={styles.hudVal}>{selectedStory.pace}</Text>
                  </View>
                  <View style={styles.hudStatBox}>
                    <Text style={styles.hudLabel}>JARAK</Text>
                    <Text style={styles.hudVal}>{selectedStory.distance}</Text>
                  </View>
                  <View style={styles.hudStatBox}>
                    <Text style={styles.hudLabel}>WAKTU</Text>
                    <Text style={styles.hudVal}>{selectedStory.time}</Text>
                  </View>
                  <View style={styles.hudStatBox}>
                    <Text style={styles.hudLabel}>HEART RATE</Text>
                    <Text style={[styles.hudVal, { color: '#FF3B30' }]}>{selectedStory.bpm || '156'} bpm</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Bottom Quick Reaction Row */}
            <View style={styles.storyViewerBottomBar}>
              <Text style={styles.reactionLabel}>Beri Semangat:</Text>
              <View style={styles.reactionEmojis}>
                {['🔥', '⚡', '👏', '❤️'].map((emoji) => (
                  <TouchableOpacity 
                    key={emoji} 
                    style={styles.reactionBtn}
                    onPress={() => {
                      handleCloseStory();
                    }}
                  >
                    <Text style={{ fontSize: 22 }}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0C',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#141418',
    borderRadius: 24,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 6,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  activeTab: {
    backgroundColor: '#D7FF00',
    shadowColor: '#D7FF00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 2,
  },
  tabText: {
    color: '#71717A',
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.2,
  },
  activeTabText: {
    color: '#000000',
    fontWeight: '900',
  },

  // STORY BAR STYLES
  storyBarContainer: {
    paddingTop: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 10,
  },
  storyScroll: {
    paddingHorizontal: 14,
    gap: 12,
  },
  storyItem: {
    alignItems: 'center',
    width: 68,
  },
  myStoryRing: {
    position: 'relative',
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#D7FF00',
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  myStoryRingActive: {
    borderStyle: 'solid',
    borderColor: '#D7FF00',
    borderWidth: 2.5,
    shadowColor: '#D7FF00',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 5,
  },
  myStoryAddBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#D7FF00',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#0A0A0C',
  },
  myStoryActiveBadge: {
    backgroundColor: '#D7FF00',
  },
  myStoryNameActive: {
    color: '#D7FF00',
    fontWeight: '800',
  },
  athleteStoryRing: {
    position: 'relative',
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 2.5,
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  storyAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1E1E24',
  },
  storyPaceBadge: {
    position: 'absolute',
    bottom: -4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
  },
  storyPaceBadgeText: {
    color: '#000000',
    fontWeight: '900',
    fontSize: 8,
    letterSpacing: 0.3,
  },
  storyName: {
    color: '#D4D4D8',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center',
  },

  // SOCIAL HEADER & VIEW MODE
  socialHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  socialHeaderTitleBox: {},
  socialHeaderTitle: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 0.8,
  },
  socialHeaderSub: {
    color: '#71717A',
    fontSize: 11,
    marginTop: 1,
  },
  viewModeToggle: {
    flexDirection: 'row',
    backgroundColor: '#141418',
    borderRadius: 14,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  viewModeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 10,
    gap: 4,
  },
  viewModeBtnActive: {
    backgroundColor: '#D7FF00',
  },
  viewModeText: {
    fontSize: 11,
    color: '#A1A1AA',
    fontWeight: '700',
  },
  viewModeTextActive: {
    color: '#000000',
    fontWeight: '900',
  },

  // MOSAIC GRID STYLES (2-COLUMN)
  mosaicRow: {
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  mosaicCard: {
    width: (SCREEN_WIDTH - 38) / 2,
    height: 230,
    backgroundColor: '#141419',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    position: 'relative',
  },
  mosaicImage: {
    width: '100%',
    height: '100%',
  },
  mosaicTelemetryBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(10, 10, 12, 0.85)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(215, 255, 0, 0.3)',
  },
  mosaicTelemetryText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  mosaicBottomRow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mosaicAuthor: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    flex: 1,
  },
  mosaicLikesRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mosaicLikesCount: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },

  listContainer: {
    paddingVertical: 6,
    paddingBottom: 90,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0A0A0C',
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubText: {
    fontSize: 13,
    color: '#71717A',
    marginTop: 6,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    backgroundColor: '#D7FF00',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 28,
    shadowColor: '#D7FF00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },

  // ACTION SHEET MODAL
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  actionSheetCard: {
    backgroundColor: '#141419',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#333338',
    alignSelf: 'center',
    marginBottom: 18,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  sheetDesc: {
    fontSize: 13,
    color: '#A1A1AA',
    marginTop: 4,
    marginBottom: 20,
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C22',
    padding: 14,
    borderRadius: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  sheetIconBox: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  sheetOptionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  sheetOptionSub: {
    fontSize: 12,
    color: '#A1A1AA',
    lineHeight: 16,
  },
  sheetCancelBtn: {
    marginTop: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  sheetCancelText: {
    color: '#71717A',
    fontWeight: '700',
    fontSize: 14,
  },

  // FULLSCREEN 9:16 STORY VIEWER
  storyViewerContainer: {
    flex: 1,
    backgroundColor: '#000000',
    position: 'relative',
  },
  storyViewerPhoto: {
    width: '100%',
    height: '100%',
  },
  storyViewerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  progressBarBg: {
    position: 'absolute',
    top: 45,
    left: 16,
    right: 16,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    overflow: 'hidden',
    zIndex: 10,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#D7FF00',
  },
  storyViewerHeader: {
    position: 'absolute',
    top: 56,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  storyViewerUser: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  storyViewerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: '#D7FF00',
    marginRight: 10,
  },
  storyViewerName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  storyViewerTime: {
    color: '#D4D4D8',
    fontSize: 11,
  },
  storyViewerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  storyViewerDeleteBtn: {
    padding: 6,
    backgroundColor: 'rgba(255, 69, 58, 0.2)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 69, 58, 0.4)',
  },
  storyViewerClose: {
    padding: 6,
  },
  storyViewerHud: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(10, 10, 12, 0.88)',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#D7FF00',
  },
  hudHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  hudBrand: {
    color: '#D7FF00',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  hudStatsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  hudStatBox: {
    alignItems: 'center',
  },
  hudLabel: {
    color: '#71717A',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  hudVal: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  storyViewerBottomBar: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reactionLabel: {
    color: '#D4D4D8',
    fontSize: 13,
    fontWeight: '700',
  },
  reactionEmojis: {
    flexDirection: 'row',
    gap: 12,
  },
  reactionBtn: {
    padding: 4,
  },
  emptyStoryHint: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16161D',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 20,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: '#27272A',
    borderStyle: 'dashed',
  },
  emptyStoryHintText: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyFeedBox: {
    backgroundColor: '#121216',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginVertical: 30,
    borderWidth: 1,
    borderColor: '#1E1E26',
  },
  emptyFeedIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#1C1C24',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  emptyFeedTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyFeedDesc: {
    color: '#A1A1AA',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  emptyFeedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D7FF00',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
  },
  emptyFeedBtnText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '800',
  },
});
