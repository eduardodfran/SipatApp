import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { WebView, WebViewMessageEvent } from 'react-native-webview'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { usePotholeDetectors } from '../lib/usePotholeDetectors'
import type { Recording } from '../lib/types'
import PotholeDetailSheet from '../components/PotholeDetailSheet'

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
  pothole_id: string
  consolidated_latitude: number
  consolidated_longitude: number
  worst_severity: string
  total_detection_hits: number
  image_url: string | null
  status: string
  updated_at: string
}

type CommunityPhoto = {
  id: string
  latitude: number
  longitude: number
  detection_status: string
  worst_severity: string
  image_url: string
  formatted_address: string
}

const COLORS = [
  '#e6194b', '#3cb44b', '#ffe119', '#2563eb', '#f58231',
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

function severityColor(severity: string): string {
  switch (severity?.toLowerCase()) {
    case 'severe':   return '#dc2626'
    case 'moderate': return '#f59e0b'
    case 'minor':    return '#22c55e'
    default:         return '#6b7280'
  }
}

function severityLabel(severity: string): string {
  const s = severity?.toLowerCase()
  if (s === 'severe')   return '🔴 Severe'
  if (s === 'moderate') return '🟡 Moderate'
  if (s === 'minor')    return '🟢 Minor'
  return severity || 'Unknown'
}

function buildMapHtml(
  routes: RouteData[],
  potholes: PotholeData[],
  communityPhotos: CommunityPhoto[],
  viewMode: ViewMode,
  tileKey: string | undefined,
): string {
  const showRoutes = viewMode === 'routes' || viewMode === 'both'
  const showPotholes = viewMode === 'potholes' || viewMode === 'both'
  const showCommunity = viewMode === 'routes' || viewMode === 'both'
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
        id: p.pothole_id,
        lat: p.consolidated_latitude,
        lng: p.consolidated_longitude,
        severity: p.worst_severity,
        hits: p.total_detection_hits,
        image_url: p.image_url,
        color: severityColor(p.worst_severity),
        severityLabel: severityLabel(p.worst_severity),
      }))
    : []

  const communityPhotoFeatures = showCommunity
    ? communityPhotos.map((cp) => ({
        id: cp.id,
        lat: cp.latitude,
        lng: cp.longitude,
        status: cp.detection_status,
        severity: cp.worst_severity,
        image_url: cp.image_url,
        address: cp.formatted_address,
        color:
          cp.detection_status === 'pending'
            ? '#6b7280'
            : cp.detection_status === 'processed'
              ? '#06b6d4'
              : '#3f3f46',
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
  .hazard-label { background: none; border: none; box-shadow: none; color: #fff; font-weight: bold; font-size: 11px; }
  .hazard-popup { font-family: sans-serif; font-size: 13px; }
  .hazard-popup strong { display: block; margin-bottom: 4px; }
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
  var communityPhotoData = ${JSON.stringify(communityPhotoFeatures)};

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

    var label = p.severity === 'Severe' ? '!' : p.hits.toString();
    marker.bindTooltip(label, { permanent: true, direction: 'center', className: 'hazard-label' });

    marker.on('click', function() {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'pothole_tap',
        id: p.id,
        worst_severity: p.severity,
        total_detection_hits: p.hits,
        image_url: p.image_url,
        consolidated_latitude: p.lat,
        consolidated_longitude: p.lng,
      }));
    });

    bounds.push([p.lat, p.lng]);
  });

  communityPhotoData.forEach(function(cp) {
    var icon = L.divIcon({
      className: '',
      html: '<div style="width:32px;height:32px;border-radius:8px;background:' + cp.color + ';border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg></div>',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    var marker = L.marker([cp.lat, cp.lng], { icon: icon }).addTo(map);

    var popupHtml = '<div class="hazard-popup"><strong>Community Photo</strong>';
    if (cp.image_url) {
      popupHtml += '<img src="' + cp.image_url + '" style="width:100%;max-width:200px;border-radius:6px;margin:6px 0;" />';
    }
    if (cp.address) {
      popupHtml += '<div style="color:#6b7280;font-size:12px;">' + cp.address + '</div>';
    }
    popupHtml += '<div style="margin-top:4px;font-size:11px;color:' + cp.color + ';">Status: ' + cp.status + '</div>';
    if (cp.severity) {
      popupHtml += '<div style="font-size:11px;color:#f59e0b;">Severity: ' + cp.severity + '</div>';
    }
    popupHtml += '</div>';
    marker.bindPopup(popupHtml);

    bounds.push([cp.lat, cp.lng]);
  });

  if (bounds.length > 0) {
    map.fitBounds(bounds, { padding: [40, 40] });
  }
</script>
</body>
</html>`
}

export default function MapVerificationScreen({ recordings, onBack }: Props) {
  const [routes, setRoutes] = useState<RouteData[]>([])
  const [potholes, setPotholes] = useState<PotholeData[]>([])
  const [communityPhotos, setCommunityPhotos] = useState<CommunityPhoto[]>([])
  const [loading, setLoading] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('both')
  const [selectedPothole, setSelectedPothole] = useState<PotholeData | null>(null)
  const webViewRef = useRef<WebView>(null)

  const { detectors, loading: detectorsLoading } = usePotholeDetectors(
    selectedPothole?.consolidated_latitude ?? null,
    selectedPothole?.consolidated_longitude ?? null,
  )

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
          .from('v_unified_potholes')
          .select('*')
          .order('total_detection_hits', { ascending: false })

        if (error) {
          console.log('[MapScreen] pothole query error:', error.message, error.details, error.hint)
        }

        if (!error && data) {
          console.log('[MapScreen] pothole rows:', data.length)
          setPotholes(
            data.map((p: any) => ({
              pothole_id: String(p.pothole_id ?? p.id ?? ''),
              consolidated_latitude: Number(p.consolidated_latitude ?? p.lat ?? 0),
              consolidated_longitude: Number(p.consolidated_longitude ?? p.lng ?? 0),
              worst_severity: String(p.worst_severity ?? 'unknown'),
              total_detection_hits: Number(p.total_detection_hits ?? p.detection_count ?? 0),
              image_url: p.image_url ?? null,
              status: String(p.status ?? 'queued'),
              updated_at: String(p.updated_at ?? ''),
            })),
          )
        }
      } catch (e) {
        console.log('[MapScreen] pothole fetch failed:', e)
      }

      try {
        const { data: photoData, error: photoError } = await supabase
          .from('community_photos')
          .select('id, latitude, longitude, detection_status, worst_severity, image_url, formatted_address')
          .order('created_at', { ascending: false })
          .limit(100)

        if (photoError) {
          console.log('[MapScreen] community photo query error:', photoError.message)
        }

        if (!photoError && photoData) {
          console.log('[MapScreen] community photo rows:', photoData.length)
          setCommunityPhotos(photoData)
        }
      } catch (e) {
        console.log('[MapScreen] community photo fetch failed:', e)
      }

      setLoading(false)
    })()
  }, [recordings])

  const html = useMemo(
    () => buildMapHtml(routes, potholes, communityPhotos, viewMode, MAPTILER_KEY),
    [routes, potholes, communityPhotos, viewMode],
  )

  const totalPoints = routes.reduce((s, r) => s + r.coords.length, 0)

  const handleWebViewMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data)
      if (data.type === 'pothole_tap') {
        setSelectedPothole({
          pothole_id: data.id,
          worst_severity: data.worst_severity,
          total_detection_hits: data.total_detection_hits,
          image_url: data.image_url,
          consolidated_latitude: data.consolidated_latitude,
          consolidated_longitude: data.consolidated_longitude,
          status: '',
          updated_at: '',
        })
      }
    } catch {
      // ignore non-JSON messages
    }
  }, [])

  const handleCloseSheet = useCallback(() => {
    setSelectedPothole(null)
  }, [])

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ html }}
        style={styles.map}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        onMessage={handleWebViewMessage}
      />

      <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
        <Ionicons name="arrow-back" size={20} color="#f0f0f0" />
      </TouchableOpacity>

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

      {!loading && (routes.length > 0 || potholes.length > 0 || communityPhotos.length > 0) && (
        <View style={styles.summaryPanel}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{potholes.length}</Text>
              <Text style={styles.summaryLabel}>Potholes</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{communityPhotos.length}</Text>
              <Text style={styles.summaryLabel}>Photos</Text>
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

      {!loading && routes.length === 0 && potholes.length === 0 && communityPhotos.length === 0 && (
        <View style={styles.emptyOverlay}>
          <Ionicons name="map-outline" size={36} color="#2a2a3a" />
          <Text style={styles.emptyText}>No map data available</Text>
        </View>
      )}

      {loading && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color="#e6a817" />
            <Text style={styles.loadingText}>Loading data</Text>
          </View>
        </View>
      )}

      <PotholeDetailSheet
        visible={selectedPothole !== null}
        pothole={selectedPothole}
        detectors={detectors}
        detectorsLoading={detectorsLoading}
        onClose={handleCloseSheet}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0c0c14',
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
    backgroundColor: '#e6a817',
  },
  toggleText: {
    color: '#aaa',
    fontSize: 12,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: '#0c0c14',
  },
  summaryPanel: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: '#141420',
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
    color: '#f0f0f0',
    fontSize: 20,
    fontWeight: '700',
  },
  summaryLabel: {
    color: '#6b7280',
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
    color: '#4b5563',
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
    backgroundColor: '#141420',
    borderRadius: 20,
    paddingVertical: 32,
    paddingHorizontal: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(230, 168, 23, 0.1)',
  },
  loadingText: {
    color: '#f0f0f0',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
  },
})
