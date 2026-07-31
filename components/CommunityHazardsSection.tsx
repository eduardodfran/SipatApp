import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { Hazard } from '../lib/useCommunityHazards'

type Props = { hazards: Hazard[]; loading: boolean }

const SEVERITY_COLORS: Record<string, string> = {
  Severe: '#ef4444',
  Moderate: '#f59e0b',
  Minor: '#22c55e',
  Unknown: '#71717a',
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
      <View style={[styles.severityDot, { backgroundColor: SEVERITY_COLORS[worst] ?? '#71717a' }]} />
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
        <ActivityIndicator size="small" color="#06b6d4" />
      </View>
    )
  }

  if (hazards.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Ionicons name="location-outline" size={28} color="#71717a" />
        <Text style={styles.emptyText}>No address data yet</Text>
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
        <Ionicons name="map" size={18} color="#06b6d4" />
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
  container: { gap: 12 },
  loadingWrap: { paddingVertical: 40, alignItems: 'center' },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#18181b',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  emptyText: { color: '#71717a', fontSize: 13, marginTop: 8 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  headerTitle: { color: '#fafafa', fontSize: 16, fontWeight: '700', flex: 1 },
  headerCount: { color: '#71717a', fontSize: 12, fontWeight: '500' },

  card: {
    backgroundColor: '#18181b',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  cardTitle: { color: '#a1a1aa', fontSize: 12, fontWeight: '600', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Ranked list
  rankRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  rankNum: { color: '#71717a', fontSize: 12, fontWeight: '700', width: 16, textAlign: 'center' },
  rankInfo: { flex: 1 },
  rankName: { color: '#fafafa', fontSize: 13, fontWeight: '500', marginBottom: 3 },
  rankBarBg: { height: 4, backgroundColor: '#27272a', borderRadius: 2, overflow: 'hidden' },
  rankBarFill: { height: 4, backgroundColor: '#06b6d4', borderRadius: 2 },
  rankCount: { color: '#a1a1aa', fontSize: 12, fontWeight: '600', minWidth: 24, textAlign: 'right' },

  severityDot: { width: 8, height: 8, borderRadius: 4 },

  // Stacked bars
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { color: '#71717a', fontSize: 11, marginRight: 6 },
  stackedRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  stackedCity: { color: '#fafafa', fontSize: 12, fontWeight: '500', width: 80 },
  stackedBarBg: { flex: 1, height: 12, backgroundColor: '#27272a', borderRadius: 4, flexDirection: 'row', overflow: 'hidden' },
  stackedSeg: { minWidth: 2 },
  stackedCount: { color: '#a1a1aa', fontSize: 11, fontWeight: '600', minWidth: 20, textAlign: 'right' },
})
