import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  TextInput, 
  Alert, 
  ActivityIndicator, 
  Image, 
  KeyboardAvoidingView, 
  Platform, 
  ScrollView 
} from 'react-native';
import { supabase } from '../lib/supabase';
import { Ionicons } from '@expo/vector-icons';

export default function OnboardingScreen() {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Register Baru
  async function handleSignUp() {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Perhatian', 'Harap isi email dan kata sandi Anda.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Perhatian', 'Kata sandi minimal 6 karakter.');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          data: {
            name: fullName.trim() || email.split('@')[0],
            avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
          }
        }
      });

      if (error) {
        Alert.alert('Registrasi Gagal', error.message);
      } else if (!data.session) {
        Alert.alert('Cek Email Anda', 'Silakan periksa kotak masuk email Anda untuk verifikasi pendaftaran!');
      } else {
        Alert.alert('Selamat Datang!', 'Akun Flex Pace Anda berhasil dibuat.');
      }
    } catch (err: any) {
      Alert.alert('Terjadi Kesalahan', err.message);
    } finally {
      setLoading(false);
    }
  }

  // Login
  async function handleSignIn() {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Perhatian', 'Harap isi email dan kata sandi Anda.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (error) Alert.alert('Login Gagal', error.message);
    } catch (err: any) {
      Alert.alert('Terjadi Kesalahan', err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* HERO LOGO SECTION */}
        <View style={styles.logoSection}>
          <View style={styles.logoWrapper}>
            <Image 
              source={require('../../assets/logo.png')} 
              style={styles.logoImage} 
              resizeMode="contain" 
            />
          </View>
          <Text style={styles.brandTitle}>FLEX PACE</Text>
          <Text style={styles.tagline}>NEXT-GEN ATHLETIC TELEMETRY</Text>
        </View>

        {/* MODE SWITCHER PILL */}
        <View style={styles.switchPillContainer}>
          <TouchableOpacity 
            style={[styles.switchTab, isLoginMode && styles.activeSwitchTab]}
            onPress={() => setIsLoginMode(true)}
            activeOpacity={0.8}
          >
            <Text style={[styles.switchTabText, isLoginMode && styles.activeSwitchTabText]}>
              Masuk
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.switchTab, !isLoginMode && styles.activeSwitchTab]}
            onPress={() => setIsLoginMode(false)}
            activeOpacity={0.8}
          >
            <Text style={[styles.switchTabText, !isLoginMode && styles.activeSwitchTabText]}>
              Daftar Akun
            </Text>
          </TouchableOpacity>
        </View>

        {/* INPUT CARD */}
        <View style={styles.formCard}>
          {!isLoginMode && (
            <>
              <View style={styles.inputRow}>
                <Ionicons name="person-outline" size={20} color="#71717A" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Nama Lengkap"
                  placeholderTextColor="#52525B"
                  value={fullName}
                  onChangeText={setFullName}
                />
              </View>
              <View style={styles.divider} />
            </>
          )}

          <View style={styles.inputRow}>
            <Ionicons name="mail-outline" size={20} color="#71717A" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Alamat Email"
              placeholderTextColor="#52525B"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.inputRow}>
            <Ionicons name="lock-closed-outline" size={20} color="#71717A" style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Kata Sandi"
              placeholderTextColor="#52525B"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
              <Ionicons 
                name={showPassword ? "eye-outline" : "eye-off-outline"} 
                size={20} 
                color="#71717A" 
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* CTA SUBMIT BUTTON */}
        <TouchableOpacity 
          style={styles.submitButton} 
          onPress={isLoginMode ? handleSignIn : handleSignUp}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#000000" />
          ) : (
            <View style={styles.btnContent}>
              <Text style={styles.submitButtonText}>
                {isLoginMode ? 'Mulai Sesi Olahraga' : 'Bergabung dengan Flex Pace'}
              </Text>
              <Ionicons name="arrow-forward" size={18} color="#000000" style={{ marginLeft: 8 }} />
            </View>
          )}
        </TouchableOpacity>

        {/* FEATURE PILL HIGHLIGHTS */}
        <View style={styles.featuresRow}>
          <View style={styles.featurePill}>
            <Ionicons name="navigate-outline" size={14} color="#D7FF00" />
            <Text style={styles.featureText}>GPS Tracking</Text>
          </View>
          <View style={styles.featurePill}>
            <Ionicons name="camera-outline" size={14} color="#D7FF00" />
            <Text style={styles.featureText}>Feed Atlet</Text>
          </View>
          <View style={styles.featurePill}>
            <Ionicons name="trophy-outline" size={14} color="#D7FF00" />
            <Text style={styles.featureText}>Event Komunitas</Text>
          </View>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0C',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
    alignItems: 'center',
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logoWrapper: {
    width: 140,
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#D7FF00',
    letterSpacing: 4,
  },
  tagline: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    marginTop: 4,
  },
  switchPillContainer: {
    flexDirection: 'row',
    backgroundColor: '#141418',
    borderRadius: 22,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    width: '100%',
    marginBottom: 20,
  },
  switchTab: {
    flex: 1,
    paddingVertical: 11,
    alignItems: 'center',
    borderRadius: 18,
  },
  activeSwitchTab: {
    backgroundColor: '#D7FF00',
    shadowColor: '#D7FF00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  switchTabText: {
    color: '#71717A',
    fontWeight: '700',
    fontSize: 14,
  },
  activeSwitchTabText: {
    color: '#000000',
    fontWeight: '900',
  },
  formCard: {
    width: '100%',
    backgroundColor: '#141418',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginBottom: 24,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
  },
  eyeButton: {
    padding: 6,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  submitButton: {
    width: '100%',
    backgroundColor: '#D7FF00',
    paddingVertical: 16,
    borderRadius: 22,
    alignItems: 'center',
    shadowColor: '#D7FF00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
    marginBottom: 30,
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  featuresRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 8,
  },
  featurePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  featureText: {
    color: '#A1A1AA',
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 6,
  }
});
