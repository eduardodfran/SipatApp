import { useCallback, useEffect, useRef, useState } from 'react'
import { Vibration } from 'react-native'
import * as Location from 'expo-location'
import { Audio } from 'expo-av'
import {
  ALERT_COOLDOWN_MS,
  DriverPosition,
  HAZARD_REFRESH_MOVE_M,
  HAZARD_REFRESH_MS,
  HazardPoint,
  ProximityAlert,
  evaluateProximity,
  haversineMeters,
  loadNearbyHazards,
} from './proximityAlerts'

export type ProximityBanner = {
  text: string
  tier: 'warn' | 'urgent'
  hazardId: string
} | null

type UseProximityAlertsOptions = {
  /** Master switch (Drive screen toggle / recording toggle). */
  enabled: boolean
  /** When false, banner+vibration+sound are suppressed. */
  muted?: boolean
  /**
   * When true, the hook does NOT create its own GPS watch.
   * The caller feeds fixes via `pushPosition` (e.g. CameraScreen's
   * existing watch) to avoid duplicate location subscriptions.
   */
  externalGps?: boolean
}

const WARN_PATTERN = [0, 150, 100, 150]
const URGENT_PATTERN = [0, 300, 100, 300, 100, 300]

/**
 * Foreground proximity alerts for Driving Mode.
 * Owns its GPS watch, hazard cache, cooldowns, banner state, vibration + beep.
 * Caller renders `banner` and wires `muted` to a toggle.
 */
export function useProximityAlerts({ enabled, muted = false, externalGps = false }: UseProximityAlertsOptions) {
  const [banner, setBanner] = useState<ProximityBanner>(null)
  const [nextHazard, setNextHazard] = useState<(HazardPoint & { distM: number }) | null>(null)
  const [speedMps, setSpeedMps] = useState<number | null>(null)

  const hazardsRef = useRef<HazardPoint[]>([])
  const alertedRef = useRef<Set<string>>(new Set())
  const lastAlertAtRef = useRef(0)
  const lastLoadAtRef = useRef(0)
  const lastLoadPosRef = useRef<{ lat: number; lng: number } | null>(null)
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const subRef = useRef<Location.LocationSubscription | null>(null)
  const warnSoundRef = useRef<Audio.Sound | null>(null)
  const urgentSoundRef = useRef<Audio.Sound | null>(null)
  const mutedRef = useRef(muted)
  mutedRef.current = muted
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled

  const dismissBanner = useCallback(() => {
    if (bannerTimerRef.current) {
      clearTimeout(bannerTimerRef.current)
      bannerTimerRef.current = null
    }
    setBanner(null)
  }, [])

  const showBanner = useCallback(
    (alert: ProximityAlert) => {
      const dist = Math.round(alert.distM)
      const label = alert.hazard.street ?? 'road ahead'
      setBanner({
        text: alert.tier === 'urgent' ? `Slow down — ${dist}m` : `Pothole ahead — ${dist}m · ${label}`,
        tier: alert.tier,
        hazardId: alert.hazard.id,
      })
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current)
      bannerTimerRef.current = setTimeout(() => setBanner(null), 5000)
    },
    [],
  )

  const fireAlert = useCallback(
    async (alert: ProximityAlert) => {
      alertedRef.current.add(alert.hazard.id)
      lastAlertAtRef.current = Date.now()
      if (mutedRef.current) return
      showBanner(alert)
      Vibration.vibrate(alert.tier === 'urgent' ? URGENT_PATTERN : WARN_PATTERN)
      try {
        const sound = alert.tier === 'urgent' ? urgentSoundRef.current : warnSoundRef.current
        if (sound) await sound.replayAsync()
      } catch {
        // Audio session clash (e.g. camera recording) — vibration+banner still delivered.
      }
    },
    [showBanner],
  )

  // Preload beeps once (works even before GPS starts).
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true })
        const warn = new Audio.Sound()
        const urgent = new Audio.Sound()
        await warn.loadAsync(require('../assets/alert_warn.wav'))
        await urgent.loadAsync(require('../assets/alert_urgent.wav'))
        if (!cancelled) {
          warnSoundRef.current = warn
          urgentSoundRef.current = urgent
        } else {
          await warn.unloadAsync()
          await urgent.unloadAsync()
        }
      } catch {
        // Sound unavailable — vibration+banner path remains.
      }
    })()
    return () => {
      cancelled = true
      warnSoundRef.current?.unloadAsync().catch(() => {})
      urgentSoundRef.current?.unloadAsync().catch(() => {})
      warnSoundRef.current = null
      urgentSoundRef.current = null
    }
  }, [])

  const ensureHazards = useCallback(async (lat: number, lng: number) => {
    const now = Date.now()
    const moved = lastLoadPosRef.current
      ? haversineMeters(lastLoadPosRef.current.lat, lastLoadPosRef.current.lng, lat, lng)
      : Infinity
    if (moved > HAZARD_REFRESH_MOVE_M || now - lastLoadAtRef.current > HAZARD_REFRESH_MS) {
      lastLoadAtRef.current = now
      lastLoadPosRef.current = { lat, lng }
      try {
        hazardsRef.current = await loadNearbyHazards(lat, lng)
      } catch {
        // Keep stale cache on transient failure.
      }
    }
  }, [])

  const handleFix = useCallback(
    async (pos: DriverPosition) => {
      setSpeedMps(pos.speed)
      await ensureHazards(pos.lat, pos.lng)

      // Nearest-hazard card (radial, for display regardless of cone).
      let nearest: (HazardPoint & { distM: number }) | null = null
      for (const h of hazardsRef.current) {
        const distM = haversineMeters(pos.lat, pos.lng, h.lat, h.lng)
        if (!nearest || distM < nearest.distM) nearest = { ...h, distM }
      }
      setNextHazard(nearest && nearest.distM <= 500 ? nearest : null)

      if (Date.now() - lastAlertAtRef.current < ALERT_COOLDOWN_MS) return
      const alert = evaluateProximity(pos, hazardsRef.current, alertedRef.current)
      if (alert) await fireAlert(alert)
    },
    [ensureHazards, fireAlert],
  )

  /** Feed an externally-tracked GPS fix (externalGps mode). No-op when disabled. */
  const pushPosition = useCallback(
    (pos: DriverPosition) => {
      if (!enabledRef.current) return
      void handleFix(pos)
    },
    [handleFix],
  )

  // GPS watch lifecycle follows `enabled` (internal watch only).
  useEffect(() => {
    if (!enabled || externalGps) {
      if (!enabled) {
        subRef.current?.remove()
        subRef.current = null
        hazardsRef.current = []
        alertedRef.current = new Set()
        lastLoadPosRef.current = null
        setNextHazard(null)
        setSpeedMps(null)
        dismissBanner()
      }
      return
    }

    let cancelled = false
    ;(async () => {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted' || cancelled) return

      subRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 2000 },
        (loc) => {
          if (cancelled) return
          void handleFix({
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
            heading: loc.coords.heading ?? null,
            speed: loc.coords.speed ?? null,
          })
        },
      )
    })()

    return () => {
      cancelled = true
      subRef.current?.remove()
      subRef.current = null
      dismissBanner()
    }
  }, [enabled, externalGps, dismissBanner, handleFix])

  const resetSession = useCallback(() => {
    alertedRef.current = new Set()
    lastAlertAtRef.current = 0
    dismissBanner()
  }, [dismissBanner])

  return { banner, dismissBanner, nextHazard, speedMps, resetSession, pushPosition }
}
