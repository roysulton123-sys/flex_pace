import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  Alert, 
  ActivityIndicator, 
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { Ionicons } from '@expo/vector-icons';

export default function EditProfileScreen() {
  const navigation = useNavigation();
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('name, bio, avatar_url')
        .eq('id', user.id)
        .maybeSingle();

      if (data) {
        setName(data.name || '');
        setBio(data.bio || '');
        setAvatarUrl(data.avatar_url || '');
      } else {
        // Fallback ke auth metadata jika belum ada di database
        const defaultName = user.user_metadata?.name || user.email?.split('@')[0] || '';
        setName(defaultName);
      }
    } catch (err) {
      console.log('Error fetching profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0].base64) {
        uploadImage(result.assets[0].base64);
      }
    } catch (error) {
      Alert.alert('Gagal Membuka Galeri', 'Pastikan izin akses foto sudah diberikan.');
    }
  };

  const uploadImage = async (base64File: string) => {
    setUploadingImage(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sesi pengguna tidak ditemukan.");

      const filePath = `avatars/${user.id}-${Date.now()}.jpg`;

      const { error } = await supabase.storage
        .from('media')
        .upload(filePath, decode(base64File), {
          contentType: 'image/jpeg',
          upsert: true
        });

      if (error) throw error;

      const { data: publicUrlData } = supabase.storage
        .from('media')
        .getPublicUrl(filePath);

      const freshUrl = publicUrlData.publicUrl;
      setAvatarUrl(freshUrl);
      Alert.alert('Foto Terunggah', 'Ketuk "Simpan Perubahan" untuk menerapkan foto baru.');
    } catch (error: any) {
      Alert.alert('Gagal Mengunggah Foto', error.message);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Perhatian', 'Nama tidak boleh dikosongkan.');
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sesi login berakhir. Silakan login ulang.");

      // 1. Simpan/Upsert ke tabel public.profiles
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({ 
          id: user.id, 
          name: name.trim(), 
          bio: bio.trim(), 
          avatar_url: avatarUrl 
        }, { onConflict: 'id' });

      if (profileError) throw profileError;

      // 2. Sinkronkan juga ke auth user metadata agar konsisten
      await supabase.auth.updateUser({
        data: {
          name: name.trim(),
          avatar_url: avatarUrl,
          bio: bio.trim()
        }
      });

      Alert.alert('Berhasil Disimpan', 'Profil Anda telah berhasil diperbarui!');
      navigation.goBack();
    } catch (err: any) {
      console.error('Error saving profile:', err);
      Alert.alert('Gagal Menyimpan', err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#D7FF00" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* HERO AVATAR SECTION */}
        <View style={styles.avatarSection}>
          <TouchableOpacity 
            style={styles.avatarWrapper} 
            onPress={pickImage} 
            disabled={uploadingImage}
            activeOpacity={0.8}
          >
            <Image 
              source={{ uri: avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80' }} 
              style={styles.avatarImage} 
            />
            <View style={styles.cameraBadge}>
              {uploadingImage ? (
                <ActivityIndicator size="small" color="#000000" />
              ) : (
                <Ionicons name="camera" size={18} color="#000000" />
              )}
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={pickImage} disabled={uploadingImage} style={styles.textChangeBtn}>
            <Text style={styles.changeText}>
              {uploadingImage ? 'Mengunggah foto...' : 'Ubah Foto Profil'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* INPUT GROUP CARD */}
        <View style={styles.formCard}>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>NAMA LENGKAP</Text>
            <TextInput 
              style={styles.textInput} 
              value={name} 
              onChangeText={setName} 
              placeholder="Masukkan nama lengkap" 
              placeholderTextColor="#555555" 
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.fieldGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.fieldLabel}>BIO / MOTTO</Text>
              <Text style={styles.charCount}>{bio.length}/150</Text>
            </View>
            <TextInput 
              style={[styles.textInput, styles.bioInput]} 
              value={bio} 
              onChangeText={setBio} 
              maxLength={150}
              multiline 
              placeholder="Ceritakan target lari atau motto olahragamu..." 
              placeholderTextColor="#555555" 
            />
          </View>
        </View>

        <Text style={styles.helperNotice}>
          Informasi ini akan ditampilkan pada profil publik dan feed sosial Flex Pace Anda.
        </Text>

        {/* SUBMIT BUTTON */}
        <TouchableOpacity 
          style={[styles.saveButton, (saving || uploadingImage) && styles.saveButtonDisabled]} 
          onPress={handleSave} 
          disabled={saving || uploadingImage}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color="#000000" />
          ) : (
            <View style={styles.btnContent}>
              <Ionicons name="checkmark-sharp" size={20} color="#000000" style={{ marginRight: 6 }} />
              <Text style={styles.saveButtonText}>Simpan Perubahan</Text>
            </View>
          )}
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
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
    backgroundColor: '#0A0A0C',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  avatarSection: {
    alignItems: 'center',
    marginVertical: 24,
  },
  avatarWrapper: {
    position: 'relative',
    shadowColor: '#D7FF00',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  avatarImage: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#1E1E24',
    borderWidth: 3,
    borderColor: '#D7FF00',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: '#D7FF00',
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#0A0A0C',
  },
  textChangeBtn: {
    marginTop: 12,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  changeText: {
    color: '#D7FF00',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  formCard: {
    backgroundColor: '#141418',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 16,
  },
  fieldGroup: {
    paddingVertical: 12,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fieldLabel: {
    color: '#8E8E93',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  charCount: {
    color: '#555555',
    fontSize: 11,
  },
  textInput: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
    paddingVertical: 4,
  },
  bioInput: {
    minHeight: 70,
    textAlignVertical: 'top',
    lineHeight: 22,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  helperNotice: {
    color: '#71717A',
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 8,
    marginBottom: 28,
  },
  saveButton: {
    backgroundColor: '#D7FF00',
    paddingVertical: 16,
    borderRadius: 24,
    alignItems: 'center',
    shadowColor: '#D7FF00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
