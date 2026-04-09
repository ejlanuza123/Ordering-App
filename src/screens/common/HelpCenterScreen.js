import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function HelpCenterScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const role = route?.params?.role === 'rider' ? 'rider' : 'customer';
  const roleLabel = role === 'rider' ? 'Rider View' : 'Customer View';

  const openManual = () => {
    navigation.navigate('ManualViewer', { role });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#0033A0" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help Center</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.heroCard}>
          <View style={styles.heroBlobA} />
          <View style={styles.heroBlobB} />
          <View style={styles.roleBadge}>
            <Ionicons name="person-circle-outline" size={14} color="#0033A0" />
            <Text style={styles.roleBadgeText}>{roleLabel}</Text>
          </View>
          <Text style={styles.heroTitle}>Need help using the app?</Text>
          <Text style={styles.heroSubtitle}>
            Open the step-by-step manual for your role and follow the guided workflow.
          </Text>
        </View>

        <TouchableOpacity style={styles.primaryCard} activeOpacity={0.8} onPress={openManual}>
          <View style={styles.primaryIconWrap}>
            <Ionicons name="book-outline" size={24} color="#0033A0" />
          </View>
          <View style={styles.primaryTextWrap}>
            <Text style={styles.primaryTitle}>User Manual</Text>
            <Text style={styles.primarySubtitle}>
              {role === 'rider' ? 'Rider manual and delivery workflow' : 'Customer manual and ordering workflow'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color="#94A3B8" />
        </TouchableOpacity>

        <View style={styles.topicsCard}>
          <Text style={styles.topicsTitle}>Popular Topics</Text>
          <View style={styles.topicsRow}>
            <View style={styles.topicChip}>
              <Ionicons name="log-in-outline" size={14} color="#0033A0" />
              <Text style={styles.topicText}>Login</Text>
            </View>
            <View style={styles.topicChip}>
              <Ionicons name="bag-check-outline" size={14} color="#0033A0" />
              <Text style={styles.topicText}>Orders</Text>
            </View>
            <View style={styles.topicChip}>
              <Ionicons name="alert-circle-outline" size={14} color="#0033A0" />
              <Text style={styles.topicText}>Troubleshoot</Text>
            </View>
          </View>
        </View>

        <View style={styles.tipCard}>
          <Text style={styles.tipTitle}>Quick Support Tip</Text>
          <Text style={styles.tipText}>
            If account access fails or assignments are missing, contact admin support for account verification.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f4ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0033A0',
  },
  content: {
    padding: 16,
    gap: 12,
  },
  heroCard: {
    backgroundColor: '#0033A0',
    borderRadius: 20,
    padding: 16,
    overflow: 'hidden',
  },
  heroBlobA: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.12)',
    top: -30,
    right: -20,
  },
  heroBlobB: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.08)',
    bottom: -30,
    left: -16,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: '#fff',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 10,
  },
  roleBadgeText: {
    color: '#0033A0',
    fontSize: 12,
    fontWeight: '700',
  },
  heroTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 6,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    lineHeight: 18,
  },
  primaryCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#DFE7F4',
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  primaryIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#f0f4ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  primaryTextWrap: {
    flex: 1,
  },
  primaryTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '700',
  },
  primarySubtitle: {
    marginTop: 2,
    color: '#64748b',
    fontSize: 12,
  },
  topicsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#DFE7F4',
  },
  topicsTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },
  topicsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  topicChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0F4FF',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
  },
  topicText: {
    color: '#0033A0',
    fontSize: 12,
    fontWeight: '600',
  },
  tipCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#DFE7F4',
  },
  tipTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
  },
  tipText: {
    color: '#64748b',
    fontSize: 13,
    lineHeight: 18,
  },
});
