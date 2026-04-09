// Generated from Cognigy OpenAPI spec
// Run: npx tsx scripts/extract-resource-types.ts node
// Do not edit manually — re-run the script to regenerate

export interface Node {
  type?: string
  extension?: string
  label?: string
  comment?: string
  commentColor?: unknown // TODO: oneOf — see OpenAPI spec
  isEntryPoint?: boolean
  isDisabled?: boolean
  config?: Record<string, unknown>
  localeReference?: string
  analyticsLabel?: string
  mock?: {
    isEnabled?: boolean
    code?: string
  }
  _id?: string
  conversionMetadata?: Record<string, unknown>
}

export interface CreateNodeInput {
  type: string
  extension?: string
  label?: string
  comment?: string
  commentColor?: unknown // TODO: oneOf — see OpenAPI spec
  isEntryPoint?: boolean
  isDisabled?: boolean
  config?: Record<string, unknown>
  localeReference?: string
  analyticsLabel?: string
  mock?: {
    isEnabled?: boolean
    code?: string
  }
  target: string
  mode: "append" | "prepend" | "appendChild" | "prependChild" | "insertChildAt" | "insertAfter" | "insertBefore"
  position?: number
}

export interface UpdateNodeInput {
  type?: string
  extension?: string
  label?: string
  comment?: string
  commentColor?: unknown // TODO: oneOf — see OpenAPI spec
  isEntryPoint?: boolean
  isDisabled?: boolean
  config?: Record<string, unknown>
  localeReference?: string
  analyticsLabel?: string
  mock?: {
    isEnabled?: boolean
    code?: string
  }
  localeId?: string
}
