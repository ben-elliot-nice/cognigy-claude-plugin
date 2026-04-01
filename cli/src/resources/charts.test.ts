import { describe, it, expect, vi } from 'vitest'
import { charts } from './charts.js'
import type { CognigyClient, EnvConfig } from '../lib/types.js'

const env: EnvConfig = {
  baseUrl: 'https://app.cognigy.ai',
  apiToken: 'test-token',
  projectId: 'proj-123',
}

const mockChart = {
  nodes: [{ _id: 'node-abc', type: 'if', label: 'My Node' }],
  relations: [{ _id: 'rel-abc', node: 'node-abc', children: [], next: null }],
}

function makeClient(overrides: Partial<CognigyClient> = {}): CognigyClient {
  return {
    get: vi.fn().mockResolvedValue(mockChart),
    post: vi.fn().mockResolvedValue({}),
    patch: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe('charts.get', () => {
  it('calls GET /flows/:flowId/chart', async () => {
    const client = makeClient()
    await charts.get!('flow-abc', client, env)
    expect(client.get).toHaveBeenCalledWith('/flows/flow-abc/chart')
  })
})
