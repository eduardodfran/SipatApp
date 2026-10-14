import 'react-native-get-random-values'
import 'react-native-url-polyfill/auto'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, BackHandler, Platform, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
// @ts-ignore - FileSystem is a legacy export that works at runtime
import { File, FileSystem, Directory, Paths } from 'expo-file-system'
import { User } from '@supabase/supabase-js'
import * as SplashScreen from 'expo-splash-screen'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Linking from 'expo-linking'
import {
  useFonts,
  Overpass_400Regular,
  Overpass_500Medium,
  Overpass_600SemiBold,
  Overpass_700Bold,
  Overpass_800ExtraBold,
} from '@expo-google-fonts/overpass'
import {
  OverpassMono_400Regular,
  OverpassMono_500Medium,
  OverpassMono_700Bold,
} from '@expo-google-fonts/overpass-mono'
import { supabase } from './lib/supabase'
import { fetchFastApi, resetFastApiPreference } from './lib/fastapi'
import LoginScreen from './screens/LoginScreen'
import DashboardScreen from './screens/DashboardScreen'
import DriveScreen from './screens/DriveScreen'
import CameraScreen from './screens/CameraScreen'
import MapVerificationScreen from './screens/MapVerificationScreen'
import PhotoCaptureScreen from './screens/PhotoCaptureScreen'
import FeedScreen from './screens/FeedScreen'
import FeedDetailScreen from './screens/FeedDetailScreen'
import ReviewScreen from './screens/ReviewScreen'
import OnboardingScreen from './screens/OnboardingScreen'
import RidesScreen from './screens/RidesScreen'
import SettingsScreen from './screens/SettingsScreen'
import PublicProfileScreen from './screens/PublicProfileScreen'
import SearchScreen from './screens/SearchScreen'
import AboutScreen from './screens/AboutScreen'
import NotificationsScreen from './screens/NotificationsScreen'
import AppSidebar from './components/AppSidebar'
import type { Recording } from './lib/types'
import { FASTAPI_URL } from './lib/env'
import { colors, fonts, radius } from './theme/tokens'
import { fetchMyRides, formatElapsed, triggerProcessing, uploadRideData } from './lib/uploadRideData'

SplashScreen.preventAutoHideAsync()

type Screen = 'onboarding' | 'login' | 'dashboard' | 'feed' | 'review' | 'feeddetail' | 'camera' | 'drive' | 'photo' | 'map' | 'rides' | 'settings' | 'publicprofile' | 'search' | 'about' | 'notifications'

export default function App() {
  const [screen, setScreen] = useState<Screen | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [uploadingIds, setUploadingIds] = useState<Set<string>>(new Set())
  const [uploadStatusText, setUploadStatusText] = useState<Record<string, string>>({})
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [feedRefreshKey, setFeedRefreshKey] = useState(0)
  const [lastUploadResult, setLastUploadResult] = useState<{ status: 'success' | 'error'; processStarted?: boolean; message?: string } | null>(null)
  const [searchFrom, setSearchFrom] = useState<Screen>('feed')
  const [notifFrom, setNotifFrom] = useState<Screen>('feed')
  const [profileFrom, setProfileFrom] = useState<Screen>('feed')

  const [fontsLoaded, fontError] = useFonts({
    Overpass_400Regular,
    Overpass_500Medium,
    Overpass_600SemiBold,
    Overpass_700Bold,
    Overpass_800ExtraBold,
    OverpassMono_400Regular,
    OverpassMono_500Medium,
    OverpassMono_700Bold,
  })

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync()
  }, [fontsLoaded, fontError])

  useEffect(() => {
    ;(async () => {
      try {
        const onboardingSeen = await AsyncStorage.getItem('@sipat_onboarding_seen')

        const { data } = await supabase.auth.getSession()
        const u = data.session?.user ?? null
        setUser(u)

        if (!onboardingSeen) {
          setScreen('onboarding')
        } else {
          setScreen(u ? 'dashboard' : 'login')
        }
      } catch {
        setScreen('login')
      }
    })()

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const u = session?.user ?? null
        setUser(u)
        setScreen((prev) => {
          if (prev === 'onboarding') return prev
          return u ? 'dashboard' : 'login'
        })
      },
    )
    return () => listener?.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const handleDeepLink = async (url: string) => {
      try {
        const parsed = Linking.parse(url)
        const params = parsed.queryParams as Record<string, string> | null
        if (!params) return
        const code = params.code as string | undefined
        const token_hash = params.token_hash as string | undefined
        const type = params.type as string | undefined
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (!error) console.log('[auth] deep link PKCE code exchanged — autologin')
          else console.warn('[auth] exchangeCodeForSession failed:', error.message)
        } else if (token_hash && type) {
          const { error } = await supabase.auth.verifyOtp({ token_hash, type: type as never })
          if (!error) console.log('[auth] deep link OTP verified — autologin')
          else console.warn('[auth] verifyOtp failed:', error.message)
        }
      } catch (e) {
        console.warn('[auth] deep link handling failed:', e)
      }
    }

    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink(url)
    })
    const sub = Linking.addEventListener('url', ({ url }) => handleDeepLink(url))
    return () => sub.remove()
  }, [])

  useEffect(() => {
    if (!user) return
    ;(async () => {
      try {
        const storedJson = await AsyncStorage.getItem('@sipat_recordings')
        let localRecordings: Recording[] = []
        if (storedJson) {
          try {
            localRecordings = JSON.parse(storedJson).filter((r: Recording) => !r.uploaded)
          } catch {}
        }

        // Cache validation: check if videoUri and csvUri files still exist.
        // Entries with missing files are KEPT as incomplete (visible) instead
        // of silently dropped — e.g. OS cache eviction deleting videos.
        const validatedLocal: Recording[] = []
        const validCsvPaths = new Set<string>()
        for (const r of localRecordings) {
          const videoInfo = r.videoUri ? await FileSystem.getInfoAsync(r.videoUri) : { exists: false }
          const csvInfo = r.csvUri ? await FileSystem.getInfoAsync(r.csvUri) : { exists: false }
          if (videoInfo.exists && csvInfo.exists) {
            validatedLocal.push(r)
            validCsvPaths.add(r.csvUri)
            console.log(`[restore] Validated recording ${r.id} — video=${r.videoUri}`)
          } else {
            const reason = !videoInfo.exists && !csvInfo.exists
              ? 'Video and GPS files are gone'
              : !videoInfo.exists
                ? 'Video file is gone (possibly cleared by the system to free space)'
                : 'GPS file is gone'
            console.log(`[restore] Marking recording ${r.id} incomplete — ${reason}`)
            validatedLocal.push({ ...r, uploaded: false, incomplete: true, incompleteReason: reason })
            if (r.csvUri) validCsvPaths.add(r.csvUri)
          }
        }

        // Orphan recovery: find CSV+video pairs on disk that have no Recording entry
        console.log(`[recover] Starting orphan scan...`)
        try {
          const knownVideoUris = new Set(validatedLocal.map((r) => r.videoUri))

          // Scan document dir for orphaned CSVs (gps_segment_N_TIMESTAMP.csv)
          let csvFiles: { uri: string; timestamp: number; segNum: number }[] = []
          try {
            const docDir = new Directory(Paths.document)
            console.log(`[recover] Document dir: ${Paths.document}, exists=${docDir.exists}`)
            if (docDir.exists) {
              const docEntries = docDir.list()
              console.log(`[recover] Document dir has ${docEntries.length} entries`)
              for (const entry of docEntries) {
                try {
                  if (entry instanceof File) {
                    const match = entry.name.match(/^gps_segment_(\d+)_(\d+)\.csv$/)
                    if (match) {
                      if (!validCsvPaths.has(entry.uri)) {
                        csvFiles.push({ uri: entry.uri, timestamp: parseInt(match[2], 10), segNum: parseInt(match[1], 10) })
                      }
                    }
                  }
                } catch (entryErr) {
                  console.log(`[recover] Error reading doc entry: ${entryErr}`)
                }
              }
            }
          } catch (docErr) {
            console.log(`[recover] Document scan failed: ${docErr}`)
          }
          console.log(`[recover] Found ${csvFiles.length} orphaned CSVs`)

          // Recursively scan cache AND document dirs for video files.
          // Videos now persist to documents (OS never purges those); cache is
          // still scanned for recordings made before the move.
          let mp4Files: { uri: string; modificationTime: number }[] = []
          try {
            const isVideoFile = (name: string) => /\.(mp4|mov)$/i.test(name)
            const scanDir = (dir: Directory, depth: number = 0) => {
              try {
                if (!dir.exists) return
                const entries = dir.list()
                if (depth === 0) console.log(`[recover] Scan dir: ${dir.uri}, exists=${dir.exists}, has ${entries.length} entries`)
                for (const entry of entries) {
                  try {
                    if (entry instanceof Directory) {
                      // Only recurse one level to avoid walking the whole tree.
                      if (depth < 1) scanDir(entry, depth + 1)
                    } else if (entry instanceof File && isVideoFile(entry.name) && !knownVideoUris.has(entry.uri)) {
                      const info = entry.info()
                      mp4Files.push({ uri: entry.uri, modificationTime: info.modificationTime ?? 0 })
                    }
                  } catch (entryErr) {
                    console.log(`[recover] Error reading cache entry: ${entryErr}`)
                  }
                }
              } catch (dirErr) {
                console.log(`[recover] scanDir failed for ${dir.uri}: ${dirErr}`)
              }
            }
            scanDir(new Directory(Paths.cache))
            scanDir(new Directory(Paths.document))
          } catch (cacheErr) {
            console.log(`[recover] Cache scan failed: ${cacheErr}`)
          }
          console.log(`[recover] Found ${mp4Files.length} unmatched video files`)
          for (const v of mp4Files) {
            console.log(`[recover]   video: ${v.uri} modTime=${v.modificationTime}`)
          }

          // Match CSVs to videos by timestamp proximity (within 5 seconds)
          for (const csv of csvFiles) {
            console.log(`[recover] Looking for video match for CSV ts=${csv.timestamp} seg=${csv.segNum}`)
            const matched = mp4Files.find(
              (v) => Math.abs(v.modificationTime - csv.timestamp) < 5_000,
            )
            if (matched) {
              const rec: Recording = {
                id: `recovered_${csv.timestamp}_${csv.segNum}`,
                videoUri: matched.uri,
                csvUri: csv.uri,
                timestamp: csv.timestamp,
                uploaded: false,
                recovered: true,
              }
              validatedLocal.push(rec)
              console.log(`[recover] MATCHED: ${matched.uri} + ${csv.uri}`)
            } else {
              // GPS without a video (e.g. OS purged the cache file) — surface
              // as incomplete instead of dropping silently.
              console.log(`[recover] No video match for CSV ts=${csv.timestamp} — marking incomplete`)
              validatedLocal.push({
                id: `recovered_broken_${csv.timestamp}_${csv.segNum}`,
                videoUri: '',
                csvUri: csv.uri,
                timestamp: csv.timestamp,
                uploaded: false,
                recovered: true,
                incomplete: true,
                incompleteReason: 'Video file is gone (possibly cleared by the system to free space)',
              })
            }
          }
        } catch (e) {
          console.log(`[recover] Orphan scan failed: ${e}`)
        }
        console.log(`[recover] Scan complete — total validated recordings: ${validatedLocal.length}`)

        const rides = await fetchMyRides()
        const serverRecordings: Recording[] = rides.map((r) => ({
          id: r.id,
          rideId: r.id,
          videoUri: r.video_bucket_path,
          csvUri: r.gps_bucket_path,
          timestamp: new Date(r.created_at).getTime(),
          uploaded: true,
          status: r.status,
          errorLog: r.error_log ?? undefined,
          progressPct: r.progress_pct ?? 0,
          progressStage: r.progress_stage ?? '',
          progressMessage: r.progress_message ?? '',
          storagePaths: { video: r.video_bucket_path, gps: r.gps_bucket_path },
        }))

        // Deduplication: skip local recordings that already exist on server (by rideId or timestamp)
        const serverRideIds = new Set(serverRecordings.map((r) => r.rideId).filter(Boolean))
        const deduplicatedLocal = validatedLocal.filter((r) => {
          if (serverRideIds.has(r.rideId)) return false
          // Also skip if a server recording has a close timestamp (orphan recovery vs upload)
          const isOnServer = serverRecordings.some(
            (s) => Math.abs(s.timestamp - r.timestamp) < 10_000,
          )
          return !isOnServer
        })

        setRecordings([...serverRecordings, ...deduplicatedLocal])
      } catch {
        // silently fail — user can pull-to-refresh later
      }
    })()
  }, [user])

  // Poll for status updates while any ride is processing
  const pollInterval = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    const hasProcessing = recordings.some((r) => r.status === 'processing')
    if (hasProcessing && !pollInterval.current) {
      pollInterval.current = setInterval(async () => {
        try {
          const rides = await fetchMyRides()
          console.log(`[poll] fetched ${rides.length} rides`)
          setRecordings((prev) =>
            prev.map((r) => {
              if (!r.uploaded) return r
              const updated = rides.find((s) => s.id === r.rideId)
              if (!updated) return r
              if (updated.status !== r.status) {
                console.log(`[poll] ride ${r.rideId?.slice(0,8)} status: ${r.status} → ${updated.status}`)
              }
              if (updated.status === r.status && r.status !== 'processing') return r
              return {
                ...r,
                status: updated.status,
                errorLog: updated.error_log ?? undefined,
                progressPct: updated.progress_pct ?? r.progressPct,
                progressStage: updated.progress_stage ?? r.progressStage,
                progressMessage: updated.progress_message ?? r.progressMessage,
              }
            }),
          )
        } catch (e) {
          console.log(`[poll] fetchMyRides failed: ${e}`)
        }
      }, 2000)
    }
    if (!hasProcessing && pollInterval.current) {
      clearInterval(pollInterval.current)
      pollInterval.current = null
    }
    return () => {
      if (pollInterval.current) {
        clearInterval(pollInterval.current)
        pollInterval.current = null
      }
    }
  }, [recordings])

  // Persist recordings to AsyncStorage on every change
  useEffect(() => {
    ;(async () => {
      try {
        const toStore = recordings
          .filter((r) => !r.uploaded)
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, 50)
        const json = JSON.stringify(toStore)
        await AsyncStorage.setItem('@sipat_recordings', json)
      } catch {
        // best-effort
      }
    })()
  }, [recordings])

  const handleRefresh = useCallback(async () => {
    resetFastApiPreference()
    setRefreshing(true)
    try {
      const rides = await fetchMyRides()
      const serverRecordings: Recording[] = rides.map((r) => ({
        id: r.id,
        rideId: r.id,
        videoUri: r.video_bucket_path,
        csvUri: r.gps_bucket_path,
        timestamp: new Date(r.created_at).getTime(),
        uploaded: true,
        status: r.status,
        errorLog: r.error_log ?? undefined,
        progressPct: r.progress_pct ?? 0,
        progressStage: r.progress_stage ?? '',
        progressMessage: r.progress_message ?? '',
        storagePaths: { video: r.video_bucket_path, gps: r.gps_bucket_path },
      }))
      setRecordings((prev) => {
        const local = prev.filter((r) => !r.uploaded)
        // Deduplicate local against server by timestamp
        const deduped = local.filter(
          (r) => !serverRecordings.some((s) => Math.abs(s.timestamp - r.timestamp) < 10_000),
        )
        return [...serverRecordings, ...deduped]
      })
    } catch {
      // silently fail
    } finally {
      setRefreshing(false)
    }
  }, [])

  const addRecording = useCallback((rec: Recording) => {
    setRecordings((prev) => [rec, ...prev])
  }, [])

  const handleDeleteRecording = useCallback(
    async (recording: Recording) => {
      if (!recording.uploaded) {
        try {
          const csvFile = new File(recording.csvUri)
          if (csvFile.exists) csvFile.delete()
          const videoFile = new File(recording.videoUri)
          if (videoFile.exists) videoFile.delete()
        } catch {
          // best-effort
        }
      }

      if (recording.rideId) {
        try {
          const token = (await supabase.auth.getSession()).data.session?.access_token
          await fetchFastApi(`/rides/${recording.rideId}`, {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          })
        } catch {
          // best-effort
        }
      }
      setRecordings((prev) => prev.filter((r) => r.id !== recording.id))
    },
    [],
  )

  const handleUploadRecording = useCallback(
    async (recording: Recording) => {
      if (!user) {
        Alert.alert('Upload Failed', 'You must be signed in to upload a recording.')
        return
      }
      if (recording.uploaded) return

      setUploadingIds((prev) => new Set(prev).add(recording.id))
      try {
        const uploaded = await uploadRideData(user.id, recording.videoUri, recording.csvUri, undefined, (p) => {
          const stage = p.stage === 'gps' ? 'GPS' : p.stage === 'video' ? 'Video' : 'Finishing'
          const retryNote = p.attempt > 1 ? ` · retry ${p.attempt - 1}` : ''
          const pts = p.gpsPoints != null ? ` · ${p.gpsPoints} pts` : ''
          setUploadStatusText((prev) => ({
            ...prev,
            [recording.id]: `Uploading ${stage}…${retryNote} · ${formatElapsed(p.elapsedMs)}${pts}`,
          }))
        })

        setRecordings((prev) =>
          prev.map((item) =>
            item.id === recording.id
              ? {
                  ...item,
                  uploaded: true,
                  rideId: uploaded.rideId,
                  status: 'queued',
                  storagePaths: { video: uploaded.videoBucketPath, gps: uploaded.gpsBucketPath },
                }
              : item,
          ),
        )

        let processStarted = false
        try {
          await triggerProcessing(uploaded.rideId)
          processStarted = true
        } catch (procErr: any) {
          console.log(`[upload] auto-process failed for ${uploaded.rideId}, retrying in 3s: ${procErr}`)
          await new Promise((r) => setTimeout(r, 3000))
          try {
            await triggerProcessing(uploaded.rideId)
            processStarted = true
          } catch (retryErr: any) {
            console.log(`[upload] process retry also failed for ${uploaded.rideId}: ${retryErr}`)
          }
        }

        setRecordings((prev) =>
          prev.map((item) =>
            item.id === recording.id
              ? { ...item, status: processStarted ? 'processing' : 'queued' }
              : item,
          ),
        )

        if (processStarted) {
          setLastUploadResult({ status: 'success', processStarted: true })
        } else {
          setLastUploadResult({ status: 'success', processStarted: false })
        }
      } catch (error: any) {
        setLastUploadResult({ status: 'error', message: error?.message ?? 'Unknown error' })
      } finally {
        setUploadStatusText((prev) => {
          if (!(recording.id in prev)) return prev
          const next = { ...prev }
          delete next[recording.id]
          return next
        })
        setUploadingIds((prev) => {
          const next = new Set(prev)
          next.delete(recording.id)
          return next
        })
      }
    },
    [user],
  )

  const [sidebarVisible, setSidebarVisible] = useState(false)
  const [detailItem, setDetailItem] = useState<{ type: 'photo'; data: any } | { type: 'pothole'; data: any } | null>(null)
  const [focusItem, setFocusItem] = useState<{ type: 'photo' | 'pothole'; id: number | string } | null>(null)
  const [publicProfileUserId, setPublicProfileUserId] = useState<string | null>(null)

  // Android back button handler
  useEffect(() => {
    const onBackPress = () => {
      if (sidebarVisible) {
        setSidebarVisible(false)
        return true
      }
      switch (screen) {
        case 'feed':
        case 'review':
        case 'camera':
        case 'photo':
        case 'map':
        case 'rides':
        case 'settings':
          setScreen('dashboard')
          return true
        case 'feeddetail':
          setScreen('feed')
          return true
        case 'publicprofile':
          setScreen(profileFrom)
          return true
        default:
          return false
      }
    }
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress)
    return () => sub.remove()
  }, [screen, sidebarVisible, profileFrom])

  const handleViewOnMap = useCallback((item: { type: 'photo'; data: any } | { type: 'pothole'; data: any }) => {
    const id = item.type === 'photo' ? item.data.id : item.data.pothole_id
    setFocusItem({ type: item.type, id })
    setScreen('map')
  }, [])

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const handleProcessRecording = useCallback(
    async (recording: Recording) => {
      if (!recording.rideId) {
        Alert.alert('Cannot Process', 'Ride must be uploaded first.')
        return
      }

      setProcessingId(recording.id)
      try {
        await triggerProcessing(recording.rideId)
        setRecordings((prev) =>
          prev.map((item) =>
            item.id === recording.id ? { ...item, status: 'processing' } : item,
          ),
        )
        Alert.alert('Processing Started', 'Ride is being processed in the background.')
      } catch (error: any) {
        Alert.alert('Process Failed', error?.message ?? 'Unknown error')
      } finally {
        setProcessingId(null)
      }
    },
    [],
  )

  if (!fontsLoaded && !fontError) return null

  return (
    <SafeAreaProvider>
      {screen === 'onboarding' && (
        <OnboardingScreen
          onDone={() => {
            setScreen('login')
          }}
        />
      )}
      {screen === 'login' && <LoginScreen />}
      {screen === 'dashboard' && (
        <DashboardScreen
          recordings={recordings}
          uploadingIds={uploadingIds}
          processingId={processingId}
          onRefresh={handleRefresh}
          refreshing={refreshing}
          onRecord={() => setScreen('camera')}
          onDrive={() => setScreen('drive')}
          onPhoto={() => setScreen('photo')}
          onMap={() => setScreen('map')}
          onUpload={handleUploadRecording}
          onProcess={handleProcessRecording}
          onDelete={handleDeleteRecording}
          feedRefreshKey={feedRefreshKey}
          userId={user?.id ?? ''}
          onTabChange={(tab) => setScreen(tab)}
          onMenuPress={() => setSidebarVisible(true)}
          onReview={() => setScreen('review')}
          onNotifications={() => { setNotifFrom('dashboard'); setScreen('notifications') }}
          uploadStatusText={uploadStatusText}
        />
      )}
      {screen === 'rides' && (
        <RidesScreen
          recordings={recordings}
          uploadingIds={uploadingIds}
          uploadStatusText={uploadStatusText}
          processingId={processingId}
          onUpload={handleUploadRecording}
          onProcess={handleProcessRecording}
          onDelete={handleDeleteRecording}
          onRefresh={handleRefresh}
          refreshing={refreshing}
          onMenuPress={() => setSidebarVisible(true)}
        />
      )}
      {screen === 'feed' && (
        <FeedScreen
          feedRefreshKey={feedRefreshKey}
          userId={user?.id ?? ''}
          onTabChange={(tab) => setScreen(tab)}
          onPhoto={() => setScreen('photo')}
          onMenuPress={() => setSidebarVisible(true)}
          onSearch={() => { setSearchFrom('feed'); setScreen('search') }}
          onReview={() => setScreen('review')}
          onNotifications={() => { setNotifFrom('feed'); setScreen('notifications') }}
          onViewDetail={(item) => {
            setDetailItem(item)
            setScreen('feeddetail')
          }}
          onViewOnMap={handleViewOnMap}
          onViewProfile={(uid) => { setPublicProfileUserId(uid); setScreen('publicprofile') }}
        />
      )}
      {screen === 'review' && (
        <ReviewScreen
          onMenuPress={() => setSidebarVisible(true)}
          onViewDetail={(item) => {
            setDetailItem(item)
            setScreen('feeddetail')
          }}
          onGoFeed={() => setScreen('feed')}
          onGoMap={() => setScreen('map')}
          onViewProfile={(uid) => { setPublicProfileUserId(uid); setScreen('publicprofile') }}
        />
      )}
      {screen === 'feeddetail' && detailItem && (
        <FeedDetailScreen
          item={detailItem}
          userId={user?.id ?? ''}
          onBack={() => setScreen('feed')}
          onViewOnMap={handleViewOnMap}
          onViewProfile={(uid) => { setPublicProfileUserId(uid); setScreen('publicprofile') }}
        />
      )}
      {screen === 'drive' && (
        <DriveScreen onBack={() => setScreen('dashboard')} />
      )}
      {screen === 'camera' && (
        <CameraScreen
          onFinish={(rec) => {
            addRecording(rec)
            setLastUploadResult(null)
            handleUploadRecording(rec)
          }}
          onCancel={() => setScreen('dashboard')}
          onViewRides={() => setScreen('rides')}
          segmentCount={3}
          uploadResult={lastUploadResult}
        />
      )}
      {screen === 'photo' && (
        <PhotoCaptureScreen
          onDone={() => {
            setFeedRefreshKey((k) => k + 1)
            setScreen('dashboard')
          }}
          onCancel={() => setScreen('dashboard')}
        />
      )}
      {screen === 'map' && Platform.OS !== 'web' && (
        <MapVerificationScreen
          onBack={() => { setFocusItem(null); setScreen('dashboard') }}
          focusItem={focusItem}
          onViewFeedItem={(item) => { setDetailItem(item); setScreen('feeddetail') }}
          onMenuPress={() => setSidebarVisible(true)}
        />
      )}
      {screen === 'map' && Platform.OS === 'web' && (
        <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: colors.textMuted, fontFamily: fonts.regular, fontSize: 16 }}>Map view is not available on web.</Text>
          <TouchableOpacity onPress={() => setScreen('dashboard')} style={{ marginTop: 16, paddingVertical: 12, paddingHorizontal: 20, backgroundColor: colors.signal, borderRadius: radius.md }}>
            <Text style={{ color: colors.onSignal, fontFamily: fonts.semibold }}>Go Back</Text>
          </TouchableOpacity>
        </View>
      )}
      {screen === 'settings' && user && (
        <SettingsScreen user={user} onBack={() => setScreen('dashboard')} onAbout={() => setScreen('about')} />
      )}
      {screen === 'about' && (
        <AboutScreen onBack={() => setScreen('dashboard')} />
      )}
      {screen === 'publicprofile' && publicProfileUserId && (
        <PublicProfileScreen
          userId={publicProfileUserId}
          viewerId={user?.id ?? ''}
          onBack={() => setScreen(profileFrom)}
          onViewPhoto={(item) => { setDetailItem(item); setScreen('feeddetail') }}
          onViewPothole={(item) => { setDetailItem(item); setScreen('feeddetail') }}
        />
      )}
      {screen === 'search' && (
        <SearchScreen
          onBack={() => setScreen(searchFrom)}
          onViewProfile={(uid) => { setPublicProfileUserId(uid); setScreen('publicprofile') }}
          onViewPhoto={(item) => { setDetailItem(item); setScreen('feeddetail') }}
          onViewPothole={(item) => { setDetailItem(item); setScreen('feeddetail') }}
        />
      )}
      {screen === 'notifications' && (
        <NotificationsScreen
          userId={user?.id ?? ''}
          onBack={() => setScreen(notifFrom)}
          onOpenItem={(item) => { setDetailItem(item); setScreen('feeddetail') }}
        />
      )}

      <AppSidebar
        visible={sidebarVisible}
        activeTab={
          screen === 'feed'
            ? 'feed'
            : screen === 'review'
              ? 'review'
              : screen === 'rides'
                ? 'rides'
                : screen === 'map'
                  ? 'map'
                  : 'dashboard'
        }
        user={user}
        onClose={() => setSidebarVisible(false)}
        onTabChange={(tab) => setScreen(tab)}
        onLogout={handleLogout}
        onProfilePress={() => {
          if (!user?.id) return
          setPublicProfileUserId(user.id)
          setProfileFrom('dashboard')
          setScreen('publicprofile')
        }}
        onSettingsPress={() => setScreen('settings')}
        onAbout={() => setScreen('about')}
      />
    </SafeAreaProvider>
  )
}
