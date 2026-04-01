import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createClient } from './client.js'
import type { EnvConfig } from './types.js'

const env: EnvConfig = {
  baseUrl: 'https://app.cognigy.ai',
  apiToken: 'test-token',
}

function mockFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  })
}

describe('createClient', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch(200, { _id: 'abc' }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('GET sets X-API-Key header and calls correct URL', async () => {
    const client = createClient(env)
    await client.get('/flows/abc')
    expect(fetch).toHaveBeenCalledWith(
      'https://app.cognigy.ai/v2.0/flows/abc',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ 'X-API-Key': 'test-token' }),
      })
    )
  })

  it('POST sends JSON body', async () => {
    const client = createClient(env)
    await client.post('/projects/proj/flows', { name: 'My Flow' })
    expect(fetch).toHaveBeenCalledWith(
      'https://app.cognigy.ai/v2.0/projects/proj/flows',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'My Flow' }),
      })
    )
  })

  it('PATCH sends JSON body', async () => {
    const client = createClient(env)
    await client.patch('/flows/abc', { name: 'Renamed' })
    expect(fetch).toHaveBeenCalledWith(
      'https://app.cognigy.ai/v2.0/flows/abc',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ name: 'Renamed' }),
      })
    )
  })

  it('DELETE calls correct URL', async () => {
    vi.stubGlobal('fetch', mockFetch(204, null))
    const client = createClient(env)
    await client.delete('/flows/abc')
    expect(fetch).toHaveBeenCalledWith(
      'https://app.cognigy.ai/v2.0/flows/abc',
      expect.objectContaining({ method: 'DELETE' })
    )
  })

  it('throws on non-2xx response', async () => {
    vi.stubGlobal('fetch', mockFetch(401, { message: 'Unauthorized' }))
    const client = createClient(env)
    await expect(client.get('/flows/abc')).rejects.toThrow('401')
  })
})
