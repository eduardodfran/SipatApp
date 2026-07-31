// SipatApp Color Theme
// Matches web app dark theme from globals.css

export const colors = {
  // Backgrounds
  background: '#0c0c14',
  asphalt: '#09090b',

  // Surfaces
  surface: '#18181b',
  surfaceRaised: '#1c1c22',
  surfaceHover: '#27272a',

  // Primary accent (cyan - matches web)
  accent: '#06b6d4',
  accentHover: '#22d3ee',
  accentDim: 'rgba(6, 182, 212, 0.1)',

  // Status colors
  green: '#22c55e',
  amber: '#f59e0b',
  red: '#ef4444',

  // Text
  textPrimary: '#fafafa',
  textSecondary: '#a1a1aa',
  textMuted: '#71717a',

  // Borders
  border: 'rgba(255, 255, 255, 0.06)',

  // Legacy mobile colors (to be phased out)
  gold: '#e6a817',
  goldDim: 'rgba(230, 168, 23, 0.1)',
  goldBorder: 'rgba(230, 168, 23, 0.25)',
} as const;

export type Colors = typeof colors;
