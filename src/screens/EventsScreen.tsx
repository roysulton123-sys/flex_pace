import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  Image, 
  TouchableOpacity, 
  RefreshControl,
  TextInput,
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useNavigation } from '@react-navigation/native';

export interface AppEvent {
  id: string;
  title: string;
  description: string;
  image_url: string;
  price: number;
  date: string;
  category?: string;
  location?: string;
}

const CATEGORIES = ['Semua', '🏃 Fun Run', '🚴 Gowes', '🏅 Marathon', '🌲 Trail Run'];

export default function EventsScreen() {
  const navigation = useNavigation();
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('date', { ascending: true });

      if (error) {
        console.error('Error fetching events:', error);
      } else {
        setEvents(data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchEvents();
  };

  // Filter events by search query and category
  const filteredEvents = events.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (selectedCategory === 'Semua') return true;
    const catClean = selectedCategory.replace(/[^a-zA-Z]/g, '').toLowerCase();
    const itemTitle = (item.title || '').toLowerCase();
    const itemDesc = (item.description || '').toLowerCase();
    
    if (catClean.includes('funrun') || catClean.includes('run')) {
      return itemTitle.includes('fun') || itemTitle.includes('run') || itemTitle.includes('lari') || itemDesc.includes('run');
    }
    if (catClean.includes('gowes')) {
      return itemTitle.includes('gowes') || itemTitle.includes('sepeda') || itemTitle.includes('bike') || itemTitle.includes('cycling');
    }
    if (catClean.includes('marathon')) {
      return itemTitle.includes('marathon') || itemTitle.includes('half') || itemTitle.includes('21k') || itemTitle.includes('42k');
    }
    if (catClean.includes('trail')) {
      return itemTitle.includes('trail') || itemTitle.includes('gunung') || itemTitle.includes('alam');
    }
    return true;
  });

  const renderEventCard = ({ item }: { item: AppEvent }) => {
    const eventDate = new Date(item.date);
    const dateFormatted = isNaN(eventDate.getTime()) 
      ? item.date 
      : eventDate.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

    return (
      <TouchableOpacity 
        style={styles.card} 
        activeOpacity={0.85}
        onPress={() => {
          // @ts-ignore
          navigation.navigate('EventDetail', { event: item });
        }}
      >
        <View style={styles.imageContainer}>
          <Image 
            source={{ uri: item.image_url || 'https://images.unsplash.com/photo-1552674605-15c2198ea1b2?w=800&q=80' }} 
            style={styles.eventImage} 
            resizeMode="cover"
          />
          {/* Badge Harga di Pojok Atas */}
          <View style={[styles.priceBadge, item.price === 0 ? styles.freeBadge : styles.paidBadge]}>
            <Text style={styles.priceBadgeText}>
              {item.price === 0 ? 'GRATIS' : `Rp ${item.price.toLocaleString('id-ID')}`}
            </Text>
          </View>
        </View>

        <View style={styles.cardContent}>
          <View style={styles.dateRow}>
            <Ionicons name="calendar-outline" size={14} color="#D7FF00" style={{ marginRight: 5 }} />
            <Text style={styles.eventDate}>{dateFormatted}</Text>
          </View>

          <Text style={styles.eventTitle} numberOfLines={1}>{item.title}</Text>
          
          <Text style={styles.eventDescription} numberOfLines={2}>
            {item.description || 'Tidak ada deskripsi rincian event.'}
          </Text>
          
          <View style={styles.cardFooter}>
            <View style={styles.communityTag}>
              <Ionicons name="people" size={13} color="#A1A1AA" style={{ marginRight: 4 }} />
              <Text style={styles.communityTagText}>Event Komunitas</Text>
            </View>

            <TouchableOpacity 
              style={styles.joinButton}
              activeOpacity={0.8}
              onPress={() => {
                // @ts-ignore
                navigation.navigate('EventDetail', { event: item });
              }}
            >
              <Text style={styles.joinButtonText}>Daftar & Tiket</Text>
              <Ionicons name="chevron-forward" size={14} color="#000000" style={{ marginLeft: 2 }} />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Search Bar & Category Filters */}
      <View style={styles.topSection}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#71717A" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari Fun Run, Gowes, Marathon..."
            placeholderTextColor="#71717A"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#71717A" />
            </TouchableOpacity>
          )}
        </View>

        {/* Category horizontal scroll */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={styles.categoryScroll}
        >
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[styles.categoryChip, isSelected && styles.categoryChipActive]}
                onPress={() => setSelectedCategory(cat)}
                activeOpacity={0.8}
              >
                <Text style={[styles.categoryText, isSelected && styles.categoryTextActive]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Hero Banner: Ajak Semua Orang Buat Event */}
      <View style={styles.heroBanner}>
        <View style={styles.heroGlow} />
        <View style={styles.heroTextCol}>
          <Text style={styles.heroSub}>KOMUNITAS FLEX PACE</Text>
          <Text style={styles.heroTitle}>Adakan Fun Run / Gowes Anda</Text>
          <Text style={styles.heroDesc}>
            Semua atlet dapat mempublikasikan event lari santai atau gowes bersama secara gratis!
          </Text>
        </View>
        <TouchableOpacity 
          style={styles.heroButton}
          activeOpacity={0.85}
          onPress={() => {
            // @ts-ignore
            navigation.navigate('CreateEvent');
          }}
        >
          <Ionicons name="add" size={18} color="#000000" style={{ marginRight: 4 }} />
          <Text style={styles.heroButtonText}>Buat Event</Text>
        </TouchableOpacity>
      </View>

      {/* Event List */}
      {filteredEvents.length === 0 && !loading ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="calendar-clear-outline" size={54} color="#333333" />
          <Text style={styles.emptyTitle}>Belum ada Event yang sesuai</Text>
          <Text style={styles.emptySub}>
            {searchQuery ? 'Coba gunakan kata kunci pencarian lain.' : 'Jadilah yang pertama membuat Fun Run komunitas!'}
          </Text>
          <TouchableOpacity 
            style={styles.emptyCreateBtn}
            onPress={() => {
              // @ts-ignore
              navigation.navigate('CreateEvent');
            }}
          >
            <Ionicons name="add-circle-outline" size={18} color="#000000" style={{ marginRight: 6 }} />
            <Text style={styles.emptyCreateBtnText}>Buat Event Sekarang</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredEvents}
          keyExtractor={(item) => item.id}
          renderItem={renderEventCard}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#D7FF00']} tintColor="#D7FF00" />
          }
        />
      )}

      {/* Floating Action Button (Always Accessible for Everyone) */}
      <TouchableOpacity 
        style={styles.fab} 
        activeOpacity={0.85}
        onPress={() => {
          // @ts-ignore
          navigation.navigate('CreateEvent');
        }}
      >
        <Ionicons name="add" size={22} color="#000000" />
        <Text style={styles.fabText}>Buat Event</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0C',
  },
  topSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: '#0A0A0C',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#131317',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
  },
  categoryScroll: {
    paddingVertical: 12,
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#18181D',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: '#D7FF00',
    borderColor: '#D7FF00',
  },
  categoryText: {
    fontSize: 13,
    color: '#A1A1AA',
    fontWeight: '600',
  },
  categoryTextActive: {
    color: '#000000',
    fontWeight: '800',
  },
  heroBanner: {
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 16,
    backgroundColor: '#141419',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(215, 255, 0, 0.25)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
    position: 'relative',
  },
  heroGlow: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(215, 255, 0, 0.08)',
    top: -50,
    right: -40,
  },
  heroTextCol: {
    flex: 1,
    paddingRight: 12,
  },
  heroSub: {
    fontSize: 10,
    fontWeight: '900',
    color: '#D7FF00',
    letterSpacing: 1,
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  heroDesc: {
    fontSize: 12,
    color: '#A1A1AA',
    lineHeight: 16,
  },
  heroButton: {
    backgroundColor: '#D7FF00',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#D7FF00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 3,
  },
  heroButtonText: {
    color: '#000000',
    fontWeight: '800',
    fontSize: 12,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 90,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingBottom: 60,
  },
  emptyTitle: {
    marginTop: 14,
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  emptySub: {
    marginTop: 6,
    fontSize: 13,
    color: '#71717A',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  emptyCreateBtn: {
    backgroundColor: '#D7FF00',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 24,
  },
  emptyCreateBtnText: {
    color: '#000000',
    fontWeight: '800',
    fontSize: 14,
  },
  card: {
    backgroundColor: '#131317',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: 160,
    backgroundColor: '#1A1A20',
  },
  eventImage: {
    width: '100%',
    height: '100%',
  },
  priceBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
  },
  freeBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.92)',
  },
  paidBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  priceBadgeText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  cardContent: {
    padding: 14,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  eventDate: {
    fontSize: 12,
    fontWeight: '700',
    color: '#D7FF00',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  eventTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 6,
    color: '#FFFFFF',
  },
  eventDescription: {
    fontSize: 13,
    color: '#A1A1AA',
    lineHeight: 18,
    marginBottom: 14,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    paddingTop: 12,
  },
  communityTag: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  communityTagText: {
    fontSize: 12,
    color: '#A1A1AA',
    fontWeight: '600',
  },
  joinButton: {
    backgroundColor: '#D7FF00',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    shadowColor: '#D7FF00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  joinButtonText: {
    color: '#000000',
    fontWeight: '800',
    fontSize: 13,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    backgroundColor: '#D7FF00',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 30,
    elevation: 6,
    shadowColor: '#D7FF00',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
  },
  fabText: {
    color: '#000000',
    fontWeight: '900',
    fontSize: 14,
    marginLeft: 6,
  }
});
