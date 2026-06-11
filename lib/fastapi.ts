import { fetch } from 'expo/fetch'
import { AZURE_URL, LOCAL_URL } from './env'

const AZURE_TIMEOUT = 5_000
const FALLBACK_TIMEOUT = 30_000

let preferAzure: boolean | null = null

function fetchWithTimeout(url: string, options: RequestInit = {}, timeout: number): Promise<Response> {
  const headers = new Headers(options.headers)
  headers.set('Connection', 'close')
  const opts = { ...options, headers }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out after ${timeout / 1000}s — ${url}`)), timeout)
    fetch(url, opts as any).then(resolve, reject).finally(() => clearTimeout(timer))
  })
}

async function tryUrl(url: string, path: string, options: RequestInit, timeout: number): Promise<Response | null> {
  try {
    return await fetchWithTimeout(`${url}${path}`, options, timeout)
  } catch {
    return null
  }
}

function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError) return true
  if (err instanceof Error && /timed out|fetch failed|network|unreachable|eos|end of stream/i.test(err.message)) return true
  return false
}

export async function fetchFastApi(path: string, options: RequestInit = {}): Promise<Response> {
  // Probe phase — either first call or preference was reset
  if (preferAzure === null) {
    const azureResp = await tryUrl(AZURE_URL, path, options, AZURE_TIMEOUT)
    if (azureResp) {
      preferAzure = true
      console.log('[fetchFastApi] using Azure')
      return azureResp
    }

    // Azure unreachable — try local
    const localResp = await tryUrl(LOCAL_URL, path, options, FALLBACK_TIMEOUT)
    if (localResp) {
      preferAzure = false
      console.log('[fetchFastApi] using local fallback')
      return localResp
    }

    throw new Error(
      `Cannot reach FastAPI at ${AZURE_URL}. Local fallback ${LOCAL_URL} also unreachable.`,
    )
  }

  // Cached phase — we already know which URL works
  const primaryUrl = preferAzure ? AZURE_URL : LOCAL_URL
  const fallbackUrl = preferAzure ? LOCAL_URL : AZURE_URL

  try {
    return await fetchWithTimeout(`${primaryUrl}${path}`, options, FALLBACK_TIMEOUT)
  } catch (err) {
    if (!isNetworkError(err)) throw err

    // Primary failed — try fallback and flip preference
    console.log(`[fetchFastApi] ${primaryUrl} failed, trying ${fallbackUrl}`)
    const resp = await tryUrl(fallbackUrl, path, options, FALLBACK_TIMEOUT)
    if (resp) {
      preferAzure = !preferAzure
      console.log(`[fetchFastApi] switched to ${preferAzure ? 'Azure' : 'local'}`)
      return resp
    }

    throw new Error(
      `Cannot reach FastAPI at ${AZURE_URL}. Local fallback ${LOCAL_URL} also unreachable.`,
    )
  }
}

/** Reset cached preference so next call re-probes Azure vs local. */
export function resetFastApiPreference(): void {
  preferAzure = null
  console.log('[fetchFastApi] preference reset — will re-probe on next call')
}
