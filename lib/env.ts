function getHostIp(): string | null {
  try {
    const Constants = require('expo-constants').default as { hostUri?: string; expoConfig?: { hostUri?: string } }
    const hostUri: string | undefined = Constants?.hostUri ?? (Constants?.expoConfig as { hostUri?: string } | undefined)?.hostUri
    if (hostUri) {
      const host = hostUri.split(':')[0]?.split('/').pop() ?? null
      if (host && /^\d+\.\d+\.\d+\.\d+$/.test(host)) return host
    }
  } catch {}
  return null
}

const FALLBACK_LAN_IP = getHostIp() ?? '192.168.1.7'
const DEV_URL = process.env.EXPO_PUBLIC_LOCAL_URL || `http://${FALLBACK_LAN_IP}:8000`
const PROD_URL = 'http://4.193.125.81'

export const AZURE_URL = PROD_URL
export const LOCAL_URL = DEV_URL

export const API_URLS = [AZURE_URL, LOCAL_URL] as const

const isDev = typeof __DEV__ !== 'undefined' && __DEV__

export const FASTAPI_URL = isDev ? DEV_URL : PROD_URL

console.log(`[env] isDev=${isDev} hostIp=${FALLBACK_LAN_IP} → FASTAPI_URL=${FASTAPI_URL} LOCAL_URL=${LOCAL_URL} AZURE_URL=${AZURE_URL}`)
