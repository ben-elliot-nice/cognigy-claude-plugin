import type { CognigyClient, EnvConfig, ResourceHandlers } from '../lib/types.js'

interface ChartNode {
  _id: string
  type?: string
  label?: string
}

interface ChartRelation {
  _id: string
  node: string
  children: string[]
  next?: string | null
}

interface Chart {
  nodes: ChartNode[]
  relations: ChartRelation[]
}

export const charts: ResourceHandlers = {
  async get(id, client) {
    return client.get<Chart>(`/flows/${id}/chart`)
  },
}
