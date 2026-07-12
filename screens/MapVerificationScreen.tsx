import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { WebView, WebViewMessageEvent } from 'react-native-webview'
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
  pothole_id: string
  consolidated_latitude: number
  consolidated_longitude: number
  worst_severity: string
  total_detection_hits: number
  image_url: string | null
  status: string
  updated_at: string
  street: string | null
  barangay: string | null
  city: string | null
  province: string | null
  region: string | null
  country: string | null
  formatted_address: string | null
  citizen_first_reported_at: string | null
  latest_activity_at: string | null
  detectors_count: number
}

type CommunityPhoto = {
  id: string
  latitude: number
  longitude: number
  detection_status: string
  worst_severity: string
  image_url: string
  formatted_address: string
  street: string
  barangay: string
  city: string
  province: string
  region: string
  country: string
  confidence: number
  class_name: string
  reporter_username: string
  created_at: string
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
  supabaseUrl: string,
  supabaseAnonKey: string,
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
        status: p.status,
        street: p.street,
        barangay: p.barangay,
        city: p.city,
        province: p.province,
        region: p.region,
        country: p.country,
        formatted_address: p.formatted_address,
        citizen_first_reported_at: p.citizen_first_reported_at,
        latest_activity_at: p.latest_activity_at,
        detectors_count: p.detectors_count ?? 0,
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
        formatted_address: cp.formatted_address,
        street: cp.street,
        barangay: cp.barangay,
        city: cp.city,
        province: cp.province,
        region: cp.region,
        country: cp.country,
        confidence: cp.confidence,
        class_name: cp.class_name,
        reporter_username: cp.reporter_username,
        created_at: cp.created_at,
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
  body { margin: 0; padding: 0; background: #000; }
  #map { width: 100vw; height: 100vh; }
  .hazard-label { background: none; border: none; box-shadow: none; color: #fff; font-weight: bold; font-size: 11px; }
  .hazard-popup { font-family: system-ui, sans-serif; font-size: 13px; min-width: 200px; }
  .leaflet-popup-content-wrapper { background: #0c0c14; color: #e4e4e7; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.6); }
  .leaflet-popup-tip { background: #0c0c14; }
  .leaflet-popup-content { margin: 14px; }
</style>
</head>
<body>
<div id="map"></div>
<script>
  var SUPABASE_URL = '${supabaseUrl}';
  var SUPABASE_KEY = '${supabaseAnonKey}';
  var map = L.map('map').setView([14.5547, 121.0509], 13);
  L.tileLayer('${tileUrl}', {
    maxZoom: 19,
    attribution: 'MapLibre | &copy; OpenStreetMap'
  }).addTo(map);

  var bounds = [];
  var routeData = ${JSON.stringify(routeFeatures)};
  var potholeData = ${JSON.stringify(potholeFeatures)};
  var communityPhotoData = ${JSON.stringify(communityPhotoFeatures)};

  function potholePopupHtml(p, detectors, comments) {
    var severityColors = { Severe: '#ef4444', Moderate: '#eab308', Minor: '#22c55e', Unknown: '#6b7280' };
    var statusColors = { reported: '#3b82f6', confirmed: '#f59e0b', fixed: '#22c55e' };
    var statusLabels = { reported: 'Reported', confirmed: 'Confirmed', fixed: 'Fixed' };
    var sevColor = severityColors[p.severity] || '#6b7280';
    var stColor = statusColors[p.status] || '#3b82f6';
    var stLabel = statusLabels[p.status] || 'Reported';

    var addrLines = [];
    if (p.street) addrLines.push(p.street);
    if (p.barangay) addrLines.push(p.barangay);
    if (p.city) addrLines.push(p.city);
    if (p.province) addrLines.push(p.province);
    if (p.region && p.region !== p.province) addrLines.push(p.region);
    if (p.country) addrLines.push(p.country);

    var hits = p.hits || 0;
    var conf;
    if (hits >= 10) conf = { label: 'High', color: '#22c55e', percent: 100 };
    else if (hits >= 5) conf = { label: 'Medium', color: '#f59e0b', percent: 65 };
    else if (hits >= 2) conf = { label: 'Low', color: '#f59e0b', percent: 35 };
    else conf = { label: 'Unverified', color: '#71717a', percent: 15 };

    var html = '<div style="min-width:220px;font-family:system-ui,sans-serif;">';

    if (p.image_url) {
      html += '<img src="' + p.image_url + '" style="width:100%;height:160px;object-fit:cover;border-radius:8px;margin-bottom:10px;" />';
    }

    html += '<div style="display:flex;gap:6px;margin-bottom:10px;">';
    html += '<span style="padding:3px 10px;border-radius:4px;font-size:11px;font-weight:700;color:' + sevColor + ';background:' + sevColor + '15;">' + p.severity + '</span>';
    html += '<span style="padding:3px 10px;border-radius:4px;font-size:11px;font-weight:600;color:' + stColor + ';background:' + stColor + '15;">' + stLabel + '</span>';
    html += '</div>';

    html += '<div style="font-size:12px;color:#a1a1aa;margin-bottom:8px;">';
    html += 'Confirmed by <span style="color:#e4e4e7;font-weight:600;">' + (p.detectors_count || 0) + '</span> detector' + ((p.detectors_count || 0) !== 1 ? 's' : '');
    html += '</div>';

    html += '<div style="margin-bottom:10px;">';
    html += '<div style="display:flex;justify-content:space-between;margin-bottom:4px;">';
    html += '<span style="font-size:10px;color:#71717a;text-transform:uppercase;letter-spacing:0.1em;font-weight:600;">Confidence</span>';
    html += '<span style="font-size:11px;font-weight:600;color:' + conf.color + ';">' + conf.label + '</span>';
    html += '</div>';
    html += '<div style="height:4px;background:rgba(255,255,255,0.06);border-radius:2px;overflow:hidden;">';
    html += '<div style="height:100%;border-radius:2px;background:' + conf.color + ';width:' + conf.percent + '%;"></div>';
    html += '</div></div>';

    if (addrLines.length > 0) {
      html += '<div style="padding:8px;background:#141420;border-radius:8px;margin-bottom:8px;">';
      for (var a = 0; a < addrLines.length; a++) {
        html += '<div style="font-size:12px;color:#e4e4e7;line-height:1.5;">' + addrLines[a] + '</div>';
      }
      html += '</div>';
    } else {
      html += '<div style="font-size:11px;color:#6b7280;margin-bottom:8px;">' + p.lat.toFixed(4) + ', ' + p.lng.toFixed(4) + '</div>';
    }

    html += '<div style="display:flex;justify-content:space-between;margin-bottom:8px;">';
    html += '<div><span style="font-size:10px;color:#71717a;text-transform:uppercase;letter-spacing:0.05em;">First reported</span><br/><span style="font-size:12px;color:#e4e4e7;">' + (p.citizen_first_reported_at ? new Date(p.citizen_first_reported_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—') + '</span></div>';
    html += '<div style="text-align:right;"><span style="font-size:10px;color:#71717a;text-transform:uppercase;letter-spacing:0.05em;">Last activity</span><br/><span style="font-size:12px;color:#e4e4e7;">' + (p.latest_activity_at ? new Date(p.latest_activity_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—') + '</span></div>';
    html += '</div>';

    if (detectors && detectors.length > 0) {
      html += '<div style="padding:8px;background:#141420;border-radius:8px;margin-bottom:8px;">';
      html += '<div style="font-size:10px;color:#71717a;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;margin-bottom:6px;">Detected by (' + detectors.length + ')</div>';
      var maxDetectors = detectors.slice(0, 5);
      for (var d = 0; d < maxDetectors.length; d++) {
        var det = maxDetectors[d];
        var initial = (det.username || det.full_name || '?').charAt(0).toUpperCase();
        html += '<div style="display:flex;align-items:center;gap:8px;padding:4px 0;">';
        html += '<div style="width:24px;height:24px;border-radius:12px;background:rgba(230,168,23,0.15);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#e6a817;flex-shrink:0;">' + initial + '</div>';
        html += '<span style="font-size:12px;color:#e4e4e7;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + (det.username || det.full_name || 'Unknown') + '</span>';
        html += '<span style="font-size:10px;color:#71717a;flex-shrink:0;">' + new Date(det.detected_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + '</span>';
        html += '</div>';
      }
      if (detectors.length > 5) {
        html += '<div style="font-size:11px;color:#71717a;text-align:center;padding-top:4px;">and ' + (detectors.length - 5) + ' more</div>';
      }
      html += '</div>';
    }

    if (comments && comments.length > 0) {
      html += '<div style="padding:8px;background:#141420;border-radius:8px;margin-bottom:8px;">';
      html += '<div style="font-size:10px;color:#71717a;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;margin-bottom:6px;">Detection comments (' + comments.length + ')</div>';
      var maxComments = comments.slice(0, 3);
      for (var c = 0; c < maxComments.length; c++) {
        var com = maxComments[c];
        html += '<div style="display:flex;gap:6px;padding:4px 0;">';
        html += '<div style="width:22px;height:22px;border-radius:11px;background:rgba(230,168,23,0.15);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:#e6a817;flex-shrink:0;margin-top:1px;">' + (com.username || '?').charAt(0).toUpperCase() + '</div>';
        html += '<div style="flex:1;min-width:0;"><div style="font-size:11px;font-weight:600;color:#e4e4e7;">' + (com.username || 'Unknown') + '</div><div style="font-size:11px;color:#a1a1aa;margin-top:1px;">' + com.body + '</div></div>';
        html += '</div>';
      }
      if (comments.length > 3) {
        html += '<div style="font-size:11px;color:#71717a;text-align:center;padding-top:4px;">View all ' + comments.length + ' comments</div>';
      }
      html += '</div>';
    }

    // Verification buttons
    var verifyCount = 0;
    if (comments) {
      for (var ci = 0; ci < comments.length; ci++) {
        if (comments[ci].body && comments[ci].body.indexOf('✅') !== -1) verifyCount++;
      }
    }
    html += '<div style="padding:8px;background:#141420;border-radius:8px;margin-bottom:8px;">';
    html += '<div style="font-size:10px;color:#71717a;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;margin-bottom:6px;">Is this hazard still here?</div>';
    html += '<div style="display:flex;gap:6px;margin-bottom:4px;">';
    html += '<button id="verify-stillhere-' + p.id + '" style="flex:1;display:flex;align-items:center;justify-content:center;gap:4px;padding:6px 8px;border-radius:6px;border:1px solid rgba(34,197,94,0.2);background:rgba(34,197,94,0.05);color:#22c55e;font-size:11px;font-weight:600;cursor:pointer;outline:none;">Still here</button>';
    html += '<button id="verify-fixed-' + p.id + '" style="flex:1;display:flex;align-items:center;justify-content:center;gap:4px;padding:6px 8px;border-radius:6px;border:1px solid rgba(239,68,68,0.2);background:rgba(239,68,68,0.05);color:#ef4444;font-size:11px;font-weight:600;cursor:pointer;outline:none;">Fixed</button>';
    html += '</div>';
    html += '<div style="font-size:10px;color:#71717a;text-align:center;">' + verifyCount + ' community verification' + (verifyCount !== 1 ? 's' : '') + '</div>';
    html += '</div>';

    // Comment form
    html += '<div style="padding:8px;background:#141420;border-radius:8px;margin-bottom:8px;">';
    html += '<div style="display:flex;gap:6px;">';
    html += '<input id="comment-input-' + p.id + '" type="text" placeholder="Write a comment..." style="flex:1;padding:6px 10px;border-radius:6px;border:1px solid rgba(255,255,255,0.06);background:#0c0c14;color:#e4e4e7;font-size:12px;outline:none;min-width:0;" />';
    html += '<button id="comment-send-' + p.id + '" style="padding:6px 12px;border-radius:6px;background:rgba(230,168,23,0.15);color:#e6a817;font-size:11px;font-weight:700;border:none;cursor:pointer;outline:none;">Send</button>';
    html += '</div>';
    html += '</div>';

    html += '<div style="font-size:10px;color:#52525b;border-top:1px solid rgba(255,255,255,0.04);padding-top:6px;text-align:center;">Hazard #' + p.id + '</div>';
    html += '</div>';
    return html;
  }

  function loadAndRenderPothole(marker, p) {
    var popup = marker.getPopup();
    if (!popup) return;

    var loadingHtml = '<div style="min-width:220px;font-family:system-ui,sans-serif;padding:20px;text-align:center;color:#6b7280;">Loading pothole data...</div>';
    popup.setContent(loadingHtml);

    function loadAndRender() {
      fetch(SUPABASE_URL + '/rest/v1/rpc/get_pothole_detectors', {
        method: 'POST',
        headers: { 'apikey': SUPABASE_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_lat: p.lat, p_lng: p.lng })
      })
      .then(function(r) { return r.json(); })
      .then(function(detData) {
        var detectors = Array.isArray(detData) ? detData : [];
        fetch(SUPABASE_URL + '/rest/v1/rpc/get_detection_comments', {
          method: 'POST',
          headers: { 'apikey': SUPABASE_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({ p_pothole_id: parseInt(p.id) })
        })
        .then(function(r) { return r.json(); })
        .then(function(comData) {
          var comments = Array.isArray(comData) ? comData : [];
          var html = potholePopupHtml(p, detectors, comments);
          popup.setContent(html);
          setTimeout(function() {
            attachPotholeHandlers(marker, p);
          }, 0);
        })
        .catch(function() {
          var html = potholePopupHtml(p, detectors, []);
          popup.setContent(html);
          setTimeout(function() { attachPotholeHandlers(marker, p); }, 0);
        });
      })
      .catch(function() {
        var html = potholePopupHtml(p, [], []);
        popup.setContent(html);
        setTimeout(function() { attachPotholeHandlers(marker, p); }, 0);
      });
    }

    function attachPotholeHandlers(marker, p) {
      var stillHereBtn = document.getElementById('verify-stillhere-' + p.id);
      var fixedBtn = document.getElementById('verify-fixed-' + p.id);
      var commentInput = document.getElementById('comment-input-' + p.id);
      var commentSend = document.getElementById('comment-send-' + p.id);

      function doVerify(body) {
        fetch(SUPABASE_URL + '/rest/v1/rpc/create_detection_comment', {
          method: 'POST',
          headers: { 'apikey': SUPABASE_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({ p_pothole_id: parseInt(p.id), p_body: body })
        }).then(function() { loadAndRender(); });
      }

      if (stillHereBtn) stillHereBtn.onclick = function() { doVerify('✅ Still here'); };
      if (fixedBtn) fixedBtn.onclick = function() { doVerify('✅ Fixed'); };
      if (commentSend && commentInput) {
        var sendComment = function() {
          var text = commentInput.value.trim();
          if (!text) return;
          commentSend.textContent = '...';
          commentInput.disabled = true;
          fetch(SUPABASE_URL + '/rest/v1/rpc/create_detection_comment', {
            method: 'POST',
            headers: { 'apikey': SUPABASE_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ p_pothole_id: parseInt(p.id), p_body: text })
          }).then(function() {
            commentInput.value = '';
            commentInput.disabled = false;
            commentSend.textContent = 'Send';
            loadAndRender();
          }).catch(function() {
            commentInput.disabled = false;
            commentSend.textContent = 'Send';
          });
        };
        commentSend.onclick = sendComment;
        commentInput.onkeydown = function(e) {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendComment(); }
        };
      }
    }

    loadAndRender();
  }

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

    marker.bindPopup(potholePopupHtml(p, null, null), { maxWidth: 300, className: 'hazard-popup' });

    marker.on('popupopen', function() {
      loadAndRenderPothole(marker, p);
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

    var popupHtml = '<div class="hazard-popup">';
    if (cp.image_url) {
      popupHtml += '<img src="' + cp.image_url + '" style="width:100%;height:140px;object-fit:cover;border-radius:8px;margin-bottom:10px;" />';
    }
    if (cp.severity) {
      var sevColors = { Severe: '#dc2626', Moderate: '#f59e0b', Minor: '#22c55e' };
      var sevColor = sevColors[cp.severity] || '#6b7280';
      popupHtml += '<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;color:' + sevColor + ';background:' + sevColor + '15;margin-right:4px;">' + cp.severity + '</span>';
    }
    var statusColors = { pending: '#6b7280', processed: '#06b6d4', no_detection: '#3f3f46' };
    var sColor = statusColors[cp.status] || '#6b7280';
    popupHtml += '<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;color:' + sColor + ';background:' + sColor + '15;margin-bottom:8px;">' + (cp.status === 'pending' ? 'Analyzing...' : cp.status === 'processed' ? 'Detected' : 'No Distress') + '</span>';

    if (cp.status === 'processed' && cp.class_name) {
      popupHtml += '<div style="font-size:12px;color:#a1a1aa;margin-bottom:6px;"><span style="color:#e4e4e7;font-weight:600;">' + cp.class_name + '</span>' + (cp.confidence != null ? ' &middot; ' + (cp.confidence * 100).toFixed(0) + '% confidence' : '') + '</div>';
    }
    if (cp.status === 'pending') {
      popupHtml += '<div style="font-size:12px;color:#6b7280;margin-bottom:6px;">Awaiting analysis...</div>';
    }

    var addrLines = [];
    if (cp.street) addrLines.push(cp.street);
    if (cp.barangay) addrLines.push(cp.barangay);
    if (cp.city) addrLines.push(cp.city);
    if (cp.province) addrLines.push(cp.province);
    if (cp.region && cp.region !== cp.province) addrLines.push(cp.region);
    if (cp.country) addrLines.push(cp.country);

    if (addrLines.length > 0) {
      popupHtml += '<div style="padding:8px;background:#141420;border-radius:8px;margin-bottom:6px;">';
      for (var k = 0; k < addrLines.length; k++) {
        popupHtml += '<div style="font-size:12px;color:#e4e4e7;line-height:1.5;">' + addrLines[k] + '</div>';
      }
      popupHtml += '</div>';
    } else if (cp.formatted_address) {
      popupHtml += '<div style="font-size:11px;color:#6b7280;margin-bottom:6px;">' + cp.formatted_address + '</div>';
    }

    popupHtml += '<div style="font-size:11px;color:#52525b;border-top:1px solid rgba(255,255,255,0.04);padding-top:4px;">';
    popupHtml += 'by <span style="color:#a1a1aa;">' + (cp.reporter_username || 'Anonymous') + '</span> &middot; ' + (cp.created_at ? new Date(cp.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '');
    popupHtml += '</div></div>';
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

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ''

export default function MapVerificationScreen({ recordings, onBack }: Props) {
  const [routes, setRoutes] = useState<RouteData[]>([])
  const [potholes, setPotholes] = useState<PotholeData[]>([])
  const [communityPhotos, setCommunityPhotos] = useState<CommunityPhoto[]>([])
  const [loading, setLoading] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('both')
  const webViewRef = useRef<WebView>(null)

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
              street: p.street ?? null,
              barangay: p.barangay ?? null,
              city: p.city ?? null,
              province: p.province ?? null,
              region: p.region ?? null,
              country: p.country ?? null,
              formatted_address: p.formatted_address ?? null,
              citizen_first_reported_at: p.citizen_first_reported_at ?? null,
              latest_activity_at: p.latest_activity_at ?? null,
              detectors_count: Number(p.detectors_count ?? 0),
            })),
          )
        }
      } catch (e) {
        console.log('[MapScreen] pothole fetch failed:', e)
      }

      try {
        const { data: photoData, error: photoError } = await supabase
          .from('v_community_photos')
          .select('id, latitude, longitude, detection_status, worst_severity, image_url, formatted_address, street, barangay, city, province, region, country, confidence, class_name, reporter_username, created_at')
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
    () => buildMapHtml(routes, potholes, communityPhotos, viewMode, MAPTILER_KEY, SUPABASE_URL, SUPABASE_ANON_KEY),
    [routes, potholes, communityPhotos, viewMode],
  )

  const totalPoints = routes.reduce((s, r) => s + r.coords.length, 0)

  const handleWebViewMessage = useCallback((_event: WebViewMessageEvent) => {
    // no-op — pothole popups rendered inside WebView now
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
