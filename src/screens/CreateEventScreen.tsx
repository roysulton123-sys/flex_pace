import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  Alert, 
  ScrollView, 
  ActivityIndicator,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useNavigation } from '@react-navigation/native';

interface PresetCategory {
  id: string;
  name: string;
  defaultTitle: string;
  defaultImage: string;
}

const EVENT_PRESETS: PresetCategory[] = [
  {
    id: 'fun_run_5k',
    name: '🏃 Fun Run 5K',
    defaultTitle: 'Morning Fun Run 5K Komunitas',
    defaultImage: 'https://images.unsplash.com/photo-1552674605-15c2198ea1b2?w=800&q=80',
  },
  {
    id: 'fun_run_10k',
    name: '🏃‍♂️ Fun Run 10K',
    defaultTitle: 'City Pace 10K Challenge',
    defaultImage: 'https://images.unsplash.com/photo-1452626038306-9aae5e071dd3?w=800&q=80',
  },
  {
    id: 'gowes',
    name: '🚴 Gowes Santai',
    defaultTitle: 'Gowes Bareng Keliling Kota',
    defaultImage: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=800&q=80',
  },
  {
    id: 'trail',
    name: '🌲 Trail Run',
    defaultTitle: 'Mountain Trail Run Adventure',
    defaultImage: 'https://images.unsplash.com/photo-1486218119243-13883505764c?w=800&q=80',
  },
  {
    id: 'marathon',
    name: '🏅 Half Marathon',
    defaultTitle: 'Half Marathon Endurance 21K',
    defaultImage: 'https://images.unsplash.com/photo-1513593771513-7b58b6c4af38?w=800&q=80',
  }
];

export default function CreateEventScreen() {
  const navigation = useNavigation();
  const [selectedCategory, setSelectedCategory] = useState<PresetCategory>(EVENT_PRESETS[0]);
  const [title, setTitle] = useState(EVENT_PRESETS[0].defaultTitle);
  const [location, setLocation] = useState('Gelora Bung Karno (GBK), Jakarta');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState(EVENT_PRESETS[0].defaultImage);
  const [isFree, setIsFree] = useState(true);
  const [price, setPrice] = useState('0');
  
  // Format tanggal default: 7 hari dari sekarang (YYYY-MM-DD)
  const defaultFutureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const [date, setDate] = useState(defaultFutureDate);
  const [loading, setLoading] = useState(false);

  const handleSelectPreset = (preset: PresetCategory) => {
    setSelectedCategory(preset);
    if (!title || EVENT_PRESETS.some(p => p.defaultTitle === title)) {
      setTitle(preset.defaultTitle);
    }
    setImageUrl(preset.defaultImage);
  };

  const handleCreate = async () => {
    if (!title.trim() || !date.trim()) {
      Alert.alert('Perhatian', 'Mohon lengkapi Nama Event dan Tanggal pelaksanaan.');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Anda harus login untuk membuat event.");

      // Pastikan profil user terdaftar
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('id', user.id)
        .maybeSingle();

      if (!existingProfile) {
        await supabase.from('profiles').insert({
          id: user.id,
          name: user.email ? user.email.split('@')[0] : 'Event Organizer',
          avatar_url: 'https://via.placeholder.com/150',
          role: 'organizer',
          is_premium: false,
        });
      } else if (existingProfile.role !== 'organizer') {
        // Upgrade role ke organizer secara otomatis saat membuat event
        await supabase
          .from('profiles')
          .update({ role: 'organizer' })
          .eq('id', user.id);
      }

      const fullDescription = location 
        ? `📍 Lokasi: ${location}\n\n${description || 'Ayo ikuti event olahraga komunitas Flex Pace ini dan pacu kecepatan terbaikmu bersama atlet lainnya!'}`
        : (description || 'Event olahraga komunitas Flex Pace.');

      const { error } = await supabase.from('events').insert([
        {
          organizer_id: user.id,
          title: title.trim(),
          description: fullDescription,
          image_url: imageUrl || selectedCategory.defaultImage,
          price: isFree ? 0 : (parseInt(price.replace(/[^0-9]/g, '')) || 0),
          date: new Date(date).toISOString(),
        }
      ]);

      if (error) throw error;

      Alert.alert('Sukses!', '🎉 Event komunitas Anda berhasil dipublikasikan untuk seluruh atlet Flex Pace!');
      navigation.goBack();
    } catch (error: any) {
      Alert.alert('Gagal Membuat Event', error.message || 'Terjadi kesalahan sistem.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.header}>Buat Event Komunitas</Text>
      <Text style={styles.subHeader}>
        Publikasikan Fun Run, Gowes Bareng, atau Race terbuka untuk semua atlet di aplikasi.
      </Text>

      {/* Preset Kategori Olahraga */}
      <View style={styles.section}>
        <Text style={styles.label}>PILIH JENIS EVENT</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetScroll}>
          {EVENT_PRESETS.map((preset) => {
            const isSelected = selectedCategory.id === preset.id;
            return (
              <TouchableOpacity
                key={preset.id}
                style={[styles.presetCard, isSelected && styles.presetCardActive]}
                onPress={() => handleSelectPreset(preset)}
                activeOpacity={0.8}
              >
                <Text style={[styles.presetText, isSelected && styles.presetTextActive]}>
                  {preset.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Banner Preview */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>BANNER PROMOSI EVENT</Text>
        <View style={styles.bannerPreviewContainer}>
          <Image 
            source={{ uri: imageUrl || selectedCategory.defaultImage }} 
            style={styles.bannerPreview} 
            resizeMode="cover"
          />
          <View style={styles.bannerOverlay}>
            <Ionicons name="sparkles" size={14} color="#D7FF00" style={{ marginRight: 6 }} />
            <Text style={styles.bannerOverlayText}>Banner Otomatis Siap Pakai</Text>
          </View>
        </View>
        <TextInput 
          style={[styles.input, { marginTop: 8, fontSize: 13 }]} 
          placeholder="Atau tempel URL gambar custom (opsional)..." 
          placeholderTextColor="#666"
          value={imageUrl} 
          onChangeText={setImageUrl} 
        />
      </View>

      {/* Nama Event */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>NAMA EVENT</Text>
        <TextInput 
          style={styles.input} 
          placeholder="Contoh: Jakarta Fun Run 5K Santai" 
          placeholderTextColor="#666"
          value={title} 
          onChangeText={setTitle} 
        />
      </View>

      {/* Lokasi / Titik Kumpul */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>LOKASI / TITIK KUMPUL (VENUE)</Text>
        <View style={styles.inputWithIcon}>
          <Ionicons name="location" size={18} color="#D7FF00" style={{ marginRight: 8 }} />
          <TextInput 
            style={styles.inlineInput} 
            placeholder="Contoh: Plaza Tenggara GBK Senayan, Jakarta" 
            placeholderTextColor="#666"
            value={location} 
            onChangeText={setLocation} 
          />
        </View>
      </View>

      {/* Tanggal Event */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>TANGGAL PELAKSANAAN (YYYY-MM-DD)</Text>
        <View style={styles.inputWithIcon}>
          <Ionicons name="calendar" size={18} color="#D7FF00" style={{ marginRight: 8 }} />
          <TextInput 
            style={styles.inlineInput} 
            placeholder="2024-12-31" 
            placeholderTextColor="#666"
            value={date} 
            onChangeText={setDate} 
          />
        </View>
      </View>

      {/* Pengaturan Tiket (Gratis vs Berbayar) */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>BIAYA PENDAFTARAN / TIKET</Text>
        <View style={styles.priceToggleRow}>
          <TouchableOpacity 
            style={[styles.priceToggleBtn, isFree && styles.priceToggleBtnActive]}
            onPress={() => { setIsFree(true); setPrice('0'); }}
            activeOpacity={0.8}
          >
            <Ionicons name="gift-outline" size={16} color={isFree ? '#000000' : '#A1A1AA'} style={{ marginRight: 6 }} />
            <Text style={[styles.priceToggleText, isFree && styles.priceToggleTextActive]}>
              GRATIS (Tanpa Biaya)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.priceToggleBtn, !isFree && styles.priceToggleBtnActive]}
            onPress={() => { setIsFree(false); if (price === '0') setPrice('50000'); }}
            activeOpacity={0.8}
          >
            <Ionicons name="ticket-outline" size={16} color={!isFree ? '#000000' : '#A1A1AA'} style={{ marginRight: 6 }} />
            <Text style={[styles.priceToggleText, !isFree && styles.priceToggleTextActive]}>
              Berbayar (Tiket/BIB)
            </Text>
          </TouchableOpacity>
        </View>

        {!isFree && (
          <View style={[styles.inputWithIcon, { marginTop: 10 }]}>
            <Text style={styles.currencyPrefix}>Rp</Text>
            <TextInput 
              style={styles.inlineInput} 
              placeholder="Contoh: 50000" 
              placeholderTextColor="#666"
              keyboardType="numeric"
              value={price} 
              onChangeText={setPrice} 
            />
          </View>
        )}
      </View>

      {/* Deskripsi Lengkap */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>DESKRIPSI & INFORMASI TAMBAHAN</Text>
        <TextInput 
          style={[styles.input, styles.textArea]} 
          placeholder="Tuliskan jadwal start, dresscode, fasilitas refreshment, atau info penting lainnya..." 
          placeholderTextColor="#666"
          multiline 
          numberOfLines={4}
          value={description} 
          onChangeText={setDescription} 
        />
      </View>

      {/* Tombol Publikasikan */}
      <TouchableOpacity 
        style={styles.submitButton} 
        onPress={handleCreate} 
        disabled={loading}
        activeOpacity={0.85}
      >
        {loading ? (
          <ActivityIndicator color="#000000" size="small" />
        ) : (
          <>
            <Ionicons name="rocket" size={20} color="#000000" style={{ marginRight: 8 }} />
            <Text style={styles.submitButtonText}>Publikasikan Event Komunitas</Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0C',
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 60,
  },
  header: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  subHeader: {
    fontSize: 13,
    color: '#A1A1AA',
    marginTop: 4,
    marginBottom: 20,
    lineHeight: 18,
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: '#D7FF00',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  presetScroll: {
    flexDirection: 'row',
  },
  presetCard: {
    backgroundColor: '#141419',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginRight: 10,
  },
  presetCardActive: {
    backgroundColor: '#D7FF00',
    borderColor: '#D7FF00',
  },
  presetText: {
    color: '#D4D4D8',
    fontSize: 13,
    fontWeight: '700',
  },
  presetTextActive: {
    color: '#000000',
    fontWeight: '900',
  },
  bannerPreviewContainer: {
    height: 140,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#18181D',
  },
  bannerPreview: {
    width: '100%',
    height: '100%',
  },
  bannerOverlay: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  bannerOverlayText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  formGroup: {
    marginBottom: 18,
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    padding: 13,
    fontSize: 14,
    backgroundColor: '#131317',
    color: '#FFFFFF',
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#131317',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 4,
  },
  inlineInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    paddingVertical: 9,
  },
  currencyPrefix: {
    color: '#D7FF00',
    fontWeight: '800',
    fontSize: 15,
    marginRight: 8,
  },
  priceToggleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  priceToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#141419',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  priceToggleBtnActive: {
    backgroundColor: '#D7FF00',
    borderColor: '#D7FF00',
  },
  priceToggleText: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '700',
  },
  priceToggleTextActive: {
    color: '#000000',
    fontWeight: '900',
  },
  textArea: {
    height: 90,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: '#D7FF00',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 16,
    marginTop: 10,
    marginBottom: 40,
    shadowColor: '#D7FF00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  submitButtonText: {
    color: '#000000',
    fontWeight: '900',
    fontSize: 15,
    letterSpacing: 0.3,
  }
});
