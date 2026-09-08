import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  Alert, 
  ScrollView, 
  ActivityIndicator,
  Image,
  Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useNavigation } from '@react-navigation/native';

interface PresetCategory {
  id: string;
  name: string;
  defaultTitle: string;
  defaultCover: string;
  defaultLogo: string;
}

// Kategori rapi & terpadu: Marathon hanya 1 tombol tanpa pembagian jarak membingungkan
const EVENT_PRESETS: PresetCategory[] = [
  {
    id: 'fun_run',
    name: '🏃 Fun Run',
    defaultTitle: 'Morning Fun Run Komunitas Flex Pace',
    defaultCover: 'https://images.unsplash.com/photo-1552674605-15c2198ea1b2?w=800&q=80',
    defaultLogo: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&q=80',
  },
  {
    id: 'gowes',
    name: '🚴 Gowes Santai',
    defaultTitle: 'Gowes Bareng Keliling Kota Santai',
    defaultCover: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=800&q=80',
    defaultLogo: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80',
  },
  {
    id: 'marathon',
    name: '🏅 Marathon',
    defaultTitle: 'Marathon Endurance Challenge',
    defaultCover: 'https://images.unsplash.com/photo-1513593771513-7b58b6c4af38?w=800&q=80',
    defaultLogo: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&q=80',
  },
  {
    id: 'trail',
    name: '🌲 Trail Run',
    defaultTitle: 'Mountain Trail Run Adventure',
    defaultCover: 'https://images.unsplash.com/photo-1486218119243-13883505764c?w=800&q=80',
    defaultLogo: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=200&q=80',
  }
];

export default function CreateEventScreen() {
  const navigation = useNavigation();
  const [selectedCategory, setSelectedCategory] = useState<PresetCategory>(EVENT_PRESETS[0]);
  const [title, setTitle] = useState(EVENT_PRESETS[0].defaultTitle);
  const [location, setLocation] = useState('Gelora Bung Karno (GBK), Jakarta');
  const [description, setDescription] = useState('');
  
  // Foto Sampul & Foto Profil Acara via Galeri Penyimpanan HP
  const [coverUri, setCoverUri] = useState<string>('');
  const [coverBase64, setCoverBase64] = useState<string>('');
  const [logoUri, setLogoUri] = useState<string>('');
  const [logoBase64, setLogoBase64] = useState<string>('');

  const [isFree, setIsFree] = useState(true);
  const [price, setPrice] = useState('0');
  
  const defaultFutureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const [date, setDate] = useState(defaultFutureDate);
  const [loading, setLoading] = useState(false);

  // Status Membership & Anti-Spam
  const [isMember, setIsMember] = useState(false);
  const [membershipModalVisible, setMembershipModalVisible] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('yearly');
  const [paymentMethod, setPaymentMethod] = useState<'qris' | 'va'>('qris');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  useEffect(() => {
    checkMembershipStatus();
  }, []);

  const checkMembershipStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Cek Supabase profiles
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_premium, role')
        .eq('id', user.id)
        .maybeSingle();

      const localMember = await AsyncStorage.getItem('@fp_membership_active');

      if ((profile && profile.is_premium) || localMember === 'true') {
        setIsMember(true);
      } else {
        setIsMember(false);
        // Tampilkan modal paywall membership jika belum berlangganan
        setMembershipModalVisible(true);
      }
    } catch (e) {
      console.log('Error checking membership:', e);
    }
  };

  const handleSelectPreset = (preset: PresetCategory) => {
    setSelectedCategory(preset);
    if (!title || EVENT_PRESETS.some(p => p.defaultTitle === title)) {
      setTitle(preset.defaultTitle);
    }
  };

  // Pilih Foto Sampul dari Galeri (16:9)
  const pickCoverImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        setCoverUri(result.assets[0].uri);
        setCoverBase64(result.assets[0].base64 || '');
      }
    } catch (error) {
      Alert.alert('Error', 'Gagal membuka galeri foto sampul.');
    }
  };

  // Pilih Foto Profil / Logo Acara dari Galeri (1:1)
  const pickLogoImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        setLogoUri(result.assets[0].uri);
        setLogoBase64(result.assets[0].base64 || '');
      }
    } catch (error) {
      Alert.alert('Error', 'Gagal membuka galeri logo acara.');
    }
  };

  // Pembayaran & Aktivasi Membership
  const handlePayMembership = async () => {
    setIsProcessingPayment(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Silakan login terlebih dahulu.");

      // Simulasikan delay verifikasi pembayaran
      await new Promise(res => setTimeout(res, 1500));

      // Update profil di Supabase
      await supabase
        .from('profiles')
        .update({ 
          is_premium: true, 
          role: 'organizer' 
        })
        .eq('id', user.id);

      // Simpan lokal status membership
      await AsyncStorage.setItem('@fp_membership_active', 'true');
      await AsyncStorage.setItem('@fp_membership_plan', selectedPlan);
      await AsyncStorage.setItem('@fp_membership_date', new Date().toISOString());

      setIsMember(true);
      setIsProcessingPayment(false);
      setMembershipModalVisible(false);

      Alert.alert(
        '🎉 Membership Aktif!', 
        `Selamat! Akun Anda kini berstatus Flex Pace PRO Organizer (${selectedPlan === 'yearly' ? 'Paket Tahunan' : 'Paket Bulanan'}). Anda memiliki akses penuh untuk mempublikasikan event komunitas resmi.`
      );
    } catch (err: any) {
      setIsProcessingPayment(false);
      Alert.alert('Gagal Aktivasi', err.message || 'Terjadi kesalahan sistem.');
    }
  };

  const handleCreate = async () => {
    // 1. Cek Gerbang Membership
    if (!isMember) {
      setMembershipModalVisible(true);
      return;
    }

    // 2. Proteksi Anti-Spam: Cek Cooldown (Minimal 10 Menit Antar Event)
    try {
      const lastCreated = await AsyncStorage.getItem('@fp_last_event_created_timestamp');
      if (lastCreated) {
        const timeDiff = Date.now() - parseInt(lastCreated, 10);
        const cooldownMs = 10 * 60 * 1000; // 10 menit
        if (timeDiff < cooldownMs) {
          const sisaMenit = Math.ceil((cooldownMs - timeDiff) / 60000);
          Alert.alert(
            '🛡️ Proteksi Anti-Spam', 
            `Demi menjaga kualitas feed event, Anda baru dapat mempublikasikan event berikutnya dalam ${sisaMenit} menit lagi.`
          );
          return;
        }
      }
    } catch (e) {
      console.log('Error checking spam cooldown', e);
    }

    // 3. Validasi Form
    if (!title.trim() || title.trim().length < 5) {
      Alert.alert('Perhatian', 'Nama event minimal 5 karakter.');
      return;
    }
    if (!date.trim()) {
      Alert.alert('Perhatian', 'Mohon tentukan tanggal pelaksanaan event.');
      return;
    }
    if (description.trim().length < 15) {
      Alert.alert('Perhatian', 'Deskripsi event mohon diisi minimal 15 karakter agar informatif bagi calon peserta.');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Anda harus login untuk membuat event.");

      let finalCoverUrl = selectedCategory.defaultCover;

      // Upload Foto Sampul jika dipilih dari galeri
      if (coverBase64) {
        const coverPath = `events/cover-${user.id}-${Date.now()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('media')
          .upload(coverPath, decode(coverBase64), {
            contentType: 'image/jpeg',
            upsert: true
          });

        if (!uploadError) {
          const { data: publicUrlData } = supabase.storage
            .from('media')
            .getPublicUrl(coverPath);
          if (publicUrlData?.publicUrl) {
            finalCoverUrl = publicUrlData.publicUrl;
          }
        }
      }

      // Upload Logo jika dipilih dari galeri
      let finalLogoUrl = selectedCategory.defaultLogo;
      if (logoBase64) {
        const logoPath = `events/logo-${user.id}-${Date.now()}.jpg`;
        const { error: logoError } = await supabase.storage
          .from('media')
          .upload(logoPath, decode(logoBase64), {
            contentType: 'image/jpeg',
            upsert: true
          });

        if (!logoError) {
          const { data: logoUrlData } = supabase.storage
            .from('media')
            .getPublicUrl(logoPath);
          if (logoUrlData?.publicUrl) {
            finalLogoUrl = logoUrlData.publicUrl;
          }
        }
      }

      const fullDescription = `📍 Lokasi: ${location}\n\n${description.trim()}`;

      const { error } = await supabase.from('events').insert([
        {
          organizer_id: user.id,
          title: title.trim(),
          description: fullDescription,
          image_url: finalCoverUrl,
          price: isFree ? 0 : (parseInt(price.replace(/[^0-9]/g, '')) || 0),
          date: new Date(date).toISOString(),
        }
      ]);

      if (error) throw error;

      // Catat timestamp anti-spam
      await AsyncStorage.setItem('@fp_last_event_created_timestamp', Date.now().toString());

      Alert.alert('Sukses!', '🎉 Event komunitas resmi Anda berhasil dipublikasikan untuk seluruh atlet Flex Pace!');
      navigation.goBack();
    } catch (error: any) {
      Alert.alert('Gagal Membuat Event', error.message || 'Terjadi kesalahan sistem.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Status Bar Member */}
      {isMember ? (
        <View style={styles.proMemberBadge}>
          <Ionicons name="shield-checkmark" size={16} color="#FFD700" style={{ marginRight: 6 }} />
          <Text style={styles.proMemberBadgeText}>👑 AKUN PRO ORGANIZER TERVERIFIKASI</Text>
        </View>
      ) : (
        <TouchableOpacity 
          style={styles.upgradePromptBar}
          onPress={() => setMembershipModalVisible(true)}
          activeOpacity={0.85}
        >
          <Ionicons name="lock-closed" size={15} color="#000000" style={{ marginRight: 6 }} />
          <Text style={styles.upgradePromptText}>MEMBERSHIP DIPERLUKAN UNTUK MEMBUAT EVENT</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.header}>Buat Event Komunitas</Text>
      <Text style={styles.subHeader}>
        Publikasikan Fun Run, Gowes Santai, atau Marathon resmi dengan foto sampul & logo dari galeri perangkat.
      </Text>

      {/* Preset Kategori Olahraga (Marathon 1 Tombol Rapi) */}
      <View style={styles.section}>
        <Text style={styles.label}>PILIH KATEGORI EVENT</Text>
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

      {/* FOTO SAMPUL ACARA DARI GALERI (16:9) */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>FOTO SAMPUL / BANNER ACARA (DARI GALERI)</Text>
        <TouchableOpacity 
          style={styles.coverUploadBox} 
          onPress={pickCoverImage} 
          activeOpacity={0.8}
        >
          <Image 
            source={{ uri: coverUri || selectedCategory.defaultCover }} 
            style={styles.coverImagePreview} 
            resizeMode="cover"
          />
          <View style={styles.coverUploadOverlay}>
            <Ionicons name="camera" size={20} color="#000000" style={{ marginRight: 6 }} />
            <Text style={styles.coverUploadText}>
              {coverUri ? 'Ubah Foto Sampul' : 'Pilih Foto Sampul dari Galeri'}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* FOTO PROFIL / LOGO ACARA DARI GALERI (1:1) */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>FOTO PROFIL / LOGO ACARA (DARI GALERI)</Text>
        <View style={styles.logoRow}>
          <TouchableOpacity 
            style={styles.logoPickerContainer} 
            onPress={pickLogoImage} 
            activeOpacity={0.8}
          >
            <Image 
              source={{ uri: logoUri || selectedCategory.defaultLogo }} 
              style={styles.logoImagePreview} 
            />
            <View style={styles.logoEditBadge}>
              <Ionicons name="camera" size={14} color="#000000" />
            </View>
          </TouchableOpacity>

          <View style={styles.logoInstructions}>
            <Text style={styles.logoTitleText}>Logo Komunitas / Acara</Text>
            <Text style={styles.logoSubText}>
              Ketuk lingkaran untuk mengunggah logo atau foto profil resmi dari galeri HP Anda.
            </Text>
          </View>
        </View>
      </View>

      {/* Nama Event */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>NAMA EVENT</Text>
        <TextInput 
          style={styles.input} 
          placeholder="Contoh: Jakarta Fun Run 2026" 
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
            placeholder="2026-12-31" 
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
        <Text style={styles.label}>DESKRIPSI & INFORMASI LENGKAP</Text>
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

      {/* MODAL SUBSCRIPTION GATEWAY MEMBERSHIP PRO */}
      <Modal
        visible={membershipModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setMembershipModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.membershipCard}>
            {/* Header Membership */}
            <View style={styles.membershipHeader}>
              <View style={styles.crownIconBadge}>
                <Ionicons name="trophy" size={28} color="#000000" />
              </View>
              <Text style={styles.membershipTitle}>FLEX PACE PRO ORGANIZER</Text>
              <Text style={styles.membershipDesc}>
                Fitur pembuatan event terbuka eksklusif untuk Member Berlangganan guna mencegah spam dan menjamin kredibilitas acara.
              </Text>
            </View>

            {/* Pilihan Paket Langganan */}
            <View style={styles.plansContainer}>
              <TouchableOpacity 
                style={[styles.planCard, selectedPlan === 'monthly' && styles.planCardActive]}
                onPress={() => setSelectedPlan('monthly')}
                activeOpacity={0.8}
              >
                <View style={styles.planRadio}>
                  {selectedPlan === 'monthly' && <View style={styles.planRadioInner} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.planTitle}>Paket Bulanan</Text>
                  <Text style={styles.planPrice}>Rp 49.000 <Text style={styles.planPeriod}>/ bulan</Text></Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.planCard, selectedPlan === 'yearly' && styles.planCardActive]}
                onPress={() => setSelectedPlan('yearly')}
                activeOpacity={0.8}
              >
                <View style={styles.saveBadge}>
                  <Text style={styles.saveBadgeText}>HEMAT 40%</Text>
                </View>
                <View style={styles.planRadio}>
                  {selectedPlan === 'yearly' && <View style={styles.planRadioInner} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.planTitle}>Paket Tahunan (Rekomendasi)</Text>
                  <Text style={styles.planPrice}>Rp 399.000 <Text style={styles.planPeriod}>/ tahun</Text></Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Benefit Member */}
            <View style={styles.perksList}>
              <View style={styles.perkItem}>
                <Ionicons name="checkmark-circle" size={16} color="#D7FF00" style={{ marginRight: 6 }} />
                <Text style={styles.perkText}>Publikasi Event Fun Run & Marathon Tak Terbatas</Text>
              </View>
              <View style={styles.perkItem}>
                <Ionicons name="checkmark-circle" size={16} color="#D7FF00" style={{ marginRight: 6 }} />
                <Text style={styles.perkText}>Lencana Mahkota Emas 👑 & Profil VIP</Text>
              </View>
              <View style={styles.perkItem}>
                <Ionicons name="checkmark-circle" size={16} color="#D7FF00" style={{ marginRight: 6 }} />
                <Text style={styles.perkText}>Proteksi Anti-Spam Komunitas & Prioritas Tayang</Text>
              </View>
            </View>

            {/* Pilihan Metode Bayar */}
            <View style={styles.methodToggle}>
              <TouchableOpacity 
                style={[styles.methodBtn, paymentMethod === 'qris' && styles.methodBtnActive]}
                onPress={() => setPaymentMethod('qris')}
              >
                <Text style={[styles.methodText, paymentMethod === 'qris' && styles.methodTextActive]}>QRIS</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.methodBtn, paymentMethod === 'va' && styles.methodBtnActive]}
                onPress={() => setPaymentMethod('va')}
              >
                <Text style={[styles.methodText, paymentMethod === 'va' && styles.methodTextActive]}>Virtual Account</Text>
              </TouchableOpacity>
            </View>

            {/* Action Buttons */}
            <TouchableOpacity 
              style={styles.payBtn}
              onPress={handlePayMembership}
              disabled={isProcessingPayment}
              activeOpacity={0.85}
            >
              {isProcessingPayment ? (
                <ActivityIndicator color="#000000" size="small" />
              ) : (
                <>
                  <Ionicons name="card" size={18} color="#000000" style={{ marginRight: 6 }} />
                  <Text style={styles.payBtnText}>
                    Bayar & Aktifkan Membership {selectedPlan === 'yearly' ? 'Rp 399.000' : 'Rp 49.000'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.closeModalBtn}
              onPress={() => setMembershipModalVisible(false)}
            >
              <Text style={styles.closeModalText}>Nanti Saja (Kembali)</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  proMemberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.12)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FFD700',
    marginBottom: 14,
  },
  proMemberBadgeText: {
    color: '#FFD700',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  upgradePromptBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D7FF00',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    marginBottom: 16,
  },
  upgradePromptText: {
    color: '#000000',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
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
    paddingHorizontal: 16,
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
  formGroup: {
    marginBottom: 18,
  },
  coverUploadBox: {
    height: 160,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#18181D',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  coverImagePreview: {
    width: '100%',
    height: '100%',
  },
  coverUploadOverlay: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: '#D7FF00',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
  },
  coverUploadText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '800',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#131317',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  logoPickerContainer: {
    position: 'relative',
    marginRight: 14,
  },
  logoImagePreview: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#27272A',
    borderWidth: 2,
    borderColor: '#D7FF00',
  },
  logoEditBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#D7FF00',
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#0A0A0C',
  },
  logoInstructions: {
    flex: 1,
  },
  logoTitleText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  logoSubText: {
    color: '#71717A',
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
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
  },

  // MODAL MEMBERSHIP STYLES
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  membershipCard: {
    width: '100%',
    backgroundColor: '#131317',
    borderRadius: 24,
    padding: 22,
    borderWidth: 1.5,
    borderColor: '#FFD700',
  },
  membershipHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  crownIconBadge: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  membershipTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  membershipDesc: {
    fontSize: 12,
    color: '#A1A1AA',
    textAlign: 'center',
    lineHeight: 17,
    marginTop: 6,
  },
  plansContainer: {
    gap: 10,
    marginBottom: 16,
  },
  planCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A22',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    position: 'relative',
  },
  planCardActive: {
    borderColor: '#FFD700',
    backgroundColor: 'rgba(255, 215, 0, 0.08)',
  },
  planRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#FFD700',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  planRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFD700',
  },
  planTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  planPrice: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFD700',
    marginTop: 2,
  },
  planPeriod: {
    fontSize: 11,
    color: '#71717A',
    fontWeight: '600',
  },
  saveBadge: {
    position: 'absolute',
    top: 8,
    right: 10,
    backgroundColor: '#FFD700',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  saveBadgeText: {
    color: '#000000',
    fontSize: 9,
    fontWeight: '900',
  },
  perksList: {
    backgroundColor: '#0E0E12',
    padding: 12,
    borderRadius: 14,
    marginBottom: 16,
    gap: 6,
  },
  perkItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  perkText: {
    fontSize: 11,
    color: '#D4D4D8',
    fontWeight: '600',
  },
  methodToggle: {
    flexDirection: 'row',
    backgroundColor: '#0E0E12',
    borderRadius: 12,
    padding: 3,
    marginBottom: 16,
  },
  methodBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 10,
  },
  methodBtnActive: {
    backgroundColor: '#27272A',
  },
  methodText: {
    fontSize: 12,
    color: '#71717A',
    fontWeight: '700',
  },
  methodTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  payBtn: {
    backgroundColor: '#FFD700',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
  },
  payBtnText: {
    color: '#000000',
    fontWeight: '900',
    fontSize: 13,
  },
  closeModalBtn: {
    marginTop: 10,
    alignItems: 'center',
    paddingVertical: 8,
  },
  closeModalText: {
    color: '#71717A',
    fontSize: 12,
    fontWeight: '700',
  }
});
