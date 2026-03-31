export interface EnvConfig {
  baseUrl: string
  apiToken: string
  projectId?: string
  flowId?: string
}

export interface CognigyClient {
  get<T>(path: string): Promise<T>
  post<T>(path: string, body: unknown): Promise<T>
  patch<T>(path: string, body: unknown): Promise<T>
  delete(path: string): Promise<void>
}

export type ResourceHandlers = {
  get?: (id: string, client: CognigyClient, env: EnvConfig) => Promise<unknown>
  create?: (params: Record<string, string>, client: CognigyClient, env: EnvConfig) => Promise<unknown>
  update?: (id: string, params: Record<string, string>, client: CognigyClient, env: EnvConfig) => Promise<unknown>
  delete?: (id: string, client: CognigyClient, env: EnvConfig) => Promise<void>
}

export type ResourceRegistry = Record<string, ResourceHandlers>

export interface EnvFindResult {
  path: string
  fromWalk: boolean
}
