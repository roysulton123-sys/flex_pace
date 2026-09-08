import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useNavigation } from '@react-navigation/native';

interface AppEvent {
  id: string;
  title: string;
  description: string;
  image_url: string;
  price: number;
  date: string;
}

export default function EventsScreen() {
  const navigation = useNavigation();
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOrganizer, setIsOrganizer] = useState(false);

  const checkUserRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
        
      if (data && data.role === 'organizer') {
        setIsOrganizer(true);
      }
    } catch (error) {
      console.log("Profile not found or error checking role", error);
    }
  };

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
    checkUserRole();
    fetchEvents();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    checkUserRole();
    fetchEvents();
  };

  const renderEventCard = ({ item }: { item: AppEvent }) => (
    <TouchableOpacity 
      style={styles.card} 
      onPress={() => {
        // @ts-ignore
        navigation.navigate('EventDetail', { event: item });
      }}
    >
      <Image source={{ uri: item.image_url || 'https://via.placeholder.com/400x200?text=Event' }} style={styles.eventImage} />
      <View style={styles.cardContent}>
        <Text style={styles.eventTitle}>{item.title}</Text>
        <Text style={styles.eventDate}>📅 {new Date(item.date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</Text>
        <Text style={styles.eventDescription} numberOfLines={2}>{item.description}</Text>
        
        <View style={styles.cardFooter}>
          <Text style={styles.eventPrice}>
            {item.price === 0 ? 'GRATIS' : `Rp ${item.price.toLocaleString('id-ID')}`}
          </Text>
          <TouchableOpacity 
            style={styles.joinButton}
            onPress={() => {
              // @ts-ignore
              navigation.navigate('EventDetail', { event: item });
            }}
          >
            <Text style={styles.joinButtonText}>Daftar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {events.length === 0 && !loading ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="calendar-outline" size={60} color="#ccc" />
          <Text style={styles.emptyText}>Belum ada Event terdekat.</Text>
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          renderItem={renderEventCard}
          contentContainerStyle={styles.listContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#FC4C02']} />}
        />
      )}

      {isOrganizer && (
        <TouchableOpacity 
          style={styles.fab} 
          onPress={() => {
            // @ts-ignore
            navigation.navigate('CreateEvent');
          }}
        >
          <Ionicons name="add" size={24} color="#fff" />
          <Text style={styles.fabText}>Buat Event</Text>
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
  listContainer: {
    padding: 15,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 10,
    fontSize: 16,
    color: '#999999',
  },
  card: {
    backgroundColor: '#111111',
    borderRadius: 12,
    marginBottom: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#333333',
  },
  eventImage: {
    width: '100%',
    height: 150,
    backgroundColor: '#222222',
  },
  cardContent: {
    padding: 15,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#ffffff',
  },
  eventDate: {
    fontSize: 14,
    color: '#D7FF00',
    marginBottom: 10,
  },
  eventDescription: {
    fontSize: 14,
    color: '#aaaaaa',
    marginBottom: 15,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: '#333333',
    paddingTop: 10,
  },
  eventPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  joinButton: {
    backgroundColor: '#D7FF00',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  joinButtonText: {
    color: '#000000',
    fontWeight: 'bold',
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#D7FF00',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 30,
    elevation: 5,
    shadowColor: '#D7FF00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  fabText: {
    color: '#000000',
    fontWeight: 'bold',
    marginLeft: 5,
  }
});
