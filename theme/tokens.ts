// SIPAT design tokens — direction "Vision meets Infrastructure"
// Highway-signage type (Overpass, drawn after Highway Gothic), asphalt
// surfaces, cyan detection accent, YOLO detection-bracket signature.
// Severity colors are locked: they match the paper, web map, and feed.

export const colors = {
  // Surfaces (asphalt)
  background: '#0E1013',
  surface: '#16191E',
  surfaceRaised: '#1D2126',
  hairline: 'rgba(255, 255, 255, 0.07)',
  hairlineStrong: 'rgba(255, 255, 255, 0.14)',

  // Brand accent
  signal: '#06B6D4',
  signalBright: '#22D3EE',
  signalDim: 'rgba(6, 182, 212, 0.10)',
  signalLine: 'rgba(6, 182, 212, 0.50)',
  onSignal: '#0B0E11',

  // Semantic status (locked across app + paper)
  severe: '#EF4444',
  severeDim: 'rgba(239, 68, 68, 0.10)',
  moderate: '#F59E0B',
  moderateDim: 'rgba(245, 158, 11, 0.10)',
  minor: '#22C55E',
  minorDim: 'rgba(34, 197, 94, 0.10)',
  queued: '#60A5FA',
  queuedDim: 'rgba(96, 165, 250, 0.12)',

  // Text
  textPrimary: '#FAFAFA',
  textSecondary: '#A1A1AA',
  textMuted: '#71717A',
} as const

export const fonts = {
  regular: 'Overpass_400Regular',
  medium: 'Overpass_500Medium',
  semibold: 'Overpass_600SemiBold',
  bold: 'Overpass_700Bold',
  extrabold: 'Overpass_800ExtraBold',
  mono: 'OverpassMono_400Regular',
  monoMedium: 'OverpassMono_500Medium',
  monoBold: 'OverpassMono_700Bold',
} as const

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const

export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const
