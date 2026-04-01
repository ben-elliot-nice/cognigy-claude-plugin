// Generated from Cognigy OpenAPI spec
// Run: npx tsx scripts/extract-resource-types.ts flow
// Do not edit manually — re-run the script to regenerate

export interface Flow {
  referenceId?: string
  intentTrainGroupReference?: string
  feedbackReport?: {
    findings?: unknown // TODO: oneOf — see OpenAPI spec[]
    info?: {
      fScore?: number
    }
  }
  isTrainingOutOfDate?: boolean
  name?: string
  description?: string
  context?: Record<string, unknown>
  attachedFlows?: string[]
  attachedLexicons?: string[]
  img?: string
  _id?: string
  createdAt?: number
  lastChanged?: number
  createdBy?: string
  lastChangedBy?: string
}

export interface CreateFlowInput {
  name?: string
  description?: string
  context?: Record<string, unknown>
  attachedFlows?: string[]
  attachedLexicons?: string[]
  img?: string
  projectId?: string
}

export interface UpdateFlowInput {
  name?: string
  description?: string
  context?: Record<string, unknown>
  attachedFlows?: string[]
  attachedLexicons?: string[]
  img?: string
  localeId?: string
}
