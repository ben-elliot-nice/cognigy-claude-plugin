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

describe('charts.requires', () => {
  it('declares that flowId is required', () => {
    expect(charts.requires).toEqual(['flowId'])
  })
})

describe('charts.get', () => {
  it('calls GET /flows/:flowId/chart using params.flowId', async () => {
    const client = makeClient()
    await charts.get!('', client, env, { flowId: 'flow-abc' })
    expect(client.get).toHaveBeenCalledWith('/flows/flow-abc/chart')
  })

  it('falls back to env.flowId when params.flowId is absent', async () => {
    const client = makeClient()
    const envWithFlow: EnvConfig = { ...env, flowId: 'flow-env' }
    await charts.get!('', client, envWithFlow, {})
    expect(client.get).toHaveBeenCalledWith('/flows/flow-env/chart')
  })

  it('throws when flowId is absent from both params and env', async () => {
    const client = makeClient()
    await expect(charts.get!('', client, env, {})).rejects.toThrow('flowId is required')
  })
})
