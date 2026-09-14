import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Image, 
  Dimensions, 
  ScrollView, 
  ActivityIndicator, 
  Alert,
  Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { useRoute, useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { decode } from 'base64-arraybuffer';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PREVIEW_WIDTH = Math.min(SCREEN_WIDTH - 48, 340);
const PREVIEW_HEIGHT = (PREVIEW_WIDTH * 16) / 9;

type LayoutTemplate = 'bottom_hud' | 'top_bar' | 'corner_stamp' | 'split_edge' | 'side_strip' | 'vip_gold_crown' | 'vip_carbon_splits';

export default function ShareStoryScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const viewShotRef = useRef<any>(null);

  // Ambil parameter aktivitas yang dicapai
  const params = route.params || {};
  const [latestActivity, setLatestActivity] = useState<any>(null);

  useEffect(() => {
    const fetchLatestActivity = async () => {
      if (params.distance_meters || params.distanceKm) return;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
          .from('activities')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data) {
          setLatestActivity(data);
        }
      } catch (e) {
        console.log('Error fetching latest activity for story:', e);
      }
    };
    fetchLatestActivity();
  }, []);

  const distanceKm = params.distance_meters 
    ? (params.distance_meters / 1000).toFixed(2) 
    : (params.distanceKm || (latestActivity?.distance ? (latestActivity.distance / 1000).toFixed(2) : '5.20'));
  
  const durationSeconds = params.duration_seconds || latestActivity?.duration || 1620;
  const sportType = params.sport_type || latestActivity?.sport_type || 'Run';
  const isRide = sportType === 'Ride';

  // Format durasi
  const formatDuration = (totalSec: number) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Format pace
  const calcPace = () => {
    if (params.pace) return params.pace;
    const dist = parseFloat(distanceKm);
    if (dist <= 0) return isRide ? '24.5 km/j' : "5'20\" /km";
    if (isRide) {
      const hours = durationSeconds / 3600;
      return (dist / hours).toFixed(1) + ' km/j';
    } else {
      const paceDec = (durationSeconds / 60) / dist;
      const m = Math.floor(paceDec);
      const s = Math.floor((paceDec - m) * 60);
      return `${m}'${s < 10 ? '0' : ''}${s}" /km`;
    }
  };

  const paceStr = calcPace();
  const estCalories = Math.round(parseFloat(distanceKm) * (isRide ? 34 : 68));

  // Tanggal & Waktu saat olahraga
  const now = new Date();
  const days = ['MIN', 'SEN', 'SEL', 'RAB', 'KAM', 'JUM', 'SAB'];
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MEI', 'JUN', 'JUL', 'AGU', 'SEP', 'OKT', 'NOV', 'DES'];
  const timestampStr = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} • ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // State foto selfie & template tata letak
  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  const [activeTemplate, setActiveTemplate] = useState<LayoutTemplate>('bottom_hud');
  const [isExporting, setIsExporting] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  // VIP Membership State
  const [isVipMember, setIsVipMember] = useState(false);
  const [vipModalVisible, setVipModalVisible] = useState(false);

  useEffect(() => {
    const checkMembership = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_premium')
          .eq('id', user.id)
          .maybeSingle();
        if (profile?.is_premium) {
          setIsVipMember(true);
        }
      } catch (e) {
        console.log('Error checking membership:', e);
      }
    };
    checkMembership();
  }, []);

  const selectTemplate = (template: LayoutTemplate) => {
    if ((template === 'vip_gold_crown' || template === 'vip_carbon_splits') && !isVipMember) {
      setVipModalVisible(true);
      return;
    }
    setActiveTemplate(template);
  };

  // Ambil foto kamera depan (Selfie)
  const takeSelfie = async (useFront = true) => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Izin Kamera Ditolak', 'Beri akses kamera untuk mengambil foto selfie setelah olahraga.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        cameraType: useFront ? ImagePicker.CameraType.front : ImagePicker.CameraType.back,
        allowsEditing: true,
        aspect: [9, 16],
        quality: 0.95,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelfieUri(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'Gagal membuka kamera perangkat.');
    }
  };

  // Ambil foto dari Galeri
  const pickFromGallery = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Izin Galeri Ditolak', 'Beri akses galeri untuk memilih foto olahraga.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [9, 16],
        quality: 0.95,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelfieUri(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'Gagal membuka galeri foto.');
    }
  };

  // Posting langsung ke Story Beranda Flex Pace (24 Jam)
  const handlePublishToAppStory = async () => {
    if (!viewShotRef.current) return;
    setIsPublishing(true);

    try {
      // 1. Capture 9:16 canvas as base64
      const base64Data = await captureRef(viewShotRef, {
        format: 'jpg',
        quality: 0.88,
        result: 'base64',
      });

      let finalPhotoUrl = `data:image/jpeg;base64,${base64Data}`;

      // 2. Cek pengguna yang sedang login & upload ke storage jika memungkinkan
      const { data: { user } } = await supabase.auth.getUser();
      let athleteName = 'Flex Athlete';
      let athleteAvatar = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&q=80';
      let athleteUserId = user?.id || 'guest';

      if (user) {
        athleteUserId = user.id;

        // Coba upload file ke Supabase Storage bucket 'media'
        try {
          const fileName = `stories/${user.id}-${Date.now()}.jpg`;
          const { error: uploadErr } = await supabase.storage
            .from('media')
            .upload(fileName, decode(base64Data), {
              contentType: 'image/jpeg',
              upsert: true,
            });

          if (!uploadErr) {
            const { data: publicUrlData } = supabase.storage
              .from('media')
              .getPublicUrl(fileName);
            if (publicUrlData?.publicUrl) {
              finalPhotoUrl = publicUrlData.publicUrl;
            }
          }
        } catch (storageErr) {
          console.log('Supabase storage upload fallback to local data URI:', storageErr);
        }

        // Ambil nama & foto profil pengguna
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('name, avatar_url')
            .eq('id', user.id)
            .maybeSingle();

          if (profile?.name) athleteName = profile.name;
          if (profile?.avatar_url) athleteAvatar = profile.avatar_url;
        } catch (profErr) {
          console.log('Error fetching user profile for story:', profErr);
        }
      }

      // 3. Buat objek Story baru
      const newStory = {
        id: `story_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        user_id: athleteUserId,
        name: athleteName,
        avatar: athleteAvatar,
        photo: finalPhotoUrl,
        pace: paceStr,
        distance: `${distanceKm} KM`,
        time: formatDuration(durationSeconds),
        bpm: '156',
        ringColor: '#D7FF00',
        badge: isRide ? 'RIDE' : 'RUN',
        timeAgo: 'Baru saja',
        created_at: new Date().toISOString(),
        hasBakedHud: true,
      };

      // 4. Simpan ke AsyncStorage '@fp_user_stories'
      const saved = await AsyncStorage.getItem('@fp_user_stories');
      let existingStories: any[] = [];
      if (saved) {
        try {
          existingStories = JSON.parse(saved);
        } catch (e) {
          existingStories = [];
        }
      }

      // Filter story yang sudah kedaluwarsa (> 24 jam)
      const nowTime = Date.now();
      const validStories = existingStories.filter((s: any) => {
        if (!s.created_at) return true;
        return nowTime - new Date(s.created_at).getTime() < 24 * 60 * 60 * 1000;
      });

      // Simpan story baru di urutan paling depan
      const updatedStories = [newStory, ...validStories];
      await AsyncStorage.setItem('@fp_user_stories', JSON.stringify(updatedStories));

      Alert.alert(
        'Story Berhasil Diposting! 🎉',
        'Story pace Anda kini aktif di Beranda aplikasi Flex Pace selama 24 jam.',
        [
          {
            text: 'Lihat di Beranda',
            onPress: () => {
              // @ts-ignore
              navigation.navigate('Main');
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Publish story error:', error);
      Alert.alert('Gagal Memposting Story', error.message || 'Terjadi kesalahan sistem.');
    } finally {
      setIsPublishing(false);
    }
  };

  // Export & Share ke Aplikasi Luar (WhatsApp / Instagram)
  const handleExportAndShare = async () => {
    if (!viewShotRef.current) return;
    setIsExporting(true);

    try {
      const uri = await captureRef(viewShotRef, {
        format: 'png',
        quality: 1.0,
        result: 'tmpfile',
      });

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: 'Bagikan Story Flex Pace',
          UTI: 'public.png',
        });
      } else {
        Alert.alert('Sukses', 'Gambar story berhasil disimpan.');
      }
    } catch (error: any) {
      Alert.alert('Gagal Membagikan', error.message || 'Terjadi kesalahan sistem.');
    } finally {
      setIsExporting(false);
    }
  };

  // RENDER MODEL TATA LETAK LABEL
  const renderTemplateOverlay = () => {
    switch (activeTemplate) {
      case 'bottom_hud':
        return (
          // TEMPLATE 1: HUD Bawah (Area Wajah & Foto 85% Bebas Total)
          <View style={styles.templateContainer}>
            {/* Brand Pill Kecil di Atas */}
            <View style={styles.compactTopPill}>
              <Image source={require('../../assets/icon.png')} style={styles.miniLogo} />
              <Text style={styles.compactBrandText}>FLEX PACE</Text>
              <Text style={styles.compactDot}>•</Text>
              <Text style={styles.compactTimestamp}>{timestampStr}</Text>
            </View>

            {/* Spacer agar area foto di tengah plong dan tidak tertutup */}
            <View style={{ flex: 1 }} />

            {/* Panel Telemetri Lengkap di Bawah */}
            <View style={styles.bottomHudCard}>
              <View style={styles.bottomHudLeft}>
                <View style={styles.sportMiniTag}>
                  <Ionicons name={isRide ? "bicycle" : "walk"} size={11} color="#000000" style={{ marginRight: 3 }} />
                  <Text style={styles.sportMiniText}>{isRide ? 'RIDE' : 'RUN'}</Text>
                </View>
                <View style={styles.hudDistanceRow}>
                  <Text style={styles.hudDistanceNum}>{distanceKm}</Text>
                  <Text style={styles.hudDistanceUnit}>KM</Text>
                </View>
              </View>

              <View style={styles.hudVDivider} />

              <View style={styles.bottomHudRight}>
                <View style={styles.hudSubMetricRow}>
                  <Ionicons name="speedometer-outline" size={12} color="#D7FF00" style={{ marginRight: 5 }} />
                  <Text style={styles.hudSubMetricLabel}>{isRide ? 'SPD' : 'PACE'}:</Text>
                  <Text style={styles.hudSubMetricVal}>{paceStr}</Text>
                </View>
                <View style={styles.hudSubMetricRow}>
                  <Ionicons name="time-outline" size={12} color="#30D158" style={{ marginRight: 5 }} />
                  <Text style={styles.hudSubMetricLabel}>TIME:</Text>
                  <Text style={styles.hudSubMetricVal}>{formatDuration(durationSeconds)}</Text>
                </View>
                <View style={styles.hudSubMetricRow}>
                  <Ionicons name="flame-outline" size={12} color="#FF9F0A" style={{ marginRight: 5 }} />
                  <Text style={styles.hudSubMetricLabel}>CAL:</Text>
                  <Text style={styles.hudSubMetricVal}>{estCalories} kkal</Text>
                </View>
              </View>
            </View>
          </View>
        );

      case 'top_bar':
        return (
          // TEMPLATE 2: Header Minimalis di Atas (Bawah & Tengah Bebas)
          <View style={styles.templateContainer}>
            <View style={styles.topBarCard}>
              <View style={styles.topBarRowOne}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Image source={require('../../assets/icon.png')} style={styles.miniLogo} />
                  <Text style={styles.compactBrandText}>FLEX PACE</Text>
                </View>
                <Text style={styles.topBarTimestamp}>{timestampStr}</Text>
              </View>
              <View style={styles.topBarMetricsRow}>
                <View style={styles.topBarMetricItem}>
                  <Text style={styles.topBarMetricVal}>{distanceKm} <Text style={{ fontSize: 10, color: '#D7FF00' }}>KM</Text></Text>
                  <Text style={styles.topBarMetricLbl}>JARAK</Text>
                </View>
                <View style={styles.topBarMetricItem}>
                  <Text style={styles.topBarMetricVal}>{paceStr}</Text>
                  <Text style={styles.topBarMetricLbl}>{isRide ? 'SPEED' : 'PACE'}</Text>
                </View>
                <View style={styles.topBarMetricItem}>
                  <Text style={styles.topBarMetricVal}>{formatDuration(durationSeconds)}</Text>
                  <Text style={styles.topBarMetricLbl}>WAKTU</Text>
                </View>
              </View>
            </View>
            <View style={{ flex: 1 }} />
          </View>
        );

      case 'corner_stamp':
        return (
          // TEMPLATE 3: Stempel Pojok Pro (95% Foto Bebas Total)
          <View style={styles.templateContainer}>
            <View style={{ flex: 1 }} />
            <View style={styles.cornerStampBadge}>
              <View style={styles.stampHeader}>
                <Image source={require('../../assets/icon.png')} style={styles.stampLogo} />
                <Text style={styles.stampBrand}>FLEX PACE</Text>
              </View>
              <View style={styles.stampMainRow}>
                <Text style={styles.stampDistance}>{distanceKm}</Text>
                <Text style={styles.stampKm}>KM</Text>
              </View>
              <View style={styles.stampFooterRow}>
                <Text style={styles.stampPaceText}>{paceStr} • {formatDuration(durationSeconds)}</Text>
              </View>
              <Text style={styles.stampDate}>{timestampStr}</Text>
            </View>
          </View>
        );

      case 'split_edge':
        return (
          // TEMPLATE 4: Ticker Tepi Garis Tipis (Modern Sleek)
          <View style={styles.templateContainer}>
            <View style={styles.splitTopRow}>
              <View style={styles.compactBrandPill}>
                <Image source={require('../../assets/icon.png')} style={{ width: 16, height: 16, borderRadius: 4, marginRight: 6 }} />
                <Text style={{ color: '#D7FF00', fontWeight: '900', fontSize: 11, letterSpacing: 1 }}>FLEX PACE</Text>
              </View>
              <View style={styles.timestampGlassPill}>
                <Text style={{ color: '#FFFFFF', fontSize: 9, fontWeight: '700' }}>{timestampStr}</Text>
              </View>
            </View>

            <View style={{ flex: 1 }} />

            <View style={styles.tickerBottomBar}>
              <Text style={styles.tickerText}>
                ⚡ <Text style={{ color: '#D7FF00', fontWeight: '900' }}>{distanceKm} KM</Text>
                {'   '}•{'   '}PACE <Text style={{ color: '#D7FF00', fontWeight: '900' }}>{paceStr}</Text>
                {'   '}•{'   '}<Text style={{ color: '#FFFFFF', fontWeight: '900' }}>{formatDuration(durationSeconds)}</Text>
                {'   '}•{'   '}{estCalories} KCAL
              </Text>
            </View>
          </View>
        );

      case 'side_strip':
        return (
          // TEMPLATE 5: Strip Telemetri Vertikal Samping
          <View style={[styles.templateContainer, { flexDirection: 'row' }]}>
            <View style={styles.sideStripBar}>
              <Image source={require('../../assets/icon.png')} style={{ width: 22, height: 22, borderRadius: 6, marginBottom: 8 }} />
              <View style={styles.sideStripItem}>
                <Text style={styles.sideStripLabel}>DIST</Text>
                <Text style={styles.sideStripVal}>{distanceKm}</Text>
                <Text style={styles.sideStripUnit}>KM</Text>
              </View>
              <View style={styles.sideStripItem}>
                <Text style={styles.sideStripLabel}>{isRide ? 'SPD' : 'PACE'}</Text>
                <Text style={styles.sideStripVal}>{paceStr.split(' ')[0]}</Text>
              </View>
              <View style={styles.sideStripItem}>
                <Text style={styles.sideStripLabel}>TIME</Text>
                <Text style={styles.sideStripVal}>{formatDuration(durationSeconds)}</Text>
              </View>
            </View>
            <View style={{ flex: 1 }} />
          </View>
        );

      case 'vip_gold_crown':
        return (
          // TEMPLATE 6 (VIP EKSKLUSIF): Golden Crown Hologram Pro
          <View style={styles.templateContainer}>
            {/* Crown Header with Golden Accent */}
            <View style={styles.vipGoldTopBadge}>
              <Ionicons name="trophy" size={13} color="#000000" style={{ marginRight: 5 }} />
              <Text style={styles.vipGoldTopText}>FLEX PACE PRO ATHLETE</Text>
              <Text style={styles.vipGoldTopDot}>•</Text>
              <Text style={styles.vipGoldTopSub}>VERIFIED</Text>
            </View>

            <View style={{ flex: 1 }} />

            {/* Premium Gold Glassmorphism Card */}
            <View style={styles.vipGoldCard}>
              <View style={styles.vipGoldCardHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                  <Text style={styles.vipGoldDistNum}>{distanceKm}</Text>
                  <Text style={styles.vipGoldDistUnit}>KM</Text>
                </View>
                <View style={styles.vipGoldStamp}>
                  <Ionicons name="star" size={11} color="#FFD700" style={{ marginRight: 3 }} />
                  <Text style={styles.vipGoldStampText}>GOLD CLASS</Text>
                </View>
              </View>

              <View style={styles.vipGoldDivider} />

              <View style={styles.vipGoldMetricsRow}>
                <View style={styles.vipGoldMetricCol}>
                  <Text style={styles.vipGoldLabel}>PACE</Text>
                  <Text style={styles.vipGoldVal}>{paceStr}</Text>
                </View>
                <View style={styles.vipGoldMetricCol}>
                  <Text style={styles.vipGoldLabel}>DURASI</Text>
                  <Text style={styles.vipGoldVal}>{formatDuration(durationSeconds)}</Text>
                </View>
                <View style={styles.vipGoldMetricCol}>
                  <Text style={styles.vipGoldLabel}>KALORI</Text>
                  <Text style={styles.vipGoldVal}>{estCalories} kkal</Text>
                </View>
              </View>
            </View>
          </View>
        );

      case 'vip_carbon_splits':
        return (
          // TEMPLATE 7 (VIP EKSKLUSIF): Carbon Split Matrix Telemetri
          <View style={styles.templateContainer}>
            <View style={styles.carbonMatrixHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="flash" size={13} color="#FFD700" style={{ marginRight: 4 }} />
                <Text style={styles.carbonMatrixTitle}>SPEED TELEMETRY PRO</Text>
              </View>
              <Text style={styles.carbonTimestamp}>{timestampStr}</Text>
            </View>

            <View style={{ flex: 1 }} />

            {/* Split Matrix Box */}
            <View style={styles.carbonMatrixBox}>
              <View style={styles.carbonHeroRow}>
                <Text style={styles.carbonHeroNum}>{distanceKm}</Text>
                <Text style={styles.carbonHeroUnit}>KM</Text>
                <View style={{ flex: 1 }} />
                <View style={styles.carbonPaceBadge}>
                  <Text style={styles.carbonPaceLabel}>AVG PACE</Text>
                  <Text style={styles.carbonPaceVal}>{paceStr}</Text>
                </View>
              </View>

              <View style={styles.carbonGrid}>
                <View style={styles.carbonGridCell}>
                  <Text style={styles.carbonGridLbl}>WAKTU</Text>
                  <Text style={styles.carbonGridVal}>{formatDuration(durationSeconds)}</Text>
                </View>
                <View style={styles.carbonGridCell}>
                  <Text style={styles.carbonGridLbl}>DETAK JANTUNG</Text>
                  <Text style={styles.carbonGridVal}>156 BPM</Text>
                </View>
                <View style={styles.carbonGridCell}>
                  <Text style={styles.carbonGridLbl}>CADENCE</Text>
                  <Text style={styles.carbonGridVal}>174 SPM</Text>
                </View>
                <View style={styles.carbonGridCell}>
                  <Text style={styles.carbonGridLbl}>EFFICIENCY</Text>
                  <Text style={[styles.carbonGridVal, { color: '#30D158' }]}>94%</Text>
                </View>
              </View>
            </View>
          </View>
        );
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>STORY PACE 9:16</Text>
          <Text style={styles.headerSubtitle}>Pilih model tata letak agar selfie Anda tetap terang dan tidak terhalang</Text>
        </View>

        {/* KARTU PREVIEW 9:16 */}
        <View style={styles.previewOuterWrapper}>
          <View 
            ref={viewShotRef} 
            collapsable={false}
            style={[styles.storyCanvas, { width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT }]}
          >
            {/* BACKGROUND FOTO SELFIE (NORMAL, TIDAK DIGELAPKAN) */}
            {selfieUri ? (
              <Image source={{ uri: selfieUri }} style={styles.backgroundImage} resizeMode="cover" />
            ) : (
              <Image 
                source={{ uri: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80' }} 
                style={styles.backgroundImage} 
                resizeMode="cover" 
              />
            )}

            {/* OVERLAY TATA LETAK LABEL SESUAI MODEL PILIHAN */}
            {renderTemplateOverlay()}
          </View>
        </View>

        {/* PILIHAN MODEL TATA LETAK KAMERA & LABEL */}
        <View style={styles.selectorSection}>
          <Text style={styles.selectorSectionTitle}>PILIH MODEL TATA LETAK LABEL:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.templatesScroll}>
            
            <TouchableOpacity 
              style={[styles.templateChip, activeTemplate === 'bottom_hud' && styles.templateChipActive]}
              onPress={() => selectTemplate('bottom_hud')}
              activeOpacity={0.8}
            >
              <Ionicons name="tablet-landscape-outline" size={14} color={activeTemplate === 'bottom_hud' ? '#000000' : '#D7FF00'} style={{ marginRight: 5 }} />
              <Text style={[styles.templateChipText, activeTemplate === 'bottom_hud' && styles.templateChipTextActive]}>
                HUD Bawah (Bebas)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.templateChip, activeTemplate === 'top_bar' && styles.templateChipActive]}
              onPress={() => selectTemplate('top_bar')}
              activeOpacity={0.8}
            >
              <Ionicons name="reorder-two-outline" size={14} color={activeTemplate === 'top_bar' ? '#000000' : '#D7FF00'} style={{ marginRight: 5 }} />
              <Text style={[styles.templateChipText, activeTemplate === 'top_bar' && styles.templateChipTextActive]}>
                Header Atas
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.templateChip, activeTemplate === 'corner_stamp' && styles.templateChipActive]}
              onPress={() => selectTemplate('corner_stamp')}
              activeOpacity={0.8}
            >
              <Ionicons name="pricetag-outline" size={14} color={activeTemplate === 'corner_stamp' ? '#000000' : '#D7FF00'} style={{ marginRight: 5 }} />
              <Text style={[styles.templateChipText, activeTemplate === 'corner_stamp' && styles.templateChipTextActive]}>
                Stempel Pojok
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.templateChip, activeTemplate === 'split_edge' && styles.templateChipActive]}
              onPress={() => selectTemplate('split_edge')}
              activeOpacity={0.8}
            >
              <Ionicons name="barcode-outline" size={14} color={activeTemplate === 'split_edge' ? '#000000' : '#D7FF00'} style={{ marginRight: 5 }} />
              <Text style={[styles.templateChipText, activeTemplate === 'split_edge' && styles.templateChipTextActive]}>
                Ticker Tepi
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.templateChip, activeTemplate === 'side_strip' && styles.templateChipActive]}
              onPress={() => selectTemplate('side_strip')}
              activeOpacity={0.8}
            >
              <Ionicons name="file-tray-stacked-outline" size={14} color={activeTemplate === 'side_strip' ? '#000000' : '#D7FF00'} style={{ marginRight: 5 }} />
              <Text style={[styles.templateChipText, activeTemplate === 'side_strip' && styles.templateChipTextActive]}>
                Strip Samping
              </Text>
            </TouchableOpacity>

            {/* TEMPLATE EKSKLUSIF VIP */}
            <TouchableOpacity 
              style={[styles.templateChip, styles.vipChip, activeTemplate === 'vip_gold_crown' && styles.vipChipActive]}
              onPress={() => selectTemplate('vip_gold_crown')}
              activeOpacity={0.8}
            >
              <Ionicons name="trophy" size={14} color={activeTemplate === 'vip_gold_crown' ? '#000000' : '#FFD700'} style={{ marginRight: 5 }} />
              <Text style={[styles.templateChipText, styles.vipChipText, activeTemplate === 'vip_gold_crown' && styles.vipChipTextActive]}>
                👑 Mahkota Emas (VIP)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.templateChip, styles.vipChip, activeTemplate === 'vip_carbon_splits' && styles.vipChipActive]}
              onPress={() => selectTemplate('vip_carbon_splits')}
              activeOpacity={0.8}
            >
              <Ionicons name="speedometer" size={14} color={activeTemplate === 'vip_carbon_splits' ? '#000000' : '#FFD700'} style={{ marginRight: 5 }} />
              <Text style={[styles.templateChipText, styles.vipChipText, activeTemplate === 'vip_carbon_splits' && styles.vipChipTextActive]}>
                👑 Carbon Matrix (VIP)
              </Text>
            </TouchableOpacity>

          </ScrollView>
        </View>

        {/* CONTROLS FOTO (SELFIE DEPAN / KAMERA BELAKANG / GALERI) */}
        <View style={styles.actionRowControls}>
          <TouchableOpacity style={styles.photoControlBtn} onPress={() => takeSelfie(true)}>
            <Ionicons name="camera-reverse" size={18} color="#000000" style={{ marginRight: 6 }} />
            <Text style={styles.photoControlBtnText}>Selfie Depan</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cameraBackBtn} onPress={() => takeSelfie(false)}>
            <Ionicons name="camera-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.cameraBackBtnText}>Kamera Belakang</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.galleryControlBtn} onPress={pickFromGallery}>
            <Ionicons name="images-outline" size={18} color="#D7FF00" style={{ marginRight: 6 }} />
            <Text style={styles.galleryControlBtnText}>Galeri</Text>
          </TouchableOpacity>
        </View>

        {/* TOMBOL AKSI UTAMA */}
        <View style={styles.actionButtonsContainer}>
          {/* Tombol 1: Posting ke Story Beranda */}
          <TouchableOpacity 
            style={styles.publishStoryBtn} 
            onPress={handlePublishToAppStory}
            disabled={isPublishing || isExporting}
            activeOpacity={0.85}
          >
            {isPublishing ? (
              <View style={styles.shareBtnContent}>
                <ActivityIndicator color="#000000" style={{ marginRight: 8 }} />
                <Text style={styles.publishStoryBtnText}>Memposting Story...</Text>
              </View>
            ) : (
              <View style={styles.shareBtnContent}>
                <Ionicons name="flash" size={20} color="#000000" style={{ marginRight: 8 }} />
                <Text style={styles.publishStoryBtnText}>Posting ke Story Beranda</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Tombol 2: Bagikan ke Luar (WhatsApp / Instagram) */}
          <TouchableOpacity 
            style={styles.shareExternalBtn} 
            onPress={handleExportAndShare}
            disabled={isPublishing || isExporting}
            activeOpacity={0.85}
          >
            {isExporting ? (
              <View style={styles.shareBtnContent}>
                <ActivityIndicator color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.shareExternalBtnText}>Menyiapkan Gambar...</Text>
              </View>
            ) : (
              <View style={styles.shareBtnContent}>
                <Ionicons name="share-social-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.shareExternalBtnText}>Bagikan ke Luar (WA / IG)</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* MODAL VIP PRO UNTUK TEMPLATE */}
        <Modal
          visible={vipModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setVipModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.vipModalCard}>
              <View style={styles.vipCrownBadgeModal}>
                <Ionicons name="trophy" size={28} color="#000000" />
              </View>
              <Text style={styles.vipModalTitle}>TEMPLATE EKSKLUSIF VIP PRO</Text>
              <Text style={styles.vipModalDesc}>
                Buka template eksklusif Mahkota Emas &amp; Carbon Split Matrix untuk memamerkan pencapaian olahraga Anda di media sosial dengan visual premium kelas dunia.
              </Text>

              <View style={styles.vipPerksBox}>
                <View style={styles.vipPerkItem}>
                  <Ionicons name="checkmark-circle" size={16} color="#FFD700" style={{ marginRight: 6 }} />
                  <Text style={styles.vipPerkText}>Desain emas mewah dengan lencana resmi verified athlete</Text>
                </View>
                <View style={styles.vipPerkItem}>
                  <Ionicons name="checkmark-circle" size={16} color="#FFD700" style={{ marginRight: 6 }} />
                  <Text style={styles.vipPerkText}>Telemetri split cadence, detak jantung &amp; efisiensi</Text>
                </View>
                <View style={styles.vipPerkItem}>
                  <Ionicons name="checkmark-circle" size={16} color="#FFD700" style={{ marginRight: 6 }} />
                  <Text style={styles.vipPerkText}>Bebas tanpa watermark default</Text>
                </View>
              </View>

              <TouchableOpacity 
                style={styles.vipUpgradeBtn}
                onPress={() => {
                  setVipModalVisible(false);
                  // @ts-ignore
                  navigation.navigate('Profile');
                }}
              >
                <Text style={styles.vipUpgradeBtnText}>Upgrade ke VIP PRO (Mulai Rp 49rb)</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={{ alignItems: 'center', marginTop: 12 }}
                onPress={() => setVipModalVisible(false)}
              >
                <Text style={{ color: '#71717A', fontSize: 13, fontWeight: '600' }}>Nanti Saja</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0C',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 40,
    alignItems: 'center',
  },
  headerInfo: {
    alignItems: 'center',
    marginBottom: 14,
  },
  headerTitle: {
    color: '#D7FF00',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 2,
  },
  headerSubtitle: {
    color: '#71717A',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 20,
  },

  // 9:16 CANVAS WRAPPER
  previewOuterWrapper: {
    shadowColor: '#D7FF00',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 10,
    marginBottom: 16,
    borderRadius: 24,
  },
  storyCanvas: {
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#141418',
    borderWidth: 1.5,
    borderColor: 'rgba(215, 255, 0, 0.4)',
  },
  backgroundImage: {
    ...StyleSheet.absoluteFill as any,
    width: '100%',
    height: '100%',
  },
  templateContainer: {
    ...StyleSheet.absoluteFill as any,
    padding: 14,
    justifyContent: 'space-between',
  },

  // COMPACT TOP PILL
  compactTopPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(10, 10, 14, 0.75)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  miniLogo: {
    width: 18,
    height: 18,
    borderRadius: 5,
    marginRight: 6,
  },
  compactBrandText: {
    color: '#D7FF00',
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 1,
  },
  compactDot: {
    color: '#71717A',
    marginHorizontal: 5,
    fontSize: 10,
  },
  compactTimestamp: {
    color: '#E4E4E7',
    fontSize: 9,
    fontWeight: '700',
  },

  // BOTTOM HUD CARD (MODEL 1)
  bottomHudCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(12, 12, 16, 0.85)',
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(215, 255, 0, 0.35)',
  },
  bottomHudLeft: {
    flex: 1.1,
  },
  sportMiniTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#D7FF00',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
    marginBottom: 2,
  },
  sportMiniText: {
    color: '#000000',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  hudDistanceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  hudDistanceNum: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -1,
  },
  hudDistanceUnit: {
    color: '#D7FF00',
    fontSize: 13,
    fontWeight: '900',
    marginLeft: 4,
  },
  hudVDivider: {
    width: 1,
    height: '75%',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    marginHorizontal: 10,
  },
  bottomHudRight: {
    flex: 1,
    justifyContent: 'center',
  },
  hudSubMetricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 1.5,
  },
  hudSubMetricLabel: {
    color: '#A1A1AA',
    fontSize: 9,
    fontWeight: '800',
    width: 38,
  },
  hudSubMetricVal: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },

  // TOP BAR CARD (MODEL 2)
  topBarCard: {
    backgroundColor: 'rgba(10, 10, 14, 0.82)',
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(215, 255, 0, 0.3)',
  },
  topBarRowOne: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingBottom: 6,
    marginBottom: 6,
  },
  topBarTimestamp: {
    color: '#A1A1AA',
    fontSize: 9,
    fontWeight: '600',
  },
  topBarMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  topBarMetricItem: {
    alignItems: 'center',
  },
  topBarMetricVal: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  topBarMetricLbl: {
    color: '#71717A',
    fontSize: 8,
    fontWeight: '800',
    marginTop: 1,
  },

  // CORNER STAMP (MODEL 3)
  cornerStampBadge: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(10, 10, 14, 0.88)',
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#D7FF00',
    minWidth: 140,
  },
  stampHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  stampLogo: {
    width: 14,
    height: 14,
    borderRadius: 4,
    marginRight: 5,
  },
  stampBrand: {
    color: '#D7FF00',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  stampMainRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  stampDistance: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  stampKm: {
    color: '#D7FF00',
    fontSize: 12,
    fontWeight: '900',
    marginLeft: 3,
  },
  stampFooterRow: {
    marginTop: 1,
  },
  stampPaceText: {
    color: '#E4E4E7',
    fontSize: 10,
    fontWeight: '700',
  },
  stampDate: {
    color: '#71717A',
    fontSize: 8,
    marginTop: 2,
  },

  // SPLIT EDGE (MODEL 4)
  splitTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  compactBrandPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(215, 255, 0, 0.3)',
  },
  timestampGlassPill: {
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  tickerBottomBar: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  tickerText: {
    color: '#E4E4E7',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // SIDE STRIP (MODEL 5)
  sideStripBar: {
    backgroundColor: 'rgba(10, 10, 14, 0.85)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(215, 255, 0, 0.3)',
  },
  sideStripItem: {
    alignItems: 'center',
    marginVertical: 6,
  },
  sideStripLabel: {
    color: '#71717A',
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  sideStripVal: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  sideStripUnit: {
    color: '#D7FF00',
    fontSize: 8,
    fontWeight: '900',
  },

  // SELECTOR SECTION
  selectorSection: {
    width: PREVIEW_WIDTH,
    marginBottom: 14,
  },
  selectorSectionTitle: {
    color: '#71717A',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  templatesScroll: {
    paddingRight: 10,
  },
  templateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141418',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  templateChipActive: {
    backgroundColor: '#D7FF00',
    borderColor: '#D7FF00',
  },
  templateChipText: {
    color: '#D7FF00',
    fontSize: 11,
    fontWeight: '700',
  },
  templateChipTextActive: {
    color: '#000000',
    fontWeight: '900',
  },

  // PHOTO CONTROLS
  actionRowControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: PREVIEW_WIDTH,
    marginBottom: 16,
  },
  photoControlBtn: {
    flex: 1.1,
    flexDirection: 'row',
    backgroundColor: '#D7FF00',
    paddingVertical: 11,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  photoControlBtnText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '800',
  },
  cameraBackBtn: {
    flex: 1.2,
    flexDirection: 'row',
    backgroundColor: '#1C1C24',
    paddingVertical: 11,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginRight: 6,
  },
  cameraBackBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  galleryControlBtn: {
    flex: 0.8,
    flexDirection: 'row',
    backgroundColor: '#141418',
    paddingVertical: 11,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(215, 255, 0, 0.3)',
  },
  galleryControlBtnText: {
    color: '#D7FF00',
    fontSize: 12,
    fontWeight: '800',
  },

  // TOMBOL AKSI UTAMA (POSTING APP & SHARE EXTERNAL)
  actionButtonsContainer: {
    width: PREVIEW_WIDTH,
    gap: 10,
    marginTop: 4,
    marginBottom: 24,
  },
  publishStoryBtn: {
    width: '100%',
    backgroundColor: '#D7FF00',
    paddingVertical: 15,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#D7FF00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  publishStoryBtnText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  shareExternalBtn: {
    width: '100%',
    backgroundColor: '#1C1C24',
    paddingVertical: 14,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  shareExternalBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  shareBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // VIP CHIP STYLES
  vipChip: {
    borderColor: '#FFD700',
    backgroundColor: '#1E1B0E',
  },
  vipChipActive: {
    backgroundColor: '#FFD700',
  },
  vipChipText: {
    color: '#FFD700',
  },
  vipChipTextActive: {
    color: '#000000',
  },

  // TEMPLATE 6: VIP GOLD CROWN STYLES
  vipGoldTopBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#FFD700',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 10,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  vipGoldTopText: {
    color: '#000000',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  vipGoldTopDot: {
    color: '#000000',
    marginHorizontal: 4,
    fontWeight: '900',
  },
  vipGoldTopSub: {
    color: '#000000',
    fontSize: 9,
    fontWeight: '800',
  },
  vipGoldCard: {
    backgroundColor: 'rgba(15, 14, 8, 0.88)',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#FFD700',
    padding: 12,
    marginHorizontal: 12,
    marginBottom: 14,
  },
  vipGoldCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  vipGoldDistNum: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -1,
  },
  vipGoldDistUnit: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 4,
  },
  vipGoldStamp: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2E250A',
    borderColor: '#FFD700',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  vipGoldStampText: {
    color: '#FFD700',
    fontSize: 9,
    fontWeight: '900',
  },
  vipGoldDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 215, 0, 0.25)',
    marginVertical: 8,
  },
  vipGoldMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  vipGoldMetricCol: {
    alignItems: 'center',
  },
  vipGoldLabel: {
    color: '#9CA3AF',
    fontSize: 9,
    fontWeight: '700',
  },
  vipGoldVal: {
    color: '#FFD700',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
  },

  // TEMPLATE 7: CARBON MATRIX STYLES
  carbonMatrixHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(12, 12, 16, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    marginHorizontal: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  carbonMatrixTitle: {
    color: '#FFD700',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  carbonTimestamp: {
    color: '#A1A1AA',
    fontSize: 9,
    fontWeight: '600',
  },
  carbonMatrixBox: {
    backgroundColor: 'rgba(10, 10, 14, 0.92)',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#3F3B20',
    padding: 12,
    marginHorizontal: 10,
    marginBottom: 12,
  },
  carbonHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  carbonHeroNum: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
  },
  carbonHeroUnit: {
    color: '#D7FF00',
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 4,
  },
  carbonPaceBadge: {
    backgroundColor: '#1C1C24',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'flex-end',
  },
  carbonPaceLabel: {
    color: '#71717A',
    fontSize: 8,
    fontWeight: '700',
  },
  carbonPaceVal: {
    color: '#D7FF00',
    fontSize: 12,
    fontWeight: '900',
  },
  carbonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 6,
  },
  carbonGridCell: {
    width: '48%',
    backgroundColor: '#16161E',
    borderRadius: 8,
    padding: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  carbonGridLbl: {
    color: '#71717A',
    fontSize: 8,
    fontWeight: '700',
  },
  carbonGridVal: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
  },

  // VIP MODAL STYLES
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'flex-end',
  },
  vipModalCard: {
    backgroundColor: '#14141A',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1.5,
    borderColor: '#FFD700',
    padding: 24,
    paddingBottom: 36,
  },
  vipCrownBadgeModal: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 12,
  },
  vipModalTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  vipModalDesc: {
    color: '#A1A1AA',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 16,
    paddingHorizontal: 6,
  },
  vipPerksBox: {
    backgroundColor: '#1C1C24',
    borderRadius: 14,
    padding: 14,
    gap: 10,
    marginBottom: 18,
  },
  vipPerkItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vipPerkText: {
    color: '#E4E4E7',
    fontSize: 12,
    fontWeight: '500',
  },
  vipUpgradeBtn: {
    backgroundColor: '#FFD700',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vipUpgradeBtnText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '900',
  }
});
