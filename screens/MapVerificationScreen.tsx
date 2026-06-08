import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { WebView } from 'react-native-webview'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import type { Recording } from '../lib/types'

type ViewMode = 'routes' | 'potholes' | 'both'

type Props = {
  recordings: Recording[]
  onBack: () => void
}

type RouteCoord = {
  latitude: number
  longitude: number
}

type RouteData = {
  id: string
  timestamp: number
  coords: RouteCoord[]
  color: string
}

type PotholeData = {
  id: string
  latitude: number
  longitude: number
  detection_count: number
  status: string
  updated_at: string
}

const COLORS = [
  '#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231',
  '#911eb4', '#42d4f4', '#f032e6', '#bfef45', '#fabed4',
  '#469990', '#dcbeff', '#9a6324', '#800000',
  '#aaffc3', '#808000', '#ffd8b1', '#000075', '#a9a9a9',
]

const MAPTILER_KEY = process.env.EXPO_PUBLIC_MAPTILER_API_KEY

function parseCsv(csv: string): RouteCoord[] {
  const lines = csv.trim().split('\n')
  return lines.slice(1).reduce<RouteCoord[]>((acc, line) => {
    const parts = line.split(',')
    if (parts.length < 3) return acc
    const lat = parseFloat(parts[1])
    const lng = parseFloat(parts[2])
    if (!isNaN(lat) && !isNaN(lng) && !(lat === 0 && lng === 0)) {
      acc.push({ latitude: lat, longitude: lng })
    }
    return acc
  }, [])
}

function potholeColor(count: number): string {
  if (count >= 10) return '#ff4444'
  if (count >= 5) return '#ff8800'
  if (count >= 2) return '#ffbb00'
  return '#43a047'
}

function buildMapHtml(
  routes: RouteData[],
  potholes: PotholeData[],
  viewMode: ViewMode,
  tileKey: string | undefined,
): string {
  const showRoutes = viewMode === 'routes' || viewMode === 'both'
  const showPotholes = viewMode === 'potholes' || viewMode === 'both'
  const tileUrl = tileKey
    ? `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${tileKey}`
    : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'

  const routeFeatures = showRoutes
    ? routes.map((r, i) => ({
        coords: r.coords.map((c) => [c.latitude, c.longitude]),
        color: r.color,
      }))
    : []

  const potholeFeatures = showPotholes
    ? potholes.map((p) => ({
        lat: p.latitude,
        lng: p.longitude,
        count: p.detection_count,
        color: potholeColor(p.detection_count),
      }))
    : []

  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  body { margin: 0; padding: 0; }
  #map { width: 100vw; height: 100vh; }
</style>
</head>
<body>
<div id="map"></div>
<script>
  var map = L.map('map').setView([14.5547, 121.0509], 13);
  L.tileLayer('${tileUrl}', {
    maxZoom: 19,
    attribution: 'MapLibre | &copy; OpenStreetMap'
  }).addTo(map);

  var bounds = [];
  var routeData = ${JSON.stringify(routeFeatures)};
  var potholeData = ${JSON.stringify(potholeFeatures)};

  routeData.forEach(function(route) {
    var latlngs = route.coords.map(function(c) { return [c[0], c[1]]; });
    L.polyline(latlngs, { color: route.color, weight: 3 }).addTo(map);
    latlngs.forEach(function(ll) { bounds.push(ll); });
    if (latlngs.length > 0) {
      L.circleMarker(latlngs[0], { radius: 7, color: route.color, fillColor: route.color, fillOpacity: 1 }).addTo(map);
      L.circleMarker(latlngs[latlngs.length-1], { radius: 5, color: '#000', fillColor: '#000', fillOpacity: 1 }).addTo(map);
    }
  });

  potholeData.forEach(function(p) {
    var marker = L.circleMarker([p.lat, p.lng], {
      radius: 10,
      color: p.color,
      fillColor: p.color,
      fillOpacity: 0.8,
      weight: 2
    }).addTo(map);
    marker.bindTooltip(p.count.toString(), { permanent: true, direction: 'center', className: 'pothole-label' });
    bounds.push([p.lat, p.lng]);
  });

  if (bounds.length > 0) {
    map.fitBounds(bounds, { padding: [40, 40] });
  }
</script>
<style>
  .pothole-label { background: none; border: none; box-shadow: none; color: #fff; font-weight: bold; font-size: 11px; }
</style>
</body>
</html>`
}

export default function MapVerificationScreen({ recordings, onBack }: Props) {
  const [routes, setRoutes] = useState<RouteData[]>([])
  const [potholes, setPotholes] = useState<PotholeData[]>([])
  const [loading, setLoading] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('both')

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      const routeResults: RouteData[] = []

      const fetchTasks = recordings.map(async (rec, i) => {
        try {
          const res = await fetch(rec.csvUri)
          const text = await res.text()
          const coords = parseCsv(text)
          if (coords.length > 0) {
            routeResults.push({
              id: rec.id,
              timestamp: rec.timestamp,
              coords,
              color: COLORS[i % COLORS.length],
            })
          }
        } catch {
          // skip
        }
      })

      await Promise.all(fetchTasks)
      setRoutes(routeResults)

      try {
        const { data, error } = await supabase
          .from('verified_potholes')
          .select('id, lat, lng, detection_count, status, updated_at')
          .order('detection_count', { ascending: false })

        if (!error && data) {
          setPotholes(
            data.map((p) => ({
              id: p.id,
              latitude: p.lat,
              longitude: p.lng,
              detection_count: p.detection_count ?? 0,
              status: p.status ?? 'queued',
              updated_at: p.updated_at ?? '',
            })),
          )
        }
      } catch {
        // silently fail
      }

      setLoading(false)
    })()
  }, [recordings])

  const html = useMemo(
    () => buildMapHtml(routes, potholes, viewMode, MAPTILER_KEY),
    [routes, potholes, viewMode],
  )

  const totalPoints = routes.reduce((s, r) => s + r.coords.length, 0)

  return (
    <View style={styles.container}>
      <WebView source={{ html }} style={styles.map} />

      {/* Back button */}
      <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
        <Ionicons name="arrow-back" size={20} color="#fff" />
      </TouchableOpacity>

      {/* View mode toggle */}
      <View style={styles.toggleRow}>
        {(['routes', 'potholes', 'both'] as ViewMode[]).map((mode) => (
          <TouchableOpacity
            key={mode}
            style={[styles.toggleBtn, viewMode === mode && styles.toggleBtnActive]}
            onPress={() => setViewMode(mode)}
          >
            <Text style={[styles.toggleText, viewMode === mode && styles.toggleTextActive]}>
              {mode === 'both' ? 'All' : mode.charAt(0).toUpperCase() + mode.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Summary panel */}
      {!loading && (routes.length > 0 || potholes.length > 0) && (
        <View style={styles.summaryPanel}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{potholes.length}</Text>
              <Text style={styles.summaryLabel}>Potholes</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{routes.length}</Text>
              <Text style={styles.summaryLabel}>Routes</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{totalPoints.toLocaleString()}</Text>
              <Text style={styles.summaryLabel}>GPS points</Text>
            </View>
          </View>
        </View>
      )}

      {/* Empty state */}
      {!loading && routes.length === 0 && potholes.length === 0 && (
        <View style={styles.emptyOverlay}>
          <Ionicons name="map-outline" size={36} color="#444" />
          <Text style={styles.emptyText}>No map data available</Text>
        </View>
      )}

      {/* Loading */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color="#4363d8" />
            <Text style={styles.loadingText}>Loading data</Text>
          </View>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a1a',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  backBtn: {
    position: 'absolute',
    top: 54,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  toggleRow: {
    position: 'absolute',
    top: 54,
    right: 16,
    flexDirection: 'row',
    gap: 6,
    zIndex: 10,
  },
  toggleBtn: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  toggleBtnActive: {
    backgroundColor: '#4363d8',
  },
  toggleText: {
    color: '#aaa',
    fontSize: 12,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: '#fff',
  },
  summaryPanel: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: '#13133a',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    zIndex: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  summaryLabel: {
    color: '#666',
    fontSize: 11,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  emptyOverlay: {
    position: 'absolute',
    bottom: 80,
    alignSelf: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  emptyText: {
    color: '#444',
    fontSize: 14,
    marginTop: 8,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 20,
  },
  loadingCard: {
    backgroundColor: '#13133a',
    borderRadius: 20,
    paddingVertical: 32,
    paddingHorizontal: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
  },
})
