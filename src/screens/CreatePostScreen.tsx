import React, { useState } from 'react';
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
  Modal,
  Platform
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { Ionicons } from '@expo/vector-icons';

export default function CreatePostScreen() {
  const navigation = useNavigation<any>();
  const [caption, setCaption] = useState('');
  const [localUri, setLocalUri] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [sourceModalVisible, setSourceModalVisible] = useState(false);

  // Helper untuk membaca file lokal menjadi base64 jika asset.base64 tidak tersedia
  const getBase64FromUri = async (uri: string): Promise<string> => {
    try {
      const FileSystem = require('expo-file-system/legacy');
      if (FileSystem && FileSystem.readAsStringAsync) {
        return await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
      }
    } catch (e) {
      console.log('FileSystem fallback, mencoba fetch blob:', e);
    }

    // Fallback kedua menggunakan fetch blob
    const response = await fetch(uri);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const base64Data = result.includes(',') ? result.split(',')[1] : result;
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // Pilih dari Galeri
  const handlePickFromGallery = async () => {
    setSourceModalVisible(false);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Izin Galeri Diperlukan',
          'Mohon izinkan akses galeri pada pengaturan perangkat Anda untuk dapat memilih foto.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 5],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        processSelectedAsset(result.assets[0]);
      }
    } catch (error: any) {
      Alert.alert('Gagal Membuka Galeri', error.message || 'Terjadi kesalahan saat membuka galeri.');
    }
  };

  // Ambil Foto dengan Kamera
  const handleTakePhotoWithCamera = async () => {
    setSourceModalVisible(false);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Izin Kamera Diperlukan',
          'Mohon izinkan akses kamera pada pengaturan perangkat Anda untuk mengambil foto langsung.'
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 5],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        processSelectedAsset(result.assets[0]);
      }
    } catch (error: any) {
      Alert.alert('Gagal Membuka Kamera', error.message || 'Terjadi kesalahan saat membuka kamera.');
    }
  };

  // Proses gambar yang dipilih & unggah ke Supabase Storage
  const processSelectedAsset = async (asset: ImagePicker.ImagePickerAsset) => {
    setLocalUri(asset.uri);
    setUploadError(null);
    setUploadingImage(true);

    try {
      let base64 = asset.base64;
      if (!base64) {
        base64 = await getBase64FromUri(asset.uri);
      }

      if (!base64) {
        throw new Error('Tidak dapat membaca data foto.');
      }

      await uploadImageToStorage(base64);
    } catch (err: any) {
      console.error('Error processing asset:', err);
      setUploadError(err.message || 'Gagal memproses foto.');
      setUploadingImage(false);
      Alert.alert('Gagal Mengunggah', 'Gagal memproses atau mengunggah foto. Silakan coba pilih foto kembali.');
    }
  };

  const uploadImageToStorage = async (base64File: string) => {
    setUploadingImage(true);
    setUploadError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sesi login tidak ditemukan. Silakan masuk kembali.');

      const fileName = `posts/${user.id}-${Date.now()}.jpg`;

      const { error: uploadErr } = await supabase.storage
        .from('media')
        .upload(fileName, decode(base64File), {
          contentType: 'image/jpeg',
          upsert: true
        });

      if (uploadErr) throw uploadErr;

      const { data: publicUrlData } = supabase.storage
        .from('media')
        .getPublicUrl(fileName);

      if (!publicUrlData || !publicUrlData.publicUrl) {
        throw new Error('Gagal mendapatkan URL publik foto.');
      }

      setImageUrl(publicUrlData.publicUrl);
    } catch (error: any) {
      setUploadError(error.message || 'Gagal mengunggah foto.');
      throw error;
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemovePhoto = () => {
    setLocalUri('');
    setImageUrl('');
    setUploadError(null);
  };

  const handlePost = async () => {
    if (uploadingImage) {
      Alert.alert('Mohon Tunggu', 'Foto masih dalam proses pengunggahan...');
      return;
    }

    if (!caption.trim() && !imageUrl && !localUri) {
      Alert.alert('Postingan Kosong', 'Silakan pilih foto atau ketik caption untuk postingan Anda.');
      return;
    }

    if (localUri && !imageUrl) {
      Alert.alert(
        'Foto Belum Terunggah',
        'Foto belum selesai diunggah atau gagal terunggah ke cloud. Silakan ketuk tombol coba lagi pada foto.',
        [
          { text: 'Batal', style: 'cancel' },
          { 
            text: 'Unggah Ulang', 
            onPress: async () => {
              if (localUri) {
                try {
                  const b64 = await getBase64FromUri(localUri);
                  await uploadImageToStorage(b64);
                } catch (e) {
                  Alert.alert('Gagal', 'Tidak dapat mengunggah ulang foto.');
                }
              }
            } 
          }
        ]
      );
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Anda harus login terlebih dahulu.');

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
          caption: caption.trim(),
          image_url: imageUrl,
        }
      ]);

      if (error) throw error;

      Alert.alert('Sukses!', 'Postingan berhasil dibagikan ke feed!');
      navigation.goBack();
    } catch (error: any) {
      Alert.alert('Gagal Membagikan', error.message || 'Terjadi kesalahan saat membagikan postingan.');
    } finally {
      setLoading(false);
    }
  };

  const previewSource = localUri || imageUrl;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
      {/* HEADER SCREEN */}
      <View style={styles.topBar}>
        <TouchableOpacity 
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Buat Postingan Baru</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* PHOTO PREVIEW / SELECTOR CARD */}
      <View style={styles.mediaContainer}>
        {previewSource ? (
          <View style={styles.previewWrapper}>
            <Image source={{ uri: previewSource }} style={styles.previewImage} resizeMode="cover" />

            {/* STATUS BADGE DI ATAS FOTO */}
            {uploadingImage ? (
              <View style={styles.uploadingOverlay}>
                <ActivityIndicator color="#D7FF00" size="large" />
                <Text style={styles.uploadingText}>Mengunggah foto ke cloud...</Text>
              </View>
            ) : uploadError ? (
              <View style={styles.errorOverlay}>
                <Ionicons name="alert-circle" size={28} color="#FF453A" />
                <Text style={styles.errorText}>Gagal Mengunggah Foto</Text>
                <TouchableOpacity 
                  style={styles.retryBtn}
                  onPress={async () => {
                    try {
                      const b64 = await getBase64FromUri(localUri);
                      await uploadImageToStorage(b64);
                    } catch (e: any) {
                      Alert.alert('Gagal', e.message);
                    }
                  }}
                >
                  <Ionicons name="refresh" size={14} color="#000000" style={{ marginRight: 4 }} />
                  <Text style={styles.retryBtnText}>Coba Lagi</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.successBadge}>
                <Ionicons name="checkmark-circle" size={14} color="#30D158" style={{ marginRight: 4 }} />
                <Text style={styles.successBadgeText}>Foto Siap</Text>
              </View>
            )}

            {/* TOMBOL AKSI GANTI & HAPUS */}
            <View style={styles.previewActionsBar}>
              <TouchableOpacity 
                style={styles.changePhotoBtn} 
                onPress={() => setSourceModalVisible(true)}
                disabled={uploadingImage}
                activeOpacity={0.8}
              >
                <Ionicons name="camera-reverse" size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.changePhotoText}>Ganti Foto</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.deletePhotoBtn} 
                onPress={handleRemovePhoto}
                disabled={uploadingImage}
                activeOpacity={0.8}
              >
                <Ionicons name="trash-outline" size={15} color="#FF453A" />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity 
            style={styles.imagePlaceholder} 
            onPress={() => setSourceModalVisible(true)}
            activeOpacity={0.85}
          >
            <View style={styles.placeholderIconCircle}>
              <Ionicons name="camera" size={32} color="#D7FF00" />
            </View>
            <Text style={styles.placeholderTitle}>Pilih Foto Postingan</Text>
            <Text style={styles.placeholderSubtitle}>
              Ambil foto langsung dengan kamera atau pilih dari galeri
            </Text>
            <View style={styles.selectPillBtn}>
              <Ionicons name="add" size={16} color="#000000" style={{ marginRight: 4 }} />
              <Text style={styles.selectPillText}>Tambah Foto</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* FORM INPUT CAPTION */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>CAPTION & CERITA</Text>
        <TextInput 
          style={[styles.input, styles.textArea]} 
          value={caption} 
          onChangeText={setCaption} 
          multiline 
          placeholder="Ceritakan momen olahraga, pace, atau rute larimu hari ini..." 
          placeholderTextColor="#71717A" 
        />
      </View>

      {/* SUBMIT BUTTON */}
      <TouchableOpacity 
        style={[styles.submitButton, (loading || uploadingImage) && styles.submitButtonDisabled]} 
        onPress={handlePost} 
        disabled={loading || uploadingImage}
        activeOpacity={0.85}
      >
        {loading ? (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <ActivityIndicator color="#000000" size="small" style={{ marginRight: 8 }} />
            <Text style={styles.submitButtonText}>Menerbitkan...</Text>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="paper-plane" size={18} color="#000000" style={{ marginRight: 8 }} />
            <Text style={styles.submitButtonText}>Bagikan ke Feed</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* MODAL PILIH SUMBER FOTO */}
      <Modal
        visible={sourceModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSourceModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setSourceModalVisible(false)}
        >
          <View style={styles.modalSheetCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>PILIH SUMBER FOTO</Text>
              <TouchableOpacity onPress={() => setSourceModalVisible(false)}>
                <Ionicons name="close" size={20} color="#A1A1AA" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={styles.sourceOptionBtn}
              onPress={handleTakePhotoWithCamera}
              activeOpacity={0.8}
            >
              <View style={[styles.sourceIconBox, { backgroundColor: 'rgba(215, 255, 0, 0.15)' }]}>
                <Ionicons name="camera" size={22} color="#D7FF00" />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={styles.sourceOptionTitle}>Ambil Foto dengan Kamera</Text>
                <Text style={styles.sourceOptionSub}>Potret momen larimu saat ini</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#71717A" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.sourceOptionBtn}
              onPress={handlePickFromGallery}
              activeOpacity={0.8}
            >
              <View style={[styles.sourceIconBox, { backgroundColor: 'rgba(96, 165, 250, 0.15)' }]}>
                <Ionicons name="images" size={22} color="#60A5FA" />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={styles.sourceOptionTitle}>Pilih dari Galeri Foto</Text>
                <Text style={styles.sourceOptionSub}>Pilih foto yang tersimpan di perangkat</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#71717A" />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0C',
  },
  scrollContent: {
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 35,
    paddingBottom: 40,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#16161E',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  mediaContainer: {
    marginBottom: 20,
  },
  previewWrapper: {
    width: '100%',
    height: 320,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#121217',
    borderWidth: 1,
    borderColor: 'rgba(215, 255, 0, 0.25)',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadingText: {
    color: '#D7FF00',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 10,
  },
  errorOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#FF453A',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 6,
    marginBottom: 10,
    textAlign: 'center',
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D7FF00',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  retryBtnText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '800',
  },
  successBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(48, 209, 88, 0.4)',
  },
  successBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  previewActionsBar: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  changePhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(24, 24, 32, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  changePhotoText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  deletePhotoBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(24, 24, 32, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 69, 58, 0.3)',
  },
  imagePlaceholder: {
    width: '100%',
    height: 260,
    borderRadius: 18,
    backgroundColor: '#121218',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(215, 255, 0, 0.3)',
    borderStyle: 'dashed',
    padding: 20,
  },
  placeholderIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#1C1C26',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(215, 255, 0, 0.2)',
  },
  placeholderTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  placeholderSubtitle: {
    color: '#71717A',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 16,
  },
  selectPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D7FF00',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 12,
  },
  selectPillText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '800',
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: '#D7FF00',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#14141B',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#FFFFFF',
  },
  textArea: {
    height: 110,
    textAlignVertical: 'top',
    lineHeight: 20,
  },
  submitButton: {
    backgroundColor: '#D7FF00',
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    shadowColor: '#D7FF00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#000000',
    fontWeight: '900',
    fontSize: 15,
    letterSpacing: 0.5,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalSheetCard: {
    backgroundColor: '#16161E',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 25,
    borderTopWidth: 1,
    borderTopColor: 'rgba(215, 255, 0, 0.25)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  sourceOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C26',
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  sourceIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sourceOptionTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  sourceOptionSub: {
    color: '#71717A',
    fontSize: 11,
    marginTop: 2,
  },
});
