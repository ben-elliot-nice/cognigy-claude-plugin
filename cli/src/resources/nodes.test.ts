import { describe, it, expect, vi } from 'vitest'
import { nodes } from './nodes.js'
import type { CognigyClient, EnvConfig } from '../lib/types.js'

const env: EnvConfig = {
  baseUrl: 'https://app.cognigy.ai',
  apiToken: 'test-token',
  projectId: 'proj-123',
  flowId: 'flow-abc',
}

const mockNode = {
  _id: 'node-xyz',
  type: 'code',
  label: 'Code Node',
  config: { script: 'return {}' },
}

function makeClient(overrides: Partial<CognigyClient> = {}): CognigyClient {
  return {
    get: vi.fn().mockResolvedValue(mockNode),
    post: vi.fn().mockResolvedValue(mockNode),
    patch: vi.fn().mockResolvedValue(mockNode),
    delete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe('nodes.list', () => {
  it('calls GET /flows/:flowId/chart/nodes with flowId from env', async () => {
    const client = makeClient()
    await nodes.list!(client, env, {})
    expect(client.get).toHaveBeenCalledWith('/flows/flow-abc/chart/nodes')
  })

  it('uses flowId from params over env', async () => {
    const client = makeClient()
    await nodes.list!(client, env, { flowId: 'flow-override' })
    expect(client.get).toHaveBeenCalledWith('/flows/flow-override/chart/nodes')
  })

  it('throws when flowId is missing from both params and env', async () => {
    const client = makeClient()
    const envWithout: EnvConfig = { baseUrl: 'x', apiToken: 'y' }
    await expect(nodes.list!(client, envWithout, {})).rejects.toThrow('flowId is required')
  })
})

describe('nodes.get', () => {
  it('calls GET /flows/:flowId/chart/nodes/:id with flowId from env', async () => {
    const client = makeClient()
    await nodes.get!('node-xyz', client, env, {})
    expect(client.get).toHaveBeenCalledWith('/flows/flow-abc/chart/nodes/node-xyz')
  })

  it('uses flowId from params over env', async () => {
    const client = makeClient()
    await nodes.get!('node-xyz', client, env, { flowId: 'flow-override' })
    expect(client.get).toHaveBeenCalledWith('/flows/flow-override/chart/nodes/node-xyz')
  })

  it('throws when flowId is missing', async () => {
    const client = makeClient()
    const envWithout: EnvConfig = { baseUrl: 'x', apiToken: 'y' }
    await expect(nodes.get!('node-xyz', client, envWithout, {})).rejects.toThrow('flowId is required')
  })
})

describe('nodes.create', () => {
  it('calls POST /flows/:flowId/chart/nodes with body', async () => {
    const client = makeClient()
    await nodes.create!({ type: 'code', target: 'node-abc', mode: 'append' }, client, env)
    expect(client.post).toHaveBeenCalledWith('/flows/flow-abc/chart/nodes', {
      type: 'code',
      target: 'node-abc',
      mode: 'append',
    })
  })

  it('uses flowId from params over env', async () => {
    const client = makeClient()
    await nodes.create!({ flowId: 'flow-override', type: 'code', target: 'node-abc', mode: 'append' }, client, env)
    expect(client.post).toHaveBeenCalledWith('/flows/flow-override/chart/nodes', {
      type: 'code',
      target: 'node-abc',
      mode: 'append',
    })
  })

  it('throws when flowId is missing from both params and env', async () => {
    const client = makeClient()
    const envWithout: EnvConfig = { baseUrl: 'x', apiToken: 'y' }
    await expect(
      nodes.create!({ type: 'code', target: 'node-abc', mode: 'append' }, client, envWithout)
    ).rejects.toThrow('flowId is required')
  })
})

describe('nodes.update', () => {
  it('calls PATCH /flows/:flowId/chart/nodes/:id', async () => {
    const client = makeClient()
    await nodes.update!('node-xyz', { label: 'Renamed', flowId: 'flow-abc' }, client, env)
    expect(client.patch).toHaveBeenCalledWith('/flows/flow-abc/chart/nodes/node-xyz', { label: 'Renamed' })
  })
})

describe('nodes.delete', () => {
  it('calls DELETE /flows/:flowId/chart/nodes/:id', async () => {
    const client = makeClient()
    await nodes.delete!('node-xyz', client, env, {})
    expect(client.delete).toHaveBeenCalledWith('/flows/flow-abc/chart/nodes/node-xyz')
  })
})

describe('nodes.operations.move', () => {
  it('calls POST /flows/:flowId/chart/nodes/:id/move with body', async () => {
    const client = makeClient()
    const op = nodes.operations?.['move']
    expect(op).toBeDefined()
    await op!('node-xyz', { flowId: 'flow-abc', target: 'node-abc', mode: 'insertAfter' }, client, env)
    expect(client.post).toHaveBeenCalledWith('/flows/flow-abc/chart/nodes/node-xyz/move', {
      target: 'node-abc',
      mode: 'insertAfter',
    })
  })
})
