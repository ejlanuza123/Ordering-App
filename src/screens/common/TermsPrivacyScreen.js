import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TERMS_SECTIONS = [
  {
    title: '1. Acceptance of Terms',
    items: [
      'By creating an account or using this app, you agree to these Terms and Privacy Policy.',
      'If you do not agree with these terms, please stop using the service immediately.',
      'These terms apply to both customer and rider users of the mobile app.',
    ],
  },
  {
    title: '2. Service Scope',
    items: [
      'The app provides order placement, delivery tracking, account management, and support workflows for Petron San Pedro.',
      'Service coverage, delivery windows, and product availability may change without prior notice.',
      'We may add, remove, or update features to improve operational performance and safety.',
    ],
  },
  {
    title: '3. Account Responsibilities',
    items: [
      'You must provide accurate information during registration and profile updates.',
      'You are responsible for keeping your credentials secure and confidential.',
      'You must immediately report suspicious account activity or unauthorized access.',
      'Rider accounts are created by admin only and cannot self-register in mobile app.',
    ],
  },
  {
    title: '4. Orders, Delivery, and Payment',
    items: [
      'Customers must verify order details, address, and payment method before submission.',
      'Delivery fees, processing times, and status updates depend on active operations and rider availability.',
      'Orders may be delayed, cancelled, or re-routed in case of safety concerns, wrong addresses, or operational disruption.',
      'Submitted order records and status history are maintained for operational and support purposes.',
    ],
  },
  {
    title: '5. Prohibited Conduct',
    items: [
      'You may not use the app for fraudulent, abusive, or illegal activity.',
      'You may not attempt to bypass role restrictions, security controls, or account validation rules.',
      'You may not upload malicious files, harmful content, or false records into the system.',
    ],
  },
  {
    title: '6. Suspension and Termination',
    items: [
      'We may suspend or terminate accounts that violate policy, create operational risk, or compromise security.',
      'We may restrict features during investigations, maintenance, or abuse prevention.',
      'Users may request account deactivation through official support channels.',
    ],
  },
  {
    title: '7. Liability and Service Availability',
    items: [
      'We work to keep services accurate and available, but uninterrupted operation is not guaranteed at all times.',
      'We are not liable for delays or losses caused by force majeure, network failure, third-party outages, or user-provided incorrect data.',
      'Your use of the app is at your own responsibility within applicable law.',
    ],
  },
  {
    title: '8. Updates to Terms',
    items: [
      'These terms may be revised periodically to reflect legal, technical, and operational changes.',
      'Updated terms become effective upon publication in the app.',
      'Continued use of the app means acceptance of the revised terms.',
    ],
  },
];

const PRIVACY_SECTIONS = [
  {
    title: '1. Information We Collect',
    items: [
      'Account data: name, email, phone number, role, and profile details.',
      'Order and delivery data: products, quantity, order history, delivery address, status updates, and proof records.',
      'Device and usage data: app actions, logs, notifications preference, and technical diagnostics.',
      'Location-related data when enabled for address selection, tracking, and delivery operations.',
    ],
  },
  {
    title: '2. How We Use Information',
    items: [
      'To authenticate users and manage role-based access.',
      'To process orders, coordinate deliveries, and provide real-time updates.',
      'To provide support, troubleshoot issues, and improve app reliability.',
      'To maintain operational records, audit logs, and security monitoring.',
    ],
  },
  {
    title: '3. Information Sharing',
    items: [
      'We share limited operational data only as needed between customer, rider, and admin workflows.',
      'We do not sell personal data to third parties.',
      'We may share data when required by law, lawful request, or security incident response.',
    ],
  },
  {
    title: '4. Data Storage and Retention',
    items: [
      'Data is stored in managed infrastructure used for app operation and service continuity.',
      'Operational records are retained based on business and compliance requirements.',
      'When account deletion is processed, data removal follows system and legal retention rules.',
    ],
  },
  {
    title: '5. Security Measures',
    items: [
      'We apply access controls, role restrictions, and database policies to reduce unauthorized access risk.',
      'Despite safeguards, no system can guarantee absolute security.',
      'Users must also protect their own credentials and device access.',
    ],
  },
  {
    title: '6. Your Privacy Choices',
    items: [
      'You can update profile information and contact details in app settings.',
      'You can control notification preferences and certain device permissions.',
      'You can request support for account deactivation or correction concerns.',
    ],
  },
  {
    title: '7. Contact and Support',
    items: [
      'For terms, privacy, or account concerns, contact support@petronsanpedro.com.',
      'For urgent account or delivery security issues, contact admin support immediately through official channels.',
    ],
  },
];

const LegalSection = ({ icon, heading, sections }) => {
  return (
    <View style={styles.blockCard}>
      <View style={styles.blockHeader}>
        <View style={styles.blockIconWrap}>
          <Ionicons name={icon} size={18} color="#0033A0" />
        </View>
        <Text style={styles.blockHeading}>{heading}</Text>
      </View>

      {sections.map((section) => (
        <View key={section.title} style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          {section.items.map((item, index) => (
            <View key={`${section.title}-${index}`} style={styles.itemRow}>
              <Text style={styles.itemBullet}>{index + 1}.</Text>
              <Text style={styles.itemText}>{item}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
};

export default function TermsPrivacyScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#0033A0" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms & Privacy</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.heroCard}>
          <View style={styles.heroBlobA} />
          <View style={styles.heroBlobB} />
          <Text style={styles.heroTitle}>Legal and Privacy Information</Text>
          <Text style={styles.heroSubtitle}>
            Effective Date: April 2026. Please review these terms carefully before continuing to use the app.
          </Text>
        </View>

        <LegalSection icon="document-text-outline" heading="Terms of Service" sections={TERMS_SECTIONS} />
        <LegalSection icon="shield-checkmark-outline" heading="Privacy Policy" sections={PRIVACY_SECTIONS} />
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
    top: -34,
    right: -24,
  },
  heroBlobB: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.08)',
    bottom: -26,
    left: -16,
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
  blockCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DFE7F4',
    padding: 14,
  },
  blockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  blockIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f0f4ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  blockHeading: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '700',
  },
  sectionCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FBFDFF',
    padding: 12,
    marginBottom: 10,
  },
  sectionTitle: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  itemBullet: {
    width: 20,
    color: '#0033A0',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
  itemText: {
    flex: 1,
    color: '#334155',
    fontSize: 12,
    lineHeight: 18,
  },
});
