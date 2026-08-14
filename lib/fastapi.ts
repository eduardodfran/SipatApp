import { AZURE_URL, LOCAL_URL } from './env'

const AZURE_TIMEOUT = 3_000
const FALLBACK_TIMEOUT = 30_000

let preferAzure: boolean | null = null

function fetchWithTimeout(url: string, options: RequestInit = {}, timeout: number): Promise<Response> {
  const opts = { ...options }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out after ${timeout / 1000}s — ${url}`)), timeout)
    fetch(url, opts as any).then(resolve, reject).finally(() => clearTimeout(timer))
  })
}

async function probeUrl(url: string, timeout: number): Promise<boolean> {
  try {
    await fetchWithTimeout(`${url}/health/ready`, { method: 'GET' }, timeout)
    return true
  } catch {
    return false
  }
}

function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError) return true
  if (err instanceof Error && /timed out|fetch failed|network|unreachable|eos|end of stream/i.test(err.message)) return true
  return false
}

async function determinePreferredUrl(): Promise<'azure' | 'local'> {
  // On first call, probe both URLs with a lightweight health check
  const azureOk = await probeUrl(AZURE_URL, AZURE_TIMEOUT)
  if (azureOk) {
    console.log('[fetchFastApi] probed Azure — reachable')
    return 'azure'
  }

  const localOk = await probeUrl(LOCAL_URL, FALLBACK_TIMEOUT)
  if (localOk) {
    console.log('[fetchFastApi] probed Azure — unreachable, local OK')
    return 'local'
  }

  console.warn('[fetchFastApi] both Azure and local unreachable during probe')
  return 'local'
}

export async function fetchFastApi(path: string, options: RequestInit = {}): Promise<Response> {
  // Probe phase — determine which server to use (only on first call)
  if (preferAzure === null) {
    const preferred = await determinePreferredUrl()
    preferAzure = preferred === 'azure'
  }

  const primaryUrl = preferAzure ? AZURE_URL : LOCAL_URL
  const fallbackUrl = preferAzure ? LOCAL_URL : AZURE_URL

  // Primary attempt
  try {
    return await fetchWithTimeout(`${primaryUrl}${path}`, options, FALLBACK_TIMEOUT)
  } catch (err) {
    if (!isNetworkError(err)) throw err

    console.log(`[fetchFastApi] ${primaryUrl} failed, trying ${fallbackUrl}`)
    const resp = await fetchWithTimeout(`${fallbackUrl}${path}`, options, FALLBACK_TIMEOUT)
    preferAzure = !preferAzure
    console.log(`[fetchFastApi] switched to ${preferAzure ? 'Azure' : 'local'}`)
    return resp
  }
}

/** Reset cached preference so next call re-probes Azure vs local. */
export function resetFastApiPreference(): void {
  preferAzure = null
  console.log('[fetchFastApi] preference reset — will re-probe on next call')
}
