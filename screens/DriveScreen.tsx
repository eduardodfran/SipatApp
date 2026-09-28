import { useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useProximityAlerts } from '../lib/useProximityAlerts'
import { useCommunityHazards } from '../lib/useCommunityHazards'
import HazardMap from '../components/HazardMap'
import { colors, fonts, radius, spacing } from '../theme/tokens'

type Props = {
  onBack: () => void
}

export default function DriveScreen({ onBack }: Props) {
  const insets = useSafeAreaInsets()
  const [driving, setDriving] = useState(false)
  const [muted, setMuted] = useState(false)
  const [follow, setFollow] = useState(true)

  const { banner, dismissBanner, nextHazard, speedMps, position } = useProximityAlerts({
    enabled: driving,
    muted,
  })
  const { hazards } = useCommunityHazards()

  const kmh = speedMps != null ? Math.round(speedMps * 3.6) : null

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Drive Mode</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={() => setFollow((v) => !v)} style={styles.headerBtn}>
            <Ionicons name={follow ? 'locate' : 'locate-outline'} size={20} color={follow ? colors.signal : colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMuted((v) => !v)} style={styles.headerBtn}>
            <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Map */}
      <View style={styles.mapWrap}>
        <HazardMap
          hazards={hazards}
          position={driving ? position : null}
          highlightId={banner?.hazardId ?? null}
          follow={follow}
          style={styles.map}
        />
        {/* Proximity banner */}
        {banner && (
          <TouchableOpacity
            onPress={dismissBanner}
            style={[styles.alertBanner, banner.tier === 'urgent' && styles.alertBannerUrgent]}
          >
            <Ionicons name="warning" size={22} color={colors.onSignal} />
            <Text style={styles.alertBannerText}>{banner.text}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Status cards */}
      <View style={styles.cards}>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Speed</Text>
          <Text style={styles.cardValue}>{kmh != null ? `${kmh}` : '—'}</Text>
          <Text style={styles.cardUnit}>km/h</Text>
        </View>
        <View style={[styles.card, styles.nextCard]}>
          <Text style={styles.cardLabel}>Next hazard</Text>
          <Text style={styles.cardValue}>
            {nextHazard ? `${Math.round(nextHazard.distM)}m` : '—'}
          </Text>
          <Text style={styles.cardUnit} numberOfLines={1}>
            {nextHazard
              ? `${nextHazard.severity}${nextHazard.street ? ` · ${nextHazard.street}` : ''}`
              : 'Clear ahead'}
          </Text>
        </View>
      </View>

      {/* Start / Stop */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity
          onPress={() => setDriving((v) => !v)}
          style={[styles.driveBtn, driving && styles.driveBtnActive]}
        >
          <Ionicons name={driving ? 'stop' : 'navigate'} size={22} color={driving ? colors.textPrimary : colors.onSignal} />
          <Text style={[styles.driveBtnText, driving && styles.driveBtnTextActive]}>
            {driving ? 'Stop' : 'Start Driving'}
          </Text>
        </TouchableOpacity>
        {!driving && (
          <Text style={styles.hint}>Alerts fire within 100m of mapped potholes while you drive.</Text>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.hairline,
  },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontFamily: fonts.extrabold,
  },
  headerRight: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  mapWrap: {
    flex: 1,
    marginHorizontal: spacing.md,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  map: {
    flex: 1,
    backgroundColor: colors.background,
  },
  alertBanner: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.moderate,
    paddingHorizontal: 14,
    paddingVertical: spacing.md,
    borderRadius: 14,
  },
  alertBannerUrgent: {
    backgroundColor: colors.severe,
  },
  alertBannerText: {
    flex: 1,
    color: colors.onSignal,
    fontSize: 16,
    fontFamily: fonts.extrabold,
  },
  cards: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: spacing.md,
    paddingTop: 10,
  },
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: spacing.md,
    alignItems: 'center',
  },
  nextCard: {
    flex: 2,
  },
  cardLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: fonts.bold,
    textTransform: 'uppercase',
  },
  cardValue: {
    color: colors.textPrimary,
    fontSize: 26,
    fontFamily: fonts.monoBold,
    marginTop: 2,
  },
  cardUnit: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  footer: {
    paddingHorizontal: spacing.md,
    paddingTop: 10,
    alignItems: 'center',
  },
  driveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.minor,
    paddingHorizontal: spacing.xxl,
    paddingVertical: 14,
    borderRadius: radius.lg,
  },
  driveBtnActive: {
    backgroundColor: colors.severe,
  },
  driveBtnText: {
    color: colors.onSignal,
    fontSize: 17,
    fontFamily: fonts.extrabold,
  },
  driveBtnTextActive: {
    color: colors.textPrimary,
  },
  hint: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
})
