import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useNavigation, useRoute } from '@react-navigation/native';

export default function EventDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  // @ts-ignore
  const { event } = route.params;

  const [loading, setLoading] = useState(false);
  const [hasRegistered, setHasRegistered] = useState(false);
  const [checkingRegistration, setCheckingRegistration] = useState(true);

  useEffect(() => {
    checkRegistrationStatus();
  }, []);

  const checkRegistrationStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('event_registrations')
        .select('*')
        .eq('event_id', event.id)
        .eq('user_id', user.id)
        .single();

      if (data) {
        setHasRegistered(true);
      }
    } catch (error) {
      // Not registered or error
    } finally {
      setCheckingRegistration(false);
    }
  };

  const handleRegister = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Silakan login terlebih dahulu.");

      // Disini nanti integrasi Payment Gateway diletakkan (Midtrans/Stripe)
      // Untuk sekarang, kita anggap langsung sukses (mock)

      const { error } = await supabase.from('event_registrations').insert([
        {
          event_id: event.id,
          user_id: user.id,
          payment_status: event.price > 0 ? 'paid' : 'free',
        }
      ]);

      if (error) {
        if (error.code === '23505') { // Unique violation
          Alert.alert("Sudah Terdaftar", "Anda sudah terdaftar di event ini!");
          setHasRegistered(true);
        } else {
          throw error;
        }
      } else {
        Alert.alert("Berhasil!", "Anda telah terdaftar di event ini.");
        setHasRegistered(true);
      }
    } catch (error: any) {
      Alert.alert("Gagal Mendaftar", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Image source={{ uri: event.image_url || 'https://via.placeholder.com/400x200?text=Event' }} style={styles.headerImage} />
      
      <View style={styles.content}>
        <Text style={styles.title}>{event.title}</Text>
        <Text style={styles.date}>
          <Ionicons name="calendar" size={16} color="#FC4C02" /> {new Date(event.date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </Text>
        
        <View style={styles.priceContainer}>
          <Text style={styles.priceLabel}>Biaya Pendaftaran:</Text>
          <Text style={styles.priceValue}>
            {event.price === 0 ? 'GRATIS' : `Rp ${event.price.toLocaleString('id-ID')}`}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Tentang Event Ini</Text>
        <Text style={styles.description}>{event.description}</Text>
      </View>

      <View style={styles.footer}>
        {checkingRegistration ? (
          <ActivityIndicator color="#FC4C02" />
        ) : hasRegistered ? (
          <View style={styles.registeredBadge}>
            <Ionicons name="checkmark-circle" size={24} color="white" />
            <Text style={styles.registeredText}>Tiket Anda Telah Aktif</Text>
          </View>
        ) : (
          <TouchableOpacity style={styles.payButton} onPress={handleRegister} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : (
              <>
                <Ionicons name="card-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.payButtonText}>
                  {event.price > 0 ? 'Bayar & Daftar Sekarang' : 'Daftar Gratis'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  headerImage: {
    width: '100%',
    height: 250,
    backgroundColor: '#111111',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#ffffff',
  },
  date: {
    fontSize: 16,
    color: '#D7FF00',
    fontWeight: 'bold',
    marginBottom: 20,
  },
  priceContainer: {
    backgroundColor: '#111111',
    padding: 15,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#333333',
  },
  priceLabel: {
    fontSize: 16,
    color: '#999999',
  },
  priceValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    marginTop: 10,
    color: '#ffffff',
  },
  description: {
    fontSize: 16,
    color: '#aaaaaa',
    lineHeight: 24,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderColor: '#222222',
    backgroundColor: '#111111',
  },
  payButton: {
    backgroundColor: '#D7FF00',
    flexDirection: 'row',
    paddingVertical: 15,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#D7FF00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  payButtonText: {
    color: '#000000',
    fontWeight: 'bold',
    fontSize: 18,
  },
  registeredBadge: {
    backgroundColor: '#333333',
    flexDirection: 'row',
    paddingVertical: 15,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D7FF00',
  },
  registeredText: {
    color: '#D7FF00',
    fontWeight: 'bold',
    fontSize: 18,
    marginLeft: 8,
  }
});
