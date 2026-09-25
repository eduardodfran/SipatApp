import { useEffect, useMemo, useRef } from 'react'
import { StyleProp, ViewStyle } from 'react-native'
import { WebView } from 'react-native-webview'
import type { Hazard } from '../lib/useCommunityHazards'

type Props = {
  hazards: Hazard[]
  position: { lat: number; lng: number; heading?: number | null } | null
  highlightId?: string | null
  follow?: boolean
  /** Draw 100m/30m alert rings around the user position (Drive HUD). */
  rings?: boolean
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

function buildDriveMapHtml(
  pins: Array<{ id: string; lat: number; lng: number; color: string }>,
  rings: boolean,
): string {
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
  .user-arrow { width: 0; height: 0; border-left: 8px solid transparent;
    border-right: 8px solid transparent; border-bottom: 18px solid #06b6d4;
    filter: drop-shadow(0 0 6px #06b6d4); transform-origin: 50% 75%; }
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
  var enableRings = ${rings ? 'true' : 'false'};
  var ring100 = null;
  var ring30 = null;
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
  function updateRings(lat, lng) {
    if (!ring100) {
      ring100 = L.circle([lat, lng], { radius: 100, color: '#f59e0b', weight: 1,
        opacity: 0.7, fillColor: '#f59e0b', fillOpacity: 0.06, interactive: false }).addTo(map);
    } else {
      ring100.setLatLng([lat, lng]);
    }
    if (!ring30) {
      ring30 = L.circle([lat, lng], { radius: 30, color: '#ef4444', weight: 1,
        opacity: 0.7, fillColor: '#ef4444', fillOpacity: 0.10, interactive: false }).addTo(map);
    } else {
      ring30.setLatLng([lat, lng]);
    }
    ring100.bringToBack();
    ring30.bringToBack();
  }
  var userMarker = null;
  window.updateUser = function (lat, lng, follow, heading) {
    if (enableRings) updateRings(lat, lng);
    var hasHeading = typeof heading === 'number' && !isNaN(heading);
    var html = hasHeading
      ? '<div class="user-arrow" style="transform: rotate(' + heading + 'deg);"></div>'
      : '<div class="user-dot"></div>';
    if (!userMarker) {
      userMarker = L.marker([lat, lng], {
        icon: L.divIcon({ className: '', html: html, iconSize: [18, 18], iconAnchor: [9, 12] }),
        zIndexOffset: 1000,
      }).addTo(map);
      map.setView([lat, lng], 16);
    } else {
      if (hasHeading !== userMarker._hadHeading) {
        userMarker._hadHeading = hasHeading;
        userMarker.setIcon(L.divIcon({ className: '', html: html, iconSize: [18, 18], iconAnchor: [9, 12] }));
      } else if (hasHeading) {
        var el = userMarker.getElement();
        if (el) {
          var arrow = el.querySelector('.user-arrow');
          if (arrow) arrow.style.transform = 'rotate(' + heading + 'deg)';
        }
      }
      userMarker.setLatLng([lat, lng]);
      if (follow) map.panTo([lat, lng]);
    }
  };
</script>
</body>
</html>`
}

export default function HazardMap({
  hazards,
  position,
  highlightId,
  follow = true,
  rings = false,
  style,
}: Props) {
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
  const mapHtml = useMemo(() => buildDriveMapHtml(pins, rings), [pins, rings])

  // Latest values so a freshly-mounted WebView (e.g. expanding the mini-map to
  // full screen) can re-inject as soon as the HTML finishes loading.
  const positionRef = useRef(position)
  positionRef.current = position
  const highlightRef = useRef(highlightId)
  highlightRef.current = highlightId

  const injectUser = () => {
    const pos = positionRef.current
    if (pos && webviewRef.current) {
      const heading = pos.heading != null ? String(pos.heading) : 'null'
      webviewRef.current.injectJavaScript(
        `window.updateUser && window.updateUser(${pos.lat}, ${pos.lng}, ${follow ? 'true' : 'false'}, ${heading}); true;`,
      )
    }
  }

  // Push live position into the map (follow mode).
  useEffect(() => {
    injectUser()
  }, [position, follow])

  // Highlight the currently-alerted pin; clear when the banner dismisses.
  useEffect(() => {
    if (webviewRef.current) {
      const id = highlightRef.current ? JSON.stringify(highlightRef.current) : 'null'
      webviewRef.current.injectJavaScript(`window.highlightHazard && window.highlightHazard(${id}); true;`)
    }
  }, [highlightId])

  // Re-inject once Leaflet is ready — mount-time injections are dropped because
  // the HTML document hasn't loaded yet.
  const handleLoadEnd = () => {
    injectUser()
    const id = highlightRef.current ? JSON.stringify(highlightRef.current) : 'null'
    webviewRef.current?.injectJavaScript(`window.highlightHazard && window.highlightHazard(${id}); true;`)
  }

  return (
    <WebView
      ref={webviewRef}
      source={{ html: mapHtml }}
      style={style}
      javaScriptEnabled
      domStorageEnabled
      originWhitelist={['*']}
      onLoadEnd={handleLoadEnd}
    />
  )
}
