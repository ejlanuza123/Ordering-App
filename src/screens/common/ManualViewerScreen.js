import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, TextInput, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MANUAL_LINKS } from '../../constants/manuals';

export default function ManualViewerScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const role = route?.params?.role === 'rider' ? 'rider' : 'customer';
  const manual = MANUAL_LINKS[role];
  const accentColor = role === 'rider' ? '#ED2939' : '#0033A0';
  const [searchQuery, setSearchQuery] = useState('');
  const [checklistMode, setChecklistMode] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState({});
  const [completedSteps, setCompletedSteps] = useState({});

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredSections = useMemo(() => {
    if (!normalizedQuery) return manual.sections;

    return manual.sections
      .map((section) => {
        const headingMatches = section.heading.toLowerCase().includes(normalizedQuery);
        const filteredSteps = headingMatches
          ? section.steps
          : section.steps.filter((step) => step.toLowerCase().includes(normalizedQuery));

        return {
          ...section,
          steps: filteredSteps,
        };
      })
      .filter((section) => section.steps.length > 0);
  }, [manual.sections, normalizedQuery]);

  const toggleSection = (heading) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [heading]: !prev[heading],
    }));
  };

  const toggleStepDone = (stepKey) => {
    setCompletedSteps((prev) => ({
      ...prev,
      [stepKey]: !prev[stepKey],
    }));
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#0033A0" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>User Manual</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}>
        <View style={[styles.titleCard, { backgroundColor: accentColor }]}>
          <View style={styles.titleBlobA} />
          <View style={styles.titleBlobB} />
          <Text style={styles.title}>{manual.title}</Text>
          <Text style={styles.subtitle}>Last updated: April 2026</Text>
        </View>

        <View style={styles.controlsCard}>
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={18} color="#64748b" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search steps or topics"
              placeholderTextColor="#94A3B8"
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchButton}>
                <Ionicons name="close-circle" size={18} color="#94A3B8" />
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.controlsRow}>
            <Text style={styles.resultsText}>
              {filteredSections.length} {filteredSections.length === 1 ? 'section' : 'sections'}
            </Text>
            <View style={styles.checklistToggleWrap}>
              <Text style={styles.checklistLabel}>Checklist mode</Text>
              <Switch
                value={checklistMode}
                onValueChange={setChecklistMode}
                trackColor={{ false: '#E2E8F0', true: `${accentColor}66` }}
                thumbColor={checklistMode ? accentColor : '#fff'}
              />
            </View>
          </View>
        </View>

        {filteredSections.map((section, sectionIndex) => {
          const isCollapsed = !!collapsedSections[section.heading];

          return (
          <View key={section.heading} style={styles.sectionCard}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => toggleSection(section.heading)}
              style={styles.sectionHeaderTouch}
            >
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionLeftMeta}>
                  <View style={[styles.sectionIconWrap, { backgroundColor: `${accentColor}14` }]}>
                    <Ionicons
                      name={section.icon || 'document-text-outline'}
                      size={15}
                      color={accentColor}
                    />
                  </View>
                  <View style={[styles.sectionChip, { backgroundColor: `${accentColor}1A` }]}> 
                    <Text style={[styles.sectionChipText, { color: accentColor }]}>Section {sectionIndex + 1}</Text>
                  </View>
                </View>
                <Ionicons
                  name={isCollapsed ? 'chevron-down' : 'chevron-up'}
                  size={18}
                  color={accentColor}
                />
              </View>
              <Text style={styles.sectionHeading}>{section.heading}</Text>
            </TouchableOpacity>

            {!isCollapsed
              ? section.steps.map((step, index) => {
                  const stepKey = `${section.heading}-${index}`;
                  const done = !!completedSteps[stepKey];

                  return (
                    <View key={stepKey} style={styles.stepRow}>
                      {checklistMode ? (
                        <TouchableOpacity
                          onPress={() => toggleStepDone(stepKey)}
                          style={[
                            styles.checkbox,
                            done && { backgroundColor: `${accentColor}1A`, borderColor: accentColor },
                          ]}
                        >
                          {done ? <Ionicons name="checkmark" size={14} color={accentColor} /> : null}
                        </TouchableOpacity>
                      ) : (
                        <View style={[styles.stepIndexBadge, { backgroundColor: `${accentColor}14` }]}> 
                          <Text style={[styles.stepIndex, { color: accentColor }]}>{index + 1}</Text>
                        </View>
                      )}

                      <Text style={[styles.stepText, done && styles.stepTextDone]}>{step}</Text>
                    </View>
                  );
                })
              : null}
          </View>
          );
        })}
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
  controlsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#DFE7F4',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#0f172a',
    fontSize: 13,
    paddingVertical: 10,
  },
  clearSearchButton: {
    paddingLeft: 8,
  },
  controlsRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resultsText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  checklistToggleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checklistLabel: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
  },
  titleCard: {
    borderRadius: 20,
    padding: 16,
    overflow: 'hidden',
  },
  titleBlobA: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.13)',
    top: -34,
    right: -24,
  },
  titleBlobB: {
    position: 'absolute',
    width: 85,
    height: 85,
    borderRadius: 42,
    backgroundColor: 'rgba(255,255,255,0.08)',
    bottom: -26,
    left: -16,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
  },
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#DFE7F4',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  sectionHeaderTouch: {
    borderRadius: 10,
    paddingBottom: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionLeftMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  sectionChipText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 12,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginTop: 1,
    backgroundColor: '#fff',
  },
  stepIndexBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginTop: 1,
  },
  stepIndex: {
    fontSize: 12,
    fontWeight: '700',
  },
  stepText: {
    flex: 1,
    color: '#334155',
    fontSize: 13,
    lineHeight: 20,
  },
  stepTextDone: {
    color: '#94A3B8',
    textDecorationLine: 'line-through',
  },
});
