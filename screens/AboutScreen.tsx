import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, fonts, radius, spacing } from '../theme/tokens'
import ScreenHeader from '../components/ScreenHeader'
import LaneDivider from '../components/LaneDivider'

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
    color: colors.signal,
  },
  {
    title: 'Live Hazard Map',
    description: 'View all detected hazards on an interactive map with severity coloring, heatmap visualization, and location-based filtering.',
    color: colors.minor,
  },
  {
    title: 'Community Photo Reports',
    description: 'Anyone can submit road photos. Our AI automatically detects and classifies hazards from community submissions.',
    color: colors.moderate,
  },
]

const PIPELINE_STEPS = [
  { number: '01', title: 'Record', description: 'The app records 3 x 5-minute segments with GPS telemetry', color: colors.signal },
  { number: '02', title: 'Upload', description: 'Each segment uploads automatically to Azure cloud storage', color: colors.minor },
  { number: '03', title: 'Process', description: 'AI detects hazards, measures real-world area, severity is classified', color: colors.moderate },
  { number: '04', title: 'Map', description: 'Hazards appear on the map with severity, location, and detection details', color: colors.signal },
]

const SEVERITY = [
  { level: 'Minor', color: colors.minor, threshold: 'IPM area < 0.03m²', description: 'Surface distress, cosmetic damage' },
  { level: 'Moderate', color: colors.moderate, threshold: 'IPM area 0.03–0.17m²', description: 'Noticeable hazard, vehicle impact' },
  { level: 'Severe', color: colors.severe, threshold: 'IPM area > 0.17m²', description: 'Critical hazard, safety risk' },
]

const RESOURCES = [
  { title: 'GitHub Repository', description: 'github.com/topics/sipat', url: 'https://github.com/topics/sipat', icon: 'logo-github' as const },
  { title: 'Live Web Dashboard', description: 'sipat-web.vercel.app', url: 'https://sipat-web.vercel.app', icon: 'globe-outline' as const },
]

export default function AboutScreen({ onBack }: Props) {
  return (
    <View style={styles.container}>
      <ScreenHeader onBack={onBack} title="About" />

      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Hero */}
        <View style={styles.section}>
          <Text style={styles.eyebrow}>ABOUT SIPAT</Text>
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

        <LaneDivider />

        {/* What is SIPAT */}
        <View style={styles.section}>
          <Text style={styles.eyebrow}>WHAT IS SIPAT</Text>
          <Text style={styles.sectionTitle}>Detect. Map. Prevent.</Text>
          <Text style={styles.sectionDesc}>
            SIPAT is an AI-powered road hazard intelligence platform for the Philippines. It combines dashcam-based detection, community reporting, and interactive mapping to monitor road conditions in real time.
          </Text>
          <View style={styles.featureList}>
            {FEATURES.map((f) => (
              <View key={f.title} style={styles.featureCard}>
                <View style={[styles.featureDot, { backgroundColor: f.color }]} />
                <View style={styles.featureBody}>
                  <Text style={styles.featureTitle}>{f.title}</Text>
                  <Text style={styles.featureDesc}>{f.description}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <LaneDivider />

        {/* Pipeline */}
        <View style={styles.section}>
          <Text style={styles.eyebrow}>DATA PIPELINE</Text>
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

        <LaneDivider />

        {/* Severity */}
        <View style={styles.section}>
          <Text style={styles.eyebrow}>STANDARDS</Text>
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

        <LaneDivider />

        {/* Resources */}
        <View style={styles.section}>
          <Text style={styles.eyebrow}>RESOURCES</Text>
          <Text style={styles.sectionTitle}>Explore SIPAT</Text>
          <View style={styles.resourceList}>
            {RESOURCES.map((r) => (
              <TouchableOpacity
                key={r.title}
                style={styles.resourceCard}
                activeOpacity={0.7}
                onPress={() => Linking.openURL(r.url)}
              >
                <View style={styles.resourceIcon}>
                  <Ionicons name={r.icon} size={18} color={colors.signal} />
                </View>
                <View style={styles.resourceBody}>
                  <Text style={styles.resourceTitle}>{r.title}</Text>
                  <Text style={styles.resourceDesc}>{r.description}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
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
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  section: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  eyebrow: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontFamily: fonts.extrabold,
    fontSize: 17,
    color: colors.textPrimary,
    letterSpacing: -0.2,
    marginBottom: spacing.sm,
  },
  sectionDesc: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },

  // Hero
  heroTitle: {
    fontFamily: fonts.extrabold,
    fontSize: 28,
    color: colors.textPrimary,
    letterSpacing: -0.4,
    marginBottom: spacing.xs,
  },
  heroSubtitle: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  heroDesc: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 22,
    color: colors.textMuted,
  },

  // Team
  teamGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  teamCard: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  teamAvatar: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.signalDim,
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamInitial: {
    fontFamily: fonts.extrabold,
    fontSize: 14,
    color: colors.signal,
  },
  teamName: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
  teamRole: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  teamSchool: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
  },

  // Features
  featureList: { gap: spacing.sm },
  featureCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    gap: spacing.md,
  },
  featureDot: { width: 4, height: 4, borderRadius: 2, marginTop: 6 },
  featureBody: { flex: 1 },
  featureTitle: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  featureDesc: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },

  // Pipeline
  pipelineList: { gap: 0 },
  pipelineStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    position: 'relative',
  },
  pipelineNum: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  pipelineNumText: {
    fontFamily: fonts.extrabold,
    fontSize: 13,
    color: colors.onSignal,
  },
  pipelineLine: {
    position: 'absolute',
    left: 15,
    top: 32,
    bottom: -20,
    width: 2,
    backgroundColor: colors.hairline,
  },
  pipelineContent: { flex: 1, paddingBottom: spacing.lg },
  pipelineTitle: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  pipelineDesc: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textMuted,
    marginTop: 2,
  },

  // Severity
  severityList: { gap: spacing.sm },
  severityCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
  },
  severityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  severityDot: { width: 8, height: 8, borderRadius: 4 },
  severityLevel: { fontFamily: fonts.bold, fontSize: 14 },
  severityThreshold: {
    fontFamily: fonts.monoBold,
    fontSize: 15,
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
  severityDesc: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  severityNote: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: spacing.md,
    textAlign: 'center',
  },

  // Resources
  resourceList: { gap: spacing.sm },
  resourceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    gap: spacing.md,
  },
  resourceIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.signalDim,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resourceBody: { flex: 1 },
  resourceTitle: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  resourceDesc: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },

  // Thesis
  thesisNote: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
    marginBottom: spacing.xxl,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  thesisText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: 'center',
  },
})
