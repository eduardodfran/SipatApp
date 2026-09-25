import { useEffect, useMemo, useRef } from 'react'
import { StyleProp, ViewStyle } from 'react-native'
import { WebView } from 'react-native-webview'
import type { Hazard } from '../lib/useCommunityHazards'

type Props = {
  hazards: Hazard[]
  position: { lat: number; lng: number } | null
  highlightId?: string | null
  follow?: boolean
  style?: StyleProp<ViewStyle>
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

export default function HazardMap({ hazards, position, highlightId, follow = true, style }: Props) {
  const webviewRef = useRef<WebView | null>(null)

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
    if (position && webviewRef.current) {
      webviewRef.current.injectJavaScript(
        `window.updateUser && window.updateUser(${position.lat}, ${position.lng}, ${follow ? 'true' : 'false'}); true;`,
      )
    }
  }, [position, follow])

  // Highlight the currently-alerted pin; clear when the banner dismisses.
  useEffect(() => {
    if (webviewRef.current) {
      const id = highlightId ? JSON.stringify(highlightId) : 'null'
      webviewRef.current.injectJavaScript(`window.highlightHazard && window.highlightHazard(${id}); true;`)
    }
  }, [highlightId])

  return (
    <WebView
      ref={webviewRef}
      source={{ html: mapHtml }}
      style={style}
      javaScriptEnabled
      domStorageEnabled
      originWhitelist={['*']}
    />
  )
}
