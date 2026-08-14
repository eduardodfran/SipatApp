const DEV_URL = process.env.EXPO_PUBLIC_LOCAL_URL || 'http://192.168.1.7:8000'
const PROD_URL = 'http://85.211.193.145'

export const AZURE_URL = PROD_URL
export const LOCAL_URL = DEV_URL

export const API_URLS = [AZURE_URL, LOCAL_URL] as const

const isDev = typeof __DEV__ !== 'undefined' && __DEV__

export const FASTAPI_URL = isDev ? DEV_URL : PROD_URL

console.log(`[env] isDev=${isDev} → FASTAPI_URL=${FASTAPI_URL}`)
