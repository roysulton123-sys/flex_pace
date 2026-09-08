import React, { useState, useEffect } from 'react';
import { View, FlatList, StyleSheet, RefreshControl, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import ActivityCard, { ActivityData } from '../components/ActivityCard';
import PostCard, { PostData } from '../components/PostCard';
import { supabase } from '../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

export default function HomeScreen() {
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState<'social' | 'sports'>('social');
  
  const [activities, setActivities] = useState<ActivityData[]>([]);
  const [posts, setPosts] = useState<PostData[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>(undefined);
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
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
    if (activeTab === 'social') {
      await fetchPosts();
    } else {
      await fetchActivities();
    }
    setRefreshing(false);
  };

  const fetchPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          id,
          user_id,
          image_url,
          caption,
          created_at,
          profiles (
            name,
            avatar_url
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
        console.error('Error fetching posts:', error.message);
      } else {
        setPosts(data as any[]);
      }
    } catch (err) {
      console.error(err);
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

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#D7FF00" />
        </View>
      );
    }

    if (activeTab === 'social') {
      if (posts.length === 0) {
        return (
          <View style={styles.center}>
            <Ionicons name="camera-outline" size={60} color="#444" />
            <Text style={styles.emptyText}>Belum ada postingan sosial.</Text>
            <Text style={styles.emptySubText}>Jadilah yang pertama berbagi momen!</Text>
          </View>
        );
      }
      return (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
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
          <Text style={[styles.tabText, activeTab === 'social' && styles.activeTabText]}>Sosial</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'sports' && styles.activeTab]}
          onPress={() => setActiveTab('sports')}
        >
          <Text style={[styles.tabText, activeTab === 'sports' && styles.activeTabText]}>Aktivitas Olahraga</Text>
        </TouchableOpacity>
      </View>

      {/* Main Feed Content */}
      {renderContent()}

      {/* Floating Action Button for Posting */}
      {activeTab === 'social' && (
        <TouchableOpacity 
          style={styles.fab}
          onPress={() => {
            // @ts-ignore
            navigation.navigate('CreatePost');
          }}
          activeOpacity={0.85}
        >
          <Ionicons name="camera" size={18} color="#000000" style={{ marginRight: 6 }} />
          <Text style={{ color: '#000000', fontWeight: '800', fontSize: 13, letterSpacing: 0.2 }}>Post Foto</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#141418',
    borderRadius: 24,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
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
    fontWeight: '800',
  },
  listContainer: {
    paddingVertical: 8,
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
  }
});
