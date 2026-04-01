import type { CognigyClient, EnvConfig, ResourceHandlers } from '../lib/types.js'

export interface Project {
  _id: string
  name: string
  color?: string
  locale?: string
}

export const projects: ResourceHandlers = {
  async list(client) {
    return client.get<Project[]>('/projects')
  },

  async get(id, client) {
    return client.get<Project>(`/projects/${id}`)
  },

  async create(params, client) {
    return client.post<Project>('/projects', params)
  },

  async update(id, params, client) {
    return client.patch<Project>(`/projects/${id}`, params)
  },

  async delete(id, client) {
    return client.delete(`/projects/${id}`)
  },
}
