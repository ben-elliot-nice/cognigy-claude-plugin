import type { CognigyClient, EnvConfig } from './types.js'

export function createClient(env: EnvConfig): CognigyClient {
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${env.apiToken}`,
    'Content-Type': 'application/json',
  }

  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${env.baseUrl}/v2.0${path}`
    const res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Cognigy API error ${res.status}: ${text}`)
    }

    if (res.status === 204) return undefined as T
    return res.json() as Promise<T>
  }

  return {
    get:    (path) => request('GET', path),
    post:   (path, body) => request('POST', path, body),
    patch:  (path, body) => request('PATCH', path, body),
    delete: (path) => request('DELETE', path),
  }
}
