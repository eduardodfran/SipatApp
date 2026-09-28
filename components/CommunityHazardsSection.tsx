import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { Hazard } from '../lib/useCommunityHazards'
import { colors, fonts, radius, spacing } from '../theme/tokens'
import Brackets from './Brackets'

type Props = { hazards: Hazard[]; loading: boolean }

const SEVERITY_COLORS: Record<string, string> = {
  Severe: colors.severe,
  Moderate: colors.moderate,
  Minor: colors.minor,
  Unknown: colors.textMuted,
}

const SEVERITY_RANK: Record<string, number> = { Minor: 1, Moderate: 2, Severe: 3, Unknown: 0 }

function aggregate<T extends string>(items: Hazard[], key: (h: Hazard) => T | null) {
  const counts: Record<string, number> = {}
  for (const h of items) {
    const k = key(h)
    if (!k) continue
    counts[k] = (counts[k] ?? 0) + 1
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
}

function aggregateStreet(items: Hazard[]) {
  const map: Record<string, { count: number; worst: string }> = {}
  for (const h of items) {
    if (!h.street) continue
    if (!map[h.street]) map[h.street] = { count: 0, worst: 'Unknown' }
    map[h.street].count++
    if ((SEVERITY_RANK[h.worst_severity] ?? 0) > (SEVERITY_RANK[map[h.street].worst] ?? 0)) {
      map[h.street].worst = h.worst_severity
    }
  }
  return Object.entries(map)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
}

function aggregateSeverityByCity(items: Hazard[]) {
  const cities: Record<string, Record<string, number>> = {}
  for (const h of items) {
    const city = h.city ?? 'Unknown'
    if (!cities[city]) cities[city] = {}
    const sev = h.worst_severity ?? 'Unknown'
    cities[city][sev] = (cities[city][sev] ?? 0) + 1
  }
  return Object.entries(cities)
    .map(([city, sevs]) => ({
      city,
      total: Object.values(sevs).reduce((a, b) => a + b, 0),
      severe: sevs['Severe'] ?? 0,
      moderate: sevs['Moderate'] ?? 0,
      minor: sevs['Minor'] ?? 0,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)
}

function RankRow({ rank, name, count, max }: { rank: number; name: string; count: number; max: number }) {
  const pct = max > 0 ? (count / max) * 100 : 0
  return (
    <View style={styles.rankRow}>
      <Text style={styles.rankNum}>{rank}</Text>
      <View style={styles.rankInfo}>
        <Text style={styles.rankName} numberOfLines={1}>{name}</Text>
        <View style={styles.rankBarBg}>
          <View style={[styles.rankBarFill, { width: `${pct}%` }]} />
        </View>
      </View>
      <Text style={styles.rankCount}>{count}</Text>
    </View>
  )
}

function StreetRow({ rank, name, count, worst }: { rank: number; name: string; count: number; worst: string }) {
  return (
    <View style={styles.rankRow}>
      <Text style={styles.rankNum}>{rank}</Text>
      <View style={[styles.severityDot, { backgroundColor: SEVERITY_COLORS[worst] ?? colors.textMuted }]} />
      <View style={styles.rankInfo}>
        <Text style={styles.rankName} numberOfLines={1}>{name}</Text>
      </View>
      <Text style={styles.rankCount}>{count}</Text>
    </View>
  )
}

function StackedBar({ city, total, severe, moderate, minor }: { city: string; total: number; severe: number; moderate: number; minor: number }) {
  return (
    <View style={styles.stackedRow}>
      <Text style={styles.stackedCity} numberOfLines={1}>{city}</Text>
      <View style={styles.stackedBarBg}>
        {minor > 0 && <View style={[styles.stackedSeg, { flex: minor, backgroundColor: SEVERITY_COLORS.Minor }]} />}
        {moderate > 0 && <View style={[styles.stackedSeg, { flex: moderate, backgroundColor: SEVERITY_COLORS.Moderate }]} />}
        {severe > 0 && <View style={[styles.stackedSeg, { flex: severe, backgroundColor: SEVERITY_COLORS.Severe }]} />}
      </View>
      <Text style={styles.stackedCount}>{total}</Text>
    </View>
  )
}

export default function CommunityHazardsSection({ hazards, loading }: Props) {
  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="small" color={colors.signal} />
      </View>
    )
  }

  if (hazards.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <View style={styles.emptyIcon}>
          <Brackets size={14} />
          <Ionicons name="location-outline" size={34} color={colors.signal} />
        </View>
        <Text style={styles.emptyTitle}>No address data yet</Text>
      </View>
    )
  }

  const cities = aggregate(hazards, (h) => h.city)
  const barangays = aggregate(hazards, (h) => h.barangay)
  const streets = aggregateStreet(hazards)
  const severityByCity = aggregateSeverityByCity(hazards)
  const cityMax = cities[0]?.[1] ?? 1
  const brgyMax = barangays[0]?.[1] ?? 1

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="map" size={14} color={colors.signal} />
        <Text style={styles.headerTitle}>Address Analytics</Text>
        <Text style={styles.headerCount}>{hazards.length} hazards</Text>
      </View>

      {/* Top Cities */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Top Cities</Text>
        {cities.map(([name, count], i) => (
          <RankRow key={name} rank={i + 1} name={name} count={count} max={cityMax} />
        ))}
      </View>

      {/* Top Barangays */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Top Barangays</Text>
        {barangays.map(([name, count], i) => (
          <RankRow key={name} rank={i + 1} name={name} count={count} max={brgyMax} />
        ))}
      </View>

      {/* Top Streets */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Top Streets</Text>
        {streets.map(([name, data], i) => (
          <StreetRow key={name} rank={i + 1} name={name} count={data.count} worst={data.worst} />
        ))}
      </View>

      {/* Severity by City */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Severity by City</Text>
        <View style={styles.legendRow}>
          <View style={[styles.legendDot, { backgroundColor: SEVERITY_COLORS.Severe }]} />
          <Text style={styles.legendLabel}>Severe</Text>
          <View style={[styles.legendDot, { backgroundColor: SEVERITY_COLORS.Moderate }]} />
          <Text style={styles.legendLabel}>Moderate</Text>
          <View style={[styles.legendDot, { backgroundColor: SEVERITY_COLORS.Minor }]} />
          <Text style={styles.legendLabel}>Minor</Text>
        </View>
        {severityByCity.map((row) => (
          <StackedBar key={row.city} {...row} />
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  loadingWrap: { paddingVertical: spacing.xxl, alignItems: 'center' },

  // Empty state — the section's single bracket moment
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: { color: colors.textPrimary, fontFamily: fonts.semibold, fontSize: 15 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  headerTitle: {
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  headerCount: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 0.4,
    color: colors.signal,
    backgroundColor: colors.signalDim,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  cardTitle: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    marginBottom: spacing.md,
  },

  // Ranked list
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  rankNum: {
    color: colors.textMuted,
    fontFamily: fonts.monoBold,
    fontSize: 12,
    width: 16,
    textAlign: 'center',
  },
  rankInfo: { flex: 1 },
  rankName: {
    color: colors.textPrimary,
    fontFamily: fonts.semibold,
    fontSize: 13,
    marginBottom: spacing.xs,
  },
  rankBarBg: { height: 4, backgroundColor: colors.surfaceRaised, borderRadius: 2, overflow: 'hidden' },
  rankBarFill: { height: 4, backgroundColor: colors.signal, borderRadius: 2 },
  rankCount: {
    color: colors.textSecondary,
    fontFamily: fonts.mono,
    fontSize: 12,
    minWidth: 24,
    textAlign: 'right',
  },

  severityDot: { width: 8, height: 8, borderRadius: 4 },

  // Stacked bars
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { color: colors.textMuted, fontFamily: fonts.mono, fontSize: 11, marginRight: spacing.sm },
  stackedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  stackedCity: { color: colors.textPrimary, fontFamily: fonts.semibold, fontSize: 12, width: 80 },
  stackedBarBg: {
    flex: 1,
    height: 12,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.sm,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  stackedSeg: { minWidth: 2 },
  stackedCount: {
    color: colors.textSecondary,
    fontFamily: fonts.mono,
    fontSize: 11,
    minWidth: 20,
    textAlign: 'right',
  },
})
