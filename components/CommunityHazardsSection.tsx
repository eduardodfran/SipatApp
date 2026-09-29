import { useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { Hazard } from '../lib/useCommunityHazards'
import { colors, fonts, radius, spacing } from '../theme/tokens'
import Brackets from './Brackets'

type Props = { hazards: Hazard[]; loading: boolean }
type Mode = 'barangay' | 'street'

const SEVERITY_COLORS: Record<string, string> = {
  Severe: colors.severe,
  Moderate: colors.moderate,
  Minor: colors.minor,
  Unknown: colors.textMuted,
}

const SEVERITY_RANK: Record<string, number> = { Minor: 1, Moderate: 2, Severe: 3, Unknown: 0 }

type AreaRow = { name: string; count: number; worst: string }

function aggregateAreas(hazards: Hazard[], mode: Mode) {
  const map: Record<string, AreaRow> = {}
  let unmapped = 0
  for (const h of hazards) {
    const name = mode === 'barangay' ? h.barangay : h.street
    if (!name) {
      unmapped++
      continue
    }
    const row = map[name] ?? (map[name] = { name, count: 0, worst: 'Unknown' })
    row.count++
    if ((SEVERITY_RANK[h.worst_severity] ?? 0) > (SEVERITY_RANK[row.worst] ?? 0)) {
      row.worst = h.worst_severity
    }
  }
  const all = Object.values(map).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
  return {
    rows: all.slice(0, 5),
    areaCount: all.length,
    unmapped,
    mapped: hazards.length - unmapped,
  }
}

function EmptyState({ title }: { title: string }) {
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIcon}>
        <Brackets size={14} />
        <Ionicons name="location-outline" size={34} color={colors.signal} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
    </View>
  )
}

export default function CommunityHazardsSection({ hazards, loading }: Props) {
  const [mode, setMode] = useState<Mode>('barangay')

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="small" color={colors.signal} />
      </View>
    )
  }

  if (hazards.length === 0) {
    return <EmptyState title="No hazards yet" />
  }

  const { rows, areaCount, unmapped, mapped } = aggregateAreas(hazards, mode)

  if (mapped === 0) {
    return <EmptyState title="No address data yet" />
  }

  const max = rows[0]?.count ?? 1
  const noun = mode === 'barangay' ? (areaCount === 1 ? 'barangay' : 'barangays') : (areaCount === 1 ? 'street' : 'streets')

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.eyebrow}>Distress by area</Text>
        <View style={styles.toggle}>
          <TouchableOpacity
            style={[styles.toggleBtn, mode === 'barangay' && styles.toggleBtnActive]}
            onPress={() => setMode('barangay')}
            activeOpacity={0.7}
          >
            <Text style={[styles.toggleText, mode === 'barangay' && styles.toggleTextActive]}>Barangay</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, mode === 'street' && styles.toggleBtnActive]}
            onPress={() => setMode('street')}
            activeOpacity={0.7}
          >
            <Text style={[styles.toggleText, mode === 'street' && styles.toggleTextActive]}>Street</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.card}>
        {rows.map((row, i) => {
          const pct = max > 0 ? (row.count / max) * 100 : 0
          return (
            <View key={row.name} style={styles.rankRow}>
              <Text style={styles.rankNum}>{i + 1}</Text>
              <View style={styles.rankInfo}>
                <View style={styles.rankTop}>
                  <Text style={styles.rankName} numberOfLines={1}>{row.name}</Text>
                  <Text style={styles.rankCount}>{row.count}</Text>
                </View>
                <View style={styles.rankBarBg}>
                  <View
                    style={[
                      styles.rankBarFill,
                      { width: `${pct}%`, backgroundColor: SEVERITY_COLORS[row.worst] ?? colors.signal },
                    ]}
                  />
                </View>
              </View>
            </View>
          )
        })}

        {unmapped > 0 && (
          <View style={styles.unmappedRow}>
            <Ionicons name="location-outline" size={13} color={colors.textMuted} />
            <Text style={styles.unmappedText}>No address — {unmapped}</Text>
          </View>
        )}

        <View style={styles.footerRow}>
          <Text style={styles.footerText}>
            {mapped} of {hazards.length} mapped · {areaCount} {noun}
          </Text>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
    gap: spacing.md,
  },

  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  eyebrow: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },

  toggle: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: 2,
    gap: 2,
  },
  toggleBtn: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
  },
  toggleBtnActive: {
    backgroundColor: colors.signalDim,
  },
  toggleText: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    color: colors.textMuted,
  },
  toggleTextActive: {
    color: colors.signal,
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
  },

  loadingWrap: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  emptyWrap: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
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

  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
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
  rankTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  rankName: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: fonts.semibold,
    fontSize: 13,
  },
  rankCount: {
    color: colors.textSecondary,
    fontFamily: fonts.mono,
    fontSize: 12,
  },
  rankBarBg: {
    height: 4,
    backgroundColor: colors.surfaceRaised,
    borderRadius: 2,
    overflow: 'hidden',
  },
  rankBarFill: { height: 4, borderRadius: 2 },

  unmappedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    marginTop: spacing.xs,
  },
  unmappedText: {
    color: colors.textMuted,
    fontFamily: fonts.medium,
    fontSize: 12,
  },

  footerRow: {
    marginTop: spacing.sm,
  },
  footerText: {
    color: colors.textMuted,
    fontFamily: fonts.mono,
    fontSize: 11,
  },
})
