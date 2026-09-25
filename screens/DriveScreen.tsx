import { useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useProximityAlerts } from '../lib/useProximityAlerts'
import { useCommunityHazards } from '../lib/useCommunityHazards'
import HazardMap from '../components/HazardMap'

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
          <Ionicons name="arrow-back" size={24} color="#fafafa" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Drive Mode</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={() => setFollow((v) => !v)} style={styles.headerBtn}>
            <Ionicons name={follow ? 'locate' : 'locate-outline'} size={20} color={follow ? '#06b6d4' : '#fafafa'} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMuted((v) => !v)} style={styles.headerBtn}>
            <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={20} color="#fafafa" />
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
            <Ionicons name="warning" size={22} color="#0c0c14" />
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
          <Ionicons name={driving ? 'stop' : 'navigate'} size={22} color={driving ? '#fafafa' : '#0c0c14'} />
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
    backgroundColor: '#0c0c14',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  headerTitle: {
    color: '#fafafa',
    fontSize: 18,
    fontWeight: '800',
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
  },
  mapWrap: {
    flex: 1,
    marginHorizontal: 12,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#18181b',
  },
  map: {
    flex: 1,
    backgroundColor: '#0c0c14',
  },
  alertBanner: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f59e0b',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
  },
  alertBannerUrgent: {
    backgroundColor: '#ef4444',
  },
  alertBannerText: {
    flex: 1,
    color: '#0c0c14',
    fontSize: 16,
    fontWeight: '800',
  },
  cards: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  card: {
    flex: 1,
    backgroundColor: '#18181b',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
  },
  nextCard: {
    flex: 2,
  },
  cardLabel: {
    color: '#71717a',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  cardValue: {
    color: '#fafafa',
    fontSize: 26,
    fontWeight: '800',
    marginTop: 2,
  },
  cardUnit: {
    color: '#a1a1aa',
    fontSize: 12,
    marginTop: 2,
  },
  footer: {
    paddingHorizontal: 12,
    paddingTop: 10,
    alignItems: 'center',
  },
  driveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#22c55e',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 16,
  },
  driveBtnActive: {
    backgroundColor: '#ef4444',
  },
  driveBtnText: {
    color: '#0c0c14',
    fontSize: 17,
    fontWeight: '800',
  },
  driveBtnTextActive: {
    color: '#fafafa',
  },
  hint: {
    color: '#71717a',
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
})
