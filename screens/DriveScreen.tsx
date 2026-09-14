import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { WebView } from 'react-native-webview'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useProximityAlerts } from '../lib/useProximityAlerts'
import { useCommunityHazards } from '../lib/useCommunityHazards'

type Props = {
  onBack: () => void
}

function severityColor(severity: string | null | undefined): string {
  switch ((severity ?? '').toLowerCase()) {
    case 'severe':
      return '#ef4444'
    case 'moderate':
      return '#f59e0b'
    case 'minor':
      return '#22c55e'
    default:
      return '#71717a'
  }
}

function buildDriveMapHtml(pins: Array<{ id: string; lat: number; lng: number; color: string }>): string {
  const data = JSON.stringify(pins)
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  html, body { margin: 0; padding: 0; height: 100%; background: #0c0c14; }
  #map { height: 100%; width: 100%; }
  .user-dot { width: 18px; height: 18px; border-radius: 9px; background: #06b6d4;
    border: 3px solid #ffffff; box-shadow: 0 0 12px #06b6d4; }
</style>
</head>
<body>
<div id="map"></div>
<script>
  var map = L.map('map', { zoomControl: false }).setView([14.5547, 121.0509], 16);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
  var pins = ${data};
  var markers = {};
  var highlightedId = null;
  function baseStyle(color) {
    return { radius: 7, color: color, fillColor: color, fillOpacity: 0.85, weight: 2 };
  }
  for (var i = 0; i < pins.length; i++) {
    markers[pins[i].id] = L.circleMarker([pins[i].lat, pins[i].lng], baseStyle(pins[i].color));
    markers[pins[i].id].options.baseColor = pins[i].color;
    markers[pins[i].id].addTo(map);
  }
  window.highlightHazard = function (id) {
    if (highlightedId && markers[highlightedId]) {
      markers[highlightedId].setStyle(baseStyle(markers[highlightedId].options.baseColor));
    }
    highlightedId = id;
    if (id && markers[id]) {
      markers[id].setStyle({ radius: 13, weight: 4 });
      markers[id].bringToFront();
    }
  };
  var userMarker = null;
  window.updateUser = function (lat, lng, follow) {
    if (!userMarker) {
      userMarker = L.marker([lat, lng], {
        icon: L.divIcon({ className: '', html: '<div class="user-dot"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }),
      }).addTo(map);
      map.setView([lat, lng], 16);
    } else {
      userMarker.setLatLng([lat, lng]);
      if (follow) map.panTo([lat, lng]);
    }
  };
</script>
</body>
</html>`
}

export default function DriveScreen({ onBack }: Props) {
  const insets = useSafeAreaInsets()
  const [driving, setDriving] = useState(false)
  const [muted, setMuted] = useState(false)
  const [follow, setFollow] = useState(true)
  const webviewRef = useRef<WebView | null>(null)

  const { banner, dismissBanner, nextHazard, speedMps, position } = useProximityAlerts({
    enabled: driving,
    muted,
  })
  const { hazards } = useCommunityHazards()

  const pins = useMemo(
    () =>
      hazards.map((h) => ({
        id: String(h.pothole_id),
        lat: h.consolidated_latitude,
        lng: h.consolidated_longitude,
        color: severityColor(h.worst_severity),
      })),
    [hazards],
  )
  const mapHtml = useMemo(() => buildDriveMapHtml(pins), [pins])

  // Push live position into the map (follow mode).
  useEffect(() => {
    if (driving && position && webviewRef.current) {
      webviewRef.current.injectJavaScript(
        `window.updateUser && window.updateUser(${position.lat}, ${position.lng}, ${follow ? 'true' : 'false'}); true;`,
      )
    }
  }, [driving, position, follow])

  // Highlight the currently-alerted pin; clear when the banner dismisses.
  useEffect(() => {
    if (webviewRef.current) {
      const id = banner ? JSON.stringify(banner.hazardId) : 'null'
      webviewRef.current.injectJavaScript(`window.highlightHazard && window.highlightHazard(${id}); true;`)
    }
  }, [banner])

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
        <WebView
          ref={webviewRef}
          source={{ html: mapHtml }}
          style={styles.map}
          javaScriptEnabled
          domStorageEnabled
          originWhitelist={['*']}
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
