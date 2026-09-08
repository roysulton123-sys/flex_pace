import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Image, 
  TouchableOpacity, 
  ScrollView, 
  Alert, 
  ActivityIndicator,
  Modal,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type PaymentMethod = 'qris' | 'bca_va' | 'mandiri_va' | 'gopay';

export default function EventDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation();
  const { event } = route.params;

  const [hasRegistered, setHasRegistered] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingRegistration, setCheckingRegistration] = useState(true);

  // State Modal Pembayaran & Checkout
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('qris');
  const [paymentStep, setPaymentStep] = useState<'method' | 'pay' | 'success'>('method');
  const [ticketData, setTicketData] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState(899); // 14:59 menit countdown

  useEffect(() => {
    checkRegistration();
  }, []);

  // Countdown timer simulasi pembayaran QRIS/VA
  useEffect(() => {
    let timer: any;
    if (paymentModalVisible && paymentStep === 'pay' && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [paymentModalVisible, paymentStep, timeLeft]);

  const formatCountdown = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const checkRegistration = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('event_registrations')
        .select('*')
        .eq('event_id', event.id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) {
        setHasRegistered(true);
        setTicketData({
          ticketCode: `FP-${event.id.slice(0, 4).toUpperCase()}-${user.id.slice(0, 4).toUpperCase()}`,
          bibNumber: `#${Math.floor(1000 + Math.random() * 9000)}`,
        });
      }
    } catch (e) {
      console.log('Error checking registration:', e);
    } finally {
      setCheckingRegistration(false);
    }
  };

  const handleStartCheckout = () => {
    if (event.price === 0) {
      // Event gratis -> langsung daftar
      processRegistration('Gratis', 0);
    } else {
      // Event berbayar -> buka modal pembayaran
      setPaymentStep('method');
      setTimeLeft(899);
      setPaymentModalVisible(true);
    }
  };

  const processRegistration = async (method: string, amount: number) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert("Perhatian", "Anda harus login untuk mendaftar event.");
        return;
      }

      const ticketCode = `FP-${event.id.slice(0, 4).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const bibNumber = `#${Math.floor(100 + Math.random() * 900)}`;

      const { error } = await supabase
        .from('event_registrations')
        .insert([
          {
            event_id: event.id,
            user_id: user.id,
            status: 'confirmed',
          }
        ]);

      if (error && error.code !== '23505') {
        throw error;
      }

      setHasRegistered(true);
      setTicketData({ ticketCode, bibNumber, method, amount });
      setPaymentStep('success');
    } catch (error: any) {
      Alert.alert("Gagal Memproses Pembayaran", error.message);
    } finally {
      setLoading(false);
    }
  };

  const eventDateStr = new Date(event.date).toLocaleDateString('id-ID', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Image 
          source={{ uri: event.image_url || 'https://images.unsplash.com/photo-1530549387789-4c1017266635?auto=format&fit=crop&w=800&q=80' }} 
          style={styles.headerImage} 
        />
        
        <View style={styles.content}>
          <View style={styles.badgeRow}>
            <View style={styles.typePill}>
              <Ionicons name="trophy" size={12} color="#000000" style={{ marginRight: 4 }} />
              <Text style={styles.typePillText}>EVENT RESMI</Text>
            </View>
            <View style={styles.verifiedOrganizerPill}>
              <Ionicons name="checkmark-circle" size={13} color="#D7FF00" style={{ marginRight: 3 }} />
              <Text style={styles.verifiedOrganizerText}>PANITIA TERVERIFIKASI</Text>
            </View>
          </View>

          <Text style={styles.title}>{event.title}</Text>
          
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={18} color="#D7FF00" style={{ marginRight: 8 }} />
            <Text style={styles.infoText}>{eventDateStr}</Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={18} color="#D7FF00" style={{ marginRight: 8 }} />
            <Text style={styles.infoText}>Gelora Bung Karno / Lintasan Terbuka</Text>
          </View>

          {/* HARGA TIKET */}
          <View style={styles.priceContainer}>
            <View>
              <Text style={styles.priceLabel}>BIAYA REGISTRASI</Text>
              <Text style={styles.priceValue}>
                {event.price === 0 ? 'GRATIS' : `Rp ${event.price.toLocaleString('id-ID')}`}
              </Text>
            </View>
            <View style={styles.slotBadge}>
              <Text style={styles.slotBadgeText}>Slot Terbatas</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>TENTANG EVENT INI</Text>
          <Text style={styles.description}>{event.description}</Text>

          <View style={styles.facilityBox}>
            <Text style={styles.facilityTitle}>Fasilitas Peserta:</Text>
            <Text style={styles.facilityItem}>✓ Jersey Eksklusif Flex Pace Event</Text>
            <Text style={styles.facilityItem}>✓ Nomor Dada (BIB) Terverifikasi</Text>
            <Text style={styles.facilityItem}>✓ Medali Finisher Logam</Text>
            <Text style={styles.facilityItem}>✓ Refreshment & Water Station Tiap 2.5 KM</Text>
          </View>
        </View>
      </ScrollView>

      {/* FOOTER ACTION BUTTON */}
      <View style={styles.footer}>
        {checkingRegistration ? (
          <ActivityIndicator color="#D7FF00" />
        ) : hasRegistered ? (
          <View style={styles.registeredBadge}>
            <Ionicons name="checkmark-circle" size={22} color="#000000" style={{ marginRight: 8 }} />
            <Text style={styles.registeredText}>Tiket & BIB Anda Telah Aktif</Text>
          </View>
        ) : (
          <TouchableOpacity 
            style={styles.payButton} 
            onPress={handleStartCheckout} 
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#000000" />
            ) : (
              <View style={styles.payBtnRow}>
                <Ionicons name="card-outline" size={20} color="#000000" style={{ marginRight: 8 }} />
                <Text style={styles.payButtonText}>
                  {event.price > 0 ? `Beli Tiket • Rp ${event.price.toLocaleString('id-ID')}` : 'Daftar Sekarang (Gratis)'}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* MODAL CHECKOUT & PEMBAYARAN GATEWAY */}
      <Modal
        visible={paymentModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setPaymentModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.paymentModalCard}>
            
            {/* HEADER MODAL */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderTitle}>
                {paymentStep === 'method' ? 'PILIH METODE PEMBAYARAN' : paymentStep === 'pay' ? 'PEMBAYARAN' : 'E-TIKET AKTIF'}
              </Text>
              <TouchableOpacity onPress={() => setPaymentModalVisible(false)} style={{ padding: 4 }}>
                <Ionicons name="close" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {/* STEP 1: PILIH METODE PEMBAYARAN */}
            {paymentStep === 'method' && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.orderSummaryBox}>
                  <Text style={styles.summaryEventTitle}>{event.title}</Text>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLbl}>Harga Tiket:</Text>
                    <Text style={styles.summaryVal}>Rp {event.price.toLocaleString('id-ID')}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLbl}>Biaya Platform:</Text>
                    <Text style={[styles.summaryVal, { color: '#30D158' }]}>GRATIS (Promo)</Text>
                  </View>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryRow}>
                    <Text style={styles.totalLbl}>Total Tagihan:</Text>
                    <Text style={styles.totalVal}>Rp {event.price.toLocaleString('id-ID')}</Text>
                  </View>
                </View>

                <Text style={styles.paymentGroupLabel}>METODE INSTAN & QRIS</Text>
                
                <TouchableOpacity 
                  style={[styles.methodCard, selectedMethod === 'qris' && styles.methodCardActive]}
                  onPress={() => setSelectedMethod('qris')}
                >
                  <View style={styles.methodIconBadge}>
                    <Ionicons name="qr-code" size={20} color="#000000" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.methodName}>QRIS (GoPay, OVO, Dana, ShopeePay)</Text>
                    <Text style={styles.methodDesc}>Pindai langsung dari aplikasi bank atau e-wallet mana saja</Text>
                  </View>
                  <Ionicons 
                    name={selectedMethod === 'qris' ? "radio-button-on" : "radio-button-off"} 
                    size={20} 
                    color={selectedMethod === 'qris' ? "#D7FF00" : "#555"} 
                  />
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.methodCard, selectedMethod === 'gopay' && styles.methodCardActive]}
                  onPress={() => setSelectedMethod('gopay')}
                >
                  <View style={[styles.methodIconBadge, { backgroundColor: '#00AED6' }]}>
                    <Ionicons name="wallet-outline" size={20} color="#FFFFFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.methodName}>GoPay / GoPay Coins</Text>
                    <Text style={styles.methodDesc}>Pembayaran otomatis 1-klik</Text>
                  </View>
                  <Ionicons 
                    name={selectedMethod === 'gopay' ? "radio-button-on" : "radio-button-off"} 
                    size={20} 
                    color={selectedMethod === 'gopay' ? "#D7FF00" : "#555"} 
                  />
                </TouchableOpacity>

                <Text style={styles.paymentGroupLabel}>VIRTUAL ACCOUNT (TRANSFER BANK)</Text>

                <TouchableOpacity 
                  style={[styles.methodCard, selectedMethod === 'bca_va' && styles.methodCardActive]}
                  onPress={() => setSelectedMethod('bca_va')}
                >
                  <View style={[styles.methodIconBadge, { backgroundColor: '#0060AF' }]}>
                    <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 10 }}>BCA</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.methodName}>BCA Virtual Account</Text>
                    <Text style={styles.methodDesc}>Verifikasi instan 24 jam</Text>
                  </View>
                  <Ionicons 
                    name={selectedMethod === 'bca_va' ? "radio-button-on" : "radio-button-off"} 
                    size={20} 
                    color={selectedMethod === 'bca_va' ? "#D7FF00" : "#555"} 
                  />
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.methodCard, selectedMethod === 'mandiri_va' && styles.methodCardActive]}
                  onPress={() => setSelectedMethod('mandiri_va')}
                >
                  <View style={[styles.methodIconBadge, { backgroundColor: '#F5A623' }]}>
                    <Text style={{ color: '#000000', fontWeight: '900', fontSize: 9 }}>MANDIRI</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.methodName}>Mandiri Virtual Account</Text>
                    <Text style={styles.methodDesc}>Verifikasi otomatis via Livin'</Text>
                  </View>
                  <Ionicons 
                    name={selectedMethod === 'mandiri_va' ? "radio-button-on" : "radio-button-off"} 
                    size={20} 
                    color={selectedMethod === 'mandiri_va' ? "#D7FF00" : "#555"} 
                  />
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.continuePayBtn}
                  onPress={() => setPaymentStep('pay')}
                  activeOpacity={0.85}
                >
                  <Text style={styles.continuePayBtnText}>Lanjutkan Pembayaran</Text>
                  <Ionicons name="arrow-forward" size={18} color="#000000" style={{ marginLeft: 6 }} />
                </TouchableOpacity>
              </ScrollView>
            )}

            {/* STEP 2: TAMPILAN PEMBAYARAN (QRIS / VA) */}
            {paymentStep === 'pay' && (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center' }}>
                <View style={styles.countdownBadge}>
                  <Ionicons name="timer-outline" size={16} color="#FF9F0A" style={{ marginRight: 6 }} />
                  <Text style={styles.countdownText}>Selesaikan dalam {formatCountdown(timeLeft)}</Text>
                </View>

                {selectedMethod === 'qris' ? (
                  // TAMPILAN QRIS
                  <View style={styles.qrisDisplayCard}>
                    <View style={styles.qrisHeaderRow}>
                      <Text style={styles.qrisBrandText}>QRIS STANDAR NASIONAL</Text>
                      <Text style={styles.qrisNmid}>NMID: ID1029384756</Text>
                    </View>

                    <View style={styles.qrCodeFrame}>
                      <Ionicons name="qr-code" size={190} color="#000000" />
                    </View>

                    <Text style={styles.qrisTotalAmount}>
                      Rp {event.price.toLocaleString('id-ID')}
                    </Text>
                    <Text style={styles.qrisInstruction}>
                      Buka aplikasi BCA / GoPay / OVO / Dana / ShopeePay lalu pindai kode QR di atas.
                    </Text>
                  </View>
                ) : (
                  // TAMPILAN VIRTUAL ACCOUNT
                  <View style={styles.vaDisplayCard}>
                    <Text style={styles.vaBankName}>
                      {selectedMethod === 'bca_va' ? 'BCA VIRTUAL ACCOUNT' : 'MANDIRI VIRTUAL ACCOUNT'}
                    </Text>
                    <Text style={styles.vaNumber}>8801 2948 5729 1048</Text>
                    <TouchableOpacity 
                      style={styles.copyVaBtn}
                      onPress={() => Alert.alert('Nomor VA Tersalin', '8801294857291048')}
                    >
                      <Ionicons name="copy-outline" size={16} color="#D7FF00" style={{ marginRight: 4 }} />
                      <Text style={styles.copyVaText}>Salin Nomor VA</Text>
                    </TouchableOpacity>

                    <View style={styles.vaInstructions}>
                      <Text style={styles.vaInstructionItem}>1. Buka m-Banking atau ATM bank Anda.</Text>
                      <Text style={styles.vaInstructionItem}>2. Pilih menu Transfer Virtual Account.</Text>
                      <Text style={styles.vaInstructionItem}>3. Masukkan nomor VA di atas & konfirmasi pembayaran.</Text>
                    </View>
                  </View>
                )}

                {/* SIMULASI PEMBAYARAN SELESAI */}
                <TouchableOpacity 
                  style={styles.confirmPayBtn}
                  onPress={() => processRegistration(selectedMethod.toUpperCase(), event.price)}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator color="#000000" />
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons name="checkmark-done" size={20} color="#000000" style={{ marginRight: 6 }} />
                      <Text style={styles.confirmPayBtnText}>Simulasi Pembayaran Berhasil</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </ScrollView>
            )}

            {/* STEP 3: E-TIKET SUKSES */}
            {paymentStep === 'success' && (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center' }}>
                <View style={styles.ticketCard}>
                  <View style={styles.ticketGlow} />
                  <View style={styles.ticketHeader}>
                    <Image source={require('../../assets/icon.png')} style={{ width: 28, height: 28, borderRadius: 6, marginRight: 8 }} />
                    <Text style={styles.ticketHeaderBrand}>FLEX PACE OFFICIAL E-TICKET</Text>
                  </View>

                  <Text style={styles.ticketTitle}>{event.title}</Text>
                  <Text style={styles.ticketDate}>{eventDateStr}</Text>

                  <View style={styles.ticketCutoutDivider}>
                    <View style={styles.cutoutLeft} />
                    <View style={styles.dashedLine} />
                    <View style={styles.cutoutRight} />
                  </View>

                  <View style={styles.bibSection}>
                    <Text style={styles.bibLabel}>NOMOR DADA PESERTA (BIB)</Text>
                    <Text style={styles.bibNumber}>{ticketData?.bibNumber || '#0481'}</Text>
                    <Text style={styles.ticketCode}>KODE TIKET: {ticketData?.ticketCode || 'FP-EVT-9281'}</Text>
                  </View>

                  <View style={styles.qrVerifyFrame}>
                    <Ionicons name="qr-code" size={100} color="#FFFFFF" />
                    <Text style={styles.qrVerifyText}>Pindai QR ini di meja registrasi event</Text>
                  </View>
                </View>

                <TouchableOpacity 
                  style={styles.doneBtn}
                  onPress={() => setPaymentModalVisible(false)}
                >
                  <Text style={styles.doneBtnText}>Tutup & Lihat Tiket</Text>
                </TouchableOpacity>
              </ScrollView>
            )}

          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0C',
  },
  headerImage: {
    width: '100%',
    height: 250,
    backgroundColor: '#111111',
  },
  content: {
    padding: 20,
    paddingBottom: 100,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D7FF00',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginRight: 8,
  },
  typePillText: {
    color: '#000000',
    fontWeight: '900',
    fontSize: 10,
  },
  verifiedOrganizerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(215, 255, 0, 0.1)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(215, 255, 0, 0.25)',
  },
  verifiedOrganizerText: {
    color: '#D7FF00',
    fontSize: 9,
    fontWeight: '800',
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.2,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoText: {
    color: '#D4D4D8',
    fontSize: 14,
    fontWeight: '500',
  },
  priceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#141418',
    padding: 16,
    borderRadius: 16,
    marginVertical: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  priceLabel: {
    fontSize: 10,
    color: '#71717A',
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  priceValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#D7FF00',
    marginTop: 2,
  },
  slotBadge: {
    backgroundColor: 'rgba(255, 59, 48, 0.15)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.3)',
  },
  slotBadgeText: {
    color: '#FF453A',
    fontWeight: '800',
    fontSize: 11,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#71717A',
    letterSpacing: 0.8,
    marginTop: 10,
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    lineHeight: 22,
    color: '#A1A1AA',
    marginBottom: 20,
  },
  facilityBox: {
    backgroundColor: '#131317',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  facilityTitle: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
    marginBottom: 8,
  },
  facilityItem: {
    color: '#A1A1AA',
    fontSize: 12,
    lineHeight: 20,
  },

  // FOOTER
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0E0E12',
    padding: 16,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  payButton: {
    backgroundColor: '#D7FF00',
    paddingVertical: 15,
    borderRadius: 18,
    alignItems: 'center',
    shadowColor: '#D7FF00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  payBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  payButtonText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '900',
  },
  registeredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#30D158',
    paddingVertical: 14,
    borderRadius: 18,
  },
  registeredText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '900',
  },

  // MODAL STYLES
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  paymentModalCard: {
    backgroundColor: '#121216',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingBottom: 14,
    marginBottom: 16,
  },
  modalHeaderTitle: {
    color: '#D7FF00',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  orderSummaryBox: {
    backgroundColor: '#181820',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  summaryEventTitle: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
    marginBottom: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 2,
  },
  summaryLbl: {
    color: '#71717A',
    fontSize: 12,
  },
  summaryVal: {
    color: '#E4E4E7',
    fontSize: 12,
    fontWeight: '600',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: 8,
  },
  totalLbl: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  totalVal: {
    color: '#D7FF00',
    fontWeight: '900',
    fontSize: 16,
  },

  paymentGroupLabel: {
    color: '#71717A',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 8,
    marginTop: 6,
  },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#181820',
    padding: 12,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  methodCardActive: {
    borderColor: '#D7FF00',
    backgroundColor: '#1F1F2A',
  },
  methodIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#D7FF00',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  methodName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  methodDesc: {
    color: '#71717A',
    fontSize: 10,
    marginTop: 2,
  },
  continuePayBtn: {
    flexDirection: 'row',
    backgroundColor: '#D7FF00',
    paddingVertical: 14,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  continuePayBtnText: {
    color: '#000000',
    fontWeight: '900',
    fontSize: 14,
  },

  // QRIS DISPLAY
  countdownBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 159, 10, 0.12)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  countdownText: {
    color: '#FF9F0A',
    fontSize: 12,
    fontWeight: '700',
  },
  qrisDisplayCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    width: '100%',
    marginBottom: 16,
  },
  qrisHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 8,
  },
  qrisBrandText: {
    color: '#000000',
    fontSize: 11,
    fontWeight: '900',
  },
  qrisNmid: {
    color: '#666666',
    fontSize: 9,
  },
  qrCodeFrame: {
    padding: 8,
    backgroundColor: '#FFFFFF',
  },
  qrisTotalAmount: {
    color: '#000000',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 8,
  },
  qrisInstruction: {
    color: '#666666',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 10,
  },

  // VA DISPLAY
  vaDisplayCard: {
    backgroundColor: '#181820',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    width: '100%',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  vaBankName: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  vaNumber: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginVertical: 10,
  },
  copyVaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(215, 255, 0, 0.1)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(215, 255, 0, 0.25)',
  },
  copyVaText: {
    color: '#D7FF00',
    fontSize: 12,
    fontWeight: '800',
  },
  vaInstructions: {
    marginTop: 16,
    width: '100%',
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    paddingTop: 12,
  },
  vaInstructionItem: {
    color: '#A1A1AA',
    fontSize: 11,
    marginVertical: 2,
  },

  confirmPayBtn: {
    backgroundColor: '#D7FF00',
    width: '100%',
    paddingVertical: 14,
    borderRadius: 18,
    alignItems: 'center',
    marginBottom: 20,
  },
  confirmPayBtnText: {
    color: '#000000',
    fontWeight: '900',
    fontSize: 14,
  },

  // TICKET
  ticketCard: {
    backgroundColor: '#16161E',
    borderRadius: 24,
    padding: 20,
    width: '100%',
    borderWidth: 1,
    borderColor: '#D7FF00',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
    marginBottom: 16,
  },
  ticketGlow: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(215, 255, 0, 0.1)',
  },
  ticketHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  ticketHeaderBrand: {
    color: '#D7FF00',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  ticketTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  ticketDate: {
    color: '#A1A1AA',
    fontSize: 12,
    marginTop: 4,
    marginBottom: 16,
  },
  ticketCutoutDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '120%',
    marginVertical: 12,
  },
  cutoutLeft: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#121216',
    marginLeft: -10,
  },
  dashedLine: {
    flex: 1,
    height: 1,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderStyle: 'dashed',
  },
  cutoutRight: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#121216',
    marginRight: -10,
  },
  bibSection: {
    alignItems: 'center',
    marginVertical: 8,
  },
  bibLabel: {
    color: '#71717A',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  bibNumber: {
    color: '#D7FF00',
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: 2,
  },
  ticketCode: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 2,
  },
  qrVerifyFrame: {
    alignItems: 'center',
    marginTop: 14,
  },
  qrVerifyText: {
    color: '#71717A',
    fontSize: 10,
    marginTop: 6,
  },
  doneBtn: {
    backgroundColor: '#D7FF00',
    width: '100%',
    paddingVertical: 14,
    borderRadius: 18,
    alignItems: 'center',
    marginBottom: 20,
  },
  doneBtnText: {
    color: '#000000',
    fontWeight: '900',
    fontSize: 14,
  }
});
