import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { supabase } from '../lib/supabase';
import { useNavigation } from '@react-navigation/native';

export default function CreateEventScreen() {
  const navigation = useNavigation();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [price, setPrice] = useState('');
  const [date, setDate] = useState(''); // Simple string for now (YYYY-MM-DD)
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!title || !description || !date) {
      Alert.alert('Error', 'Mohon isi Judul, Deskripsi, dan Tanggal event!');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Anda harus login.");

      const { error } = await supabase.from('events').insert([
        {
          organizer_id: user.id,
          title,
          description,
          image_url: imageUrl || 'https://images.unsplash.com/photo-1552674605-15c2198ea1b2?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', // Default image
          price: parseInt(price) || 0,
          date: new Date(date).toISOString(),
        }
      ]);

      if (error) throw error;

      Alert.alert('Sukses!', 'Event berhasil dipublikasikan!');
      navigation.goBack();
    } catch (error: any) {
      Alert.alert('Gagal Membuat Event', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>Buat Event Baru</Text>
      
      <View style={styles.formGroup}>
        <Text style={styles.label}>Nama Event</Text>
        <TextInput style={styles.input} placeholder="Misal: Jakarta Fun Run 5K" value={title} onChangeText={setTitle} />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Tanggal (YYYY-MM-DD)</Text>
        <TextInput style={styles.input} placeholder="2024-12-01" value={date} onChangeText={setDate} />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Harga Tiket (Rp)</Text>
        <TextInput style={styles.input} placeholder="0 untuk Gratis" keyboardType="numeric" value={price} onChangeText={setPrice} />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>URL Gambar Promosi (Opsional)</Text>
        <TextInput style={styles.input} placeholder="https://..." value={imageUrl} onChangeText={setImageUrl} />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Deskripsi Lengkap</Text>
        <TextInput 
          style={[styles.input, styles.textArea]} 
          placeholder="Jelaskan detail event ini..." 
          multiline 
          numberOfLines={4}
          value={description} 
          onChangeText={setDescription} 
        />
      </View>

      <TouchableOpacity style={styles.submitButton} onPress={handleCreate} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Publikasikan Event</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    padding: 20,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#ffffff',
  },
  formGroup: {
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#999999',
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#111111',
    color: '#ffffff',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: '#D7FF00',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 40,
  },
  submitButtonText: {
    color: '#000000',
    fontWeight: 'bold',
    fontSize: 18,
  }
});
