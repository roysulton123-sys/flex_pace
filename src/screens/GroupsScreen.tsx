import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';

export default function GroupsScreen() {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Clubs</Text>
        <Text style={styles.subtitle}>Join clubs to connect with other athletes.</Text>
        
        <TouchableOpacity style={styles.clubCard}>
          <Image 
            source={{ uri: 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=200&h=200&fit=crop' }} 
            style={styles.clubImage} 
          />
          <View style={styles.clubInfo}>
            <Text style={styles.clubName}>Jakarta Runners</Text>
            <Text style={styles.clubMembers}>1,204 Members</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.clubCard}>
          <Image 
            source={{ uri: 'https://images.unsplash.com/photo-1541625602330-2277a4c46182?w=200&h=200&fit=crop' }} 
            style={styles.clubImage} 
          />
          <View style={styles.clubInfo}>
            <Text style={styles.clubName}>Weekend Cyclists</Text>
            <Text style={styles.clubMembers}>532 Members</Text>
          </View>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  section: {
    padding: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  subtitle: {
    color: 'gray',
    marginBottom: 15,
  },
  clubCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  clubImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  clubInfo: {
    marginLeft: 15,
  },
  clubName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  clubMembers: {
    color: 'gray',
    marginTop: 4,
  },
});
