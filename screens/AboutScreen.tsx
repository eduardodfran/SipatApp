import { Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

type Props = {
  onBack: () => void
}

const TEAM = [
  { name: 'Eduardo Fran', role: 'Leader & Main Programmer', initials: 'EF' },
  { name: 'Allan McCarl Cabase', role: 'Team Member', initials: 'AC' },
  { name: 'James Aldrine Taylaran', role: 'Team Member', initials: 'JT' },
  { name: 'Jasmerl Ligan', role: 'Team Member', initials: 'JL' },
]

const FEATURES = [
  {
    title: 'Mobile Recording + AI Detection',
    description: 'Record your ride with the app. Our AI analyzes every frame for potholes, cracks, and road distress.',
    color: '#06b6d4',
  },
  {
    title: 'Live Hazard Map',
    description: 'View all detected hazards on an interactive map with severity coloring, heatmap visualization, and location-based filtering.',
    color: '#22c55e',
  },
  {
    title: 'Community Photo Reports',
    description: 'Anyone can submit road photos. Our AI automatically detects and classifies hazards from community submissions.',
    color: '#f59e0b',
  },
]

const PIPELINE_STEPS = [
  { number: '01', title: 'Record', description: 'The app records 3 x 5-minute segments with GPS telemetry', color: '#06b6d4' },
  { number: '02', title: 'Upload', description: 'Each segment uploads automatically to Azure cloud storage', color: '#22c55e' },
  { number: '03', title: 'Process', description: 'AI detects hazards, measures real-world area, severity is classified', color: '#f59e0b' },
  { number: '04', title: 'Map', description: 'Hazards appear on the map with severity, location, and detection details', color: '#06b6d4' },
]

const SEVERITY = [
  { level: 'Minor', color: '#22c55e', threshold: 'IPM area < 0.03m²', description: 'Surface distress, cosmetic damage' },
  { level: 'Moderate', color: '#f59e0b', threshold: 'IPM area 0.03–0.17m²', description: 'Noticeable hazard, vehicle impact' },
  { level: 'Severe', color: '#ef4444', threshold: 'IPM area > 0.17m²', description: 'Critical hazard, safety risk' },
]

const RESOURCES = [
  { title: 'GitHub Repository', description: 'github.com/topics/sipat', url: 'https://github.com/topics/sipat', icon: 'logo-github' as const },
  { title: 'Live Web Dashboard', description: 'sipat.app', url: 'https://sipat.app', icon: 'globe-outline' as const },
]

export default function AboutScreen({ onBack }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color="#fafafa" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>About</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Hero */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ABOUT SIPAT</Text>
          <Text style={styles.heroTitle}>Born from the road.</Text>
          <Text style={styles.heroSubtitle}>System for Infrastructure Pothole Assessment Technology</Text>
          <Text style={styles.heroDesc}>
            We are 4 motorcycle riders studying Computer Science at Taguig City University. Two of us are delivery and moto taxi riders. Every day we face potholes, cracks, and road distress — and we wondered: how are these actually monitored? So we built SIPAT, a community-based road hazard detection system.
          </Text>
        </View>

        {/* Team */}
        <View style={styles.section}>
          <View style={styles.teamGrid}>
            {TEAM.map((member) => (
              <View key={member.initials} style={styles.teamCard}>
                <View style={styles.teamAvatar}>
                  <Text style={styles.teamInitial}>{member.initials}</Text>
                </View>
                <Text style={styles.teamName}>{member.name}</Text>
                <Text style={styles.teamRole}>{member.role}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.teamSchool}>Taguig City University — Computer Science, 4th Year</Text>
        </View>

        <View style={styles.divider} />

        {/* What is SIPAT */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>WHAT IS SIPAT</Text>
          <Text style={styles.sectionTitle}>Detect. Map. Prevent.</Text>
          <Text style={styles.sectionDesc}>
            SIPAT is an AI-powered road hazard intelligence platform for the Philippines. It combines dashcam-based detection, community reporting, and interactive mapping to monitor road conditions in real time.
          </Text>
          <View style={styles.featureList}>
            {FEATURES.map((f) => (
              <View key={f.title} style={styles.featureCard}>
                <View style={[styles.featureDot, { backgroundColor: f.color }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.featureTitle}>{f.title}</Text>
                  <Text style={styles.featureDesc}>{f.description}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.divider} />

        {/* Pipeline */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>DATA PIPELINE</Text>
          <Text style={styles.sectionTitle}>From road to results</Text>
          <View style={styles.pipelineList}>
            {PIPELINE_STEPS.map((step) => (
              <View key={step.number} style={styles.pipelineStep}>
                <View style={[styles.pipelineNum, { backgroundColor: step.color }]}>
                  <Text style={styles.pipelineNumText}>{step.number}</Text>
                </View>
                <View style={styles.pipelineLine} />
                <View style={styles.pipelineContent}>
                  <Text style={styles.pipelineTitle}>{step.title}</Text>
                  <Text style={styles.pipelineDesc}>{step.description}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.divider} />

        {/* Severity */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>STANDARDS</Text>
          <Text style={styles.sectionTitle}>Severity Classification</Text>
          <Text style={styles.sectionDesc}>Based on DPWH D.O. No. 120 s. 2019 (adopting FHWA LTPP Distress ID Manual)</Text>
          <View style={styles.severityList}>
            {SEVERITY.map((s) => (
              <View key={s.level} style={[styles.severityCard, { borderColor: s.color + '40' }]}>
                <View style={styles.severityHeader}>
                  <View style={[styles.severityDot, { backgroundColor: s.color }]} />
                  <Text style={[styles.severityLevel, { color: s.color }]}>{s.level}</Text>
                </View>
                <Text style={styles.severityThreshold}>{s.threshold}</Text>
                <Text style={styles.severityDesc}>{s.description}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.severityNote}>Confidence-based capping ensures low-confidence detections are conservatively classified.</Text>
        </View>

        <View style={styles.divider} />

        {/* Resources */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>RESOURCES</Text>
          <Text style={styles.sectionTitle}>Explore SIPAT</Text>
          <View style={styles.resourceList}>
            {RESOURCES.map((r) => (
              <TouchableOpacity
                key={r.title}
                style={styles.resourceCard}
                activeOpacity={0.7}
                onPress={() => Linking.openURL(r.url)}
              >
                <Ionicons name={r.icon} size={20} color="#06b6d4" />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.resourceTitle}>{r.title}</Text>
                  <Text style={styles.resourceDesc}>{r.description}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#71717a" />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Thesis note */}
        <View style={styles.thesisNote}>
          <Text style={styles.thesisText}>
            SIPAT was built as a thesis project at Taguig City University. It demonstrates how AI and community engagement can improve road safety monitoring in the Philippines.
          </Text>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0c0c14' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 56 : 36,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  headerTitle: { color: '#fafafa', fontSize: 16, fontWeight: '700' },
  scroll: { flex: 1 },
  section: { paddingHorizontal: 20, paddingVertical: 20 },
  sectionLabel: { color: '#06b6d4', fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8 },
  sectionTitle: { color: '#fafafa', fontSize: 24, fontWeight: '800', marginBottom: 8 },
  sectionDesc: { color: '#a1a1aa', fontSize: 14, lineHeight: 22, marginBottom: 16 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginHorizontal: 20 },

  // Hero
  heroTitle: { color: '#fafafa', fontSize: 28, fontWeight: '800', marginBottom: 4 },
  heroSubtitle: { color: '#a1a1aa', fontSize: 14, marginBottom: 16 },
  heroDesc: { color: '#71717a', fontSize: 14, lineHeight: 22 },

  // Team
  teamGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  teamCard: { width: '48%', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  teamAvatar: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(6,182,212,0.12)', justifyContent: 'center', alignItems: 'center' },
  teamInitial: { color: '#06b6d4', fontSize: 14, fontWeight: '800' },
  teamName: { color: '#fafafa', fontSize: 13, fontWeight: '700', marginTop: 8 },
  teamRole: { color: '#71717a', fontSize: 11, marginTop: 2 },
  teamSchool: { color: '#71717a', fontSize: 12, textAlign: 'center' },

  // Features
  featureList: { gap: 10 },
  featureCard: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', gap: 12 },
  featureDot: { width: 4, height: 4, borderRadius: 2, marginTop: 6 },
  featureTitle: { color: '#fafafa', fontSize: 14, fontWeight: '700' },
  featureDesc: { color: '#71717a', fontSize: 12, lineHeight: 18, marginTop: 4 },

  // Pipeline
  pipelineList: { gap: 0 },
  pipelineStep: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, position: 'relative' },
  pipelineNum: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', zIndex: 1 },
  pipelineNumText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  pipelineLine: { position: 'absolute', left: 15, top: 32, bottom: -20, width: 2, backgroundColor: 'rgba(255,255,255,0.06)' },
  pipelineContent: { flex: 1, paddingBottom: 20 },
  pipelineTitle: { color: '#fafafa', fontSize: 14, fontWeight: '700' },
  pipelineDesc: { color: '#71717a', fontSize: 12, lineHeight: 18, marginTop: 2 },

  // Severity
  severityList: { gap: 10 },
  severityCard: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 14, borderWidth: 1 },
  severityHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  severityDot: { width: 8, height: 8, borderRadius: 4 },
  severityLevel: { fontSize: 14, fontWeight: '700' },
  severityThreshold: { color: '#fafafa', fontSize: 16, fontWeight: '800', marginTop: 8 },
  severityDesc: { color: '#71717a', fontSize: 12, marginTop: 4 },
  severityNote: { color: '#71717a', fontSize: 12, marginTop: 12, textAlign: 'center' },

  // Resources
  resourceList: { gap: 10 },
  resourceCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  resourceTitle: { color: '#fafafa', fontSize: 14, fontWeight: '700' },
  resourceDesc: { color: '#71717a', fontSize: 12, marginTop: 2 },

  // Thesis
  thesisNote: { marginHorizontal: 20, marginTop: 24, marginBottom: 40, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  thesisText: { color: '#a1a1aa', fontSize: 13, lineHeight: 20, textAlign: 'center' },
})
