import { fetch } from 'expo/fetch'
import { AZURE_URL, LOCAL_URL } from './env'

const API_TIMEOUT = 30_000
let workingUrl: string | null = null

function disableKeepAlive(options: RequestInit): RequestInit {
  const headers = new Headers(options.headers)
  headers.set('Connection', 'close')
  return { ...options, headers }
}

function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const opts = disableKeepAlive(options)
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Request timed out after ${API_TIMEOUT / 1000}s — ${url}`)),
      API_TIMEOUT,
    )
    fetch(url, opts).then(resolve, reject).finally(() => clearTimeout(timer))
  })
}

export async function fetchFastApi(path: string, options: RequestInit = {}): Promise<Response> {
  if (workingUrl) {
    return fetchWithTimeout(`${workingUrl}${path}`, options)
  }

  try {
    const resp = await fetchWithTimeout(`${AZURE_URL}${path}`, options)
    workingUrl = AZURE_URL
    console.log('[fetchFastApi] using Azure')
    return resp
  } catch {
    // Azure unreachable, try local
  }

  try {
    const resp = await fetchWithTimeout(`${LOCAL_URL}${path}`, options)
    workingUrl = LOCAL_URL
    console.log('[fetchFastApi] using local fallback')
    return resp
  } catch {
    throw new Error(
      `Cannot reach FastAPI at ${AZURE_URL}. Local fallback ${LOCAL_URL} also unreachable.`,
    )
  }
}
