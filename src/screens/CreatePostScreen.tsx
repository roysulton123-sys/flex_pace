import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator, Image } from 'react-native';
import { supabase } from '../lib/supabase';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { Ionicons } from '@expo/vector-icons';

export default function CreatePostScreen() {
  const navigation = useNavigation();
  const [caption, setCaption] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 5],
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0].base64) {
        uploadImage(result.assets[0].base64);
      }
    } catch (error) {
      Alert.alert('Error', 'Gagal membuka galeri');
    }
  };

  const uploadImage = async (base64File: string) => {
    setUploadingImage(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Tidak ada sesi user.");

      const filePath = `posts/${user.id}-${Date.now()}.jpg`;

      const { data, error } = await supabase.storage
        .from('media')
        .upload(filePath, decode(base64File), {
          contentType: 'image/jpeg',
          upsert: true
        });

      if (error) throw error;

      const { data: publicUrlData } = supabase.storage
        .from('media')
        .getPublicUrl(filePath);

      setImageUrl(publicUrlData.publicUrl);
    } catch (error: any) {
      Alert.alert('Gagal Mengunggah', error.message);
    } finally {
      setUploadingImage(false);
    }
  };

  const handlePost = async () => {
    if (!caption && !imageUrl) {
      Alert.alert('Error', 'Postingan tidak boleh kosong!');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Anda harus login.");

      // Pastikan data profile tersedia untuk foreign key constraint
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

      if (!existingProfile) {
        await supabase.from('profiles').insert({
          id: user.id,
          name: user.email ? user.email.split('@')[0] : 'Flex Athlete',
          avatar_url: 'https://via.placeholder.com/150',
          role: 'user',
          is_premium: false,
        });
      }

      const { error } = await supabase.from('posts').insert([
        {
          user_id: user.id,
          caption,
          image_url: imageUrl,
        }
      ]);

      if (error) throw error;

      Alert.alert('Sukses!', 'Postingan berhasil dibagikan!');
      navigation.goBack();
    } catch (error: any) {
      Alert.alert('Gagal Membagikan', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Buat Postingan Baru</Text>

      <TouchableOpacity onPress={pickImage} disabled={uploadingImage}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.previewImage} />
        ) : (
          <View style={styles.imagePlaceholder}>
            {uploadingImage ? (
              <ActivityIndicator color="#D7FF00" size="large" />
            ) : (
              <>
                <Ionicons name="images-outline" size={48} color="#444" />
                <Text style={styles.placeholderText}>Ketuk untuk memilih foto</Text>
              </>
            )}
          </View>
        )}
      </TouchableOpacity>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Caption</Text>
        <TextInput 
          style={[styles.input, styles.textArea]} 
          value={caption} 
          onChangeText={setCaption} 
          multiline 
          placeholder="Ceritakan aktivitasmu hari ini..." 
          placeholderTextColor="#666" 
        />
      </View>

      <TouchableOpacity style={styles.submitButton} onPress={handlePost} disabled={loading || uploadingImage}>
        {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.submitButtonText}>Bagikan</Text>}
      </TouchableOpacity>
    </View>
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
  previewImage: {
    width: '100%',
    height: 300,
    borderRadius: 12,
    marginBottom: 20,
    backgroundColor: '#111111',
  },
  imagePlaceholder: {
    width: '100%',
    height: 300,
    borderRadius: 12,
    marginBottom: 20,
    backgroundColor: '#111111',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333333',
    borderStyle: 'dashed',
  },
  placeholderText: {
    color: '#666',
    marginTop: 10,
    fontWeight: 'bold',
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
  },
  submitButtonText: {
    color: '#000000',
    fontWeight: 'bold',
    fontSize: 18,
  }
});
