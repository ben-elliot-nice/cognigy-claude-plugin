#!/usr/bin/env npx tsx
/**
 * Extracts TypeScript interfaces for a Cognigy resource from the bundled OpenAPI spec.
 * Usage: npx tsx scripts/extract-resource-types.ts <resource>
 * Example: npx tsx scripts/extract-resource-types.ts flow
 * Output: cli/src/resources/<resource>.types.ts
 */
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Args ──────────────────────────────────────────────────────────────────────

const resourceName = process.argv[2]
if (!resourceName || resourceName.includes('/') || resourceName.includes('.')) {
  console.error('Usage: npx tsx scripts/extract-resource-types.ts <resource>')
  console.error('Example: npx tsx scripts/extract-resource-types.ts flow')
  process.exit(1)
}

const Resource = resourceName.charAt(0).toUpperCase() + resourceName.slice(1)

// ── Load spec ─────────────────────────────────────────────────────────────────

const specPath = resolve(__dirname, '../openapi/cognigy.json')
const spec: any = JSON.parse(readFileSync(specPath, 'utf8'))

// ── Path discovery ────────────────────────────────────────────────────────────

interface FoundPaths {
  collectionPath: string  // e.g. /v2.0/flows
  recordPath: string      // e.g. /v2.0/flows/{flowId}
}

function findPaths(resourceName: string): FoundPaths {
  const allPaths = Object.keys(spec.paths)

  const collectionCandidates = allPaths.filter(p => {
    const match = p.match(/^\/v2\.0\/([^/]+)$/)
    return match && match[1].toLowerCase().includes(resourceName.toLowerCase())
  })

  if (collectionCandidates.length === 0) {
    console.error(`No collection path found for resource "${resourceName}". Check the resource name.`)
    process.exit(1)
  }
  if (collectionCandidates.length > 1) {
    console.error(`Multiple collection paths found for "${resourceName}": ${collectionCandidates.join(', ')}`)
    console.error('Be more specific with the resource name.')
    process.exit(1)
  }

  const collectionPath = collectionCandidates[0]

  const recordCandidates = allPaths.filter(p =>
    p.startsWith(collectionPath + '/') &&
    p.slice(collectionPath.length + 1).match(/^\{[^/]+\}$/)
  )

  if (recordCandidates.length === 0) {
    console.error(`No record path found for collection "${collectionPath}".`)
    process.exit(1)
  }

  return { collectionPath, recordPath: recordCandidates[0] }
}

// ── $ref resolution ───────────────────────────────────────────────────────────

function resolveRef(schema: any, visited = new Set<string>()): any {
  if (!schema || !schema.$ref) return schema
  const ref: string = schema.$ref
  if (visited.has(ref)) return { type: 'object' }
  visited.add(ref)
  const parts = ref.replace('#/', '').split('/')
  const resolved = parts.reduce((obj: any, key) => obj?.[key], spec)
  return resolveRef(resolved, visited)
}

// ── Schema extraction ─────────────────────────────────────────────────────────

function extractSchema(path: string, method: string, location: 'response' | 'requestBody'): any | null {
  const op = spec.paths[path]?.[method]
  if (!op) return null
  if (location === 'response') {
    return op.responses?.['200']?.content?.['application/json']?.schema ?? null
  }
  return op.requestBody?.content?.['application/json']?.schema ?? null
}

// ── Type inference ────────────────────────────────────────────────────────────

function isPureEnumOneOf(variants: any[]): boolean {
  return variants.every((v: any) => {
    const keys = Object.keys(v).filter(k => !['description', 'example'].includes(k))
    return keys.every(k => ['enum', 'type'].includes(k)) && Array.isArray(v.enum)
  })
}

function inferType(schema: any, indent: string): string {
  const resolved = resolveRef(schema)
  if (!resolved) return 'unknown'

  if (resolved.oneOf) {
    if (isPureEnumOneOf(resolved.oneOf)) {
      const values = resolved.oneOf.flatMap((v: any) => v.enum as string[])
      const deduped = [...new Set(values)]
      return (deduped as string[]).map(v => JSON.stringify(v)).join(' | ')
    }
    return 'unknown // TODO: oneOf — see OpenAPI spec'
  }

  if (resolved.anyOf) return 'unknown // TODO: anyOf — see OpenAPI spec'

  if (resolved.allOf) {
    const merged: any = { type: 'object', properties: {}, required: [] }
    for (const s of resolved.allOf) {
      const r = resolveRef(s)
      if (r?.properties) Object.assign(merged.properties, r.properties)
      if (r?.required) merged.required.push(...r.required)
    }
    return inferType(merged, indent)
  }

  if (resolved.enum) {
    return (resolved.enum as any[]).map(v => JSON.stringify(v)).join(' | ')
  }

  if (resolved.type === 'array') {
    const itemType = resolved.items ? inferType(resolved.items, indent) : 'unknown'
    return `${itemType}[]`
  }

  if (resolved.type === 'object' || resolved.properties) {
    if (!resolved.properties || Object.keys(resolved.properties).length === 0) {
      return 'Record<string, unknown>'
    }
    const required: string[] = resolved.required ?? []
    const childIndent = indent + '  '
    const lines = Object.entries(resolved.properties).map(([key, val]) => {
      const optional = required.includes(key) ? '' : '?'
      const type = inferType(val as any, childIndent)
      const nullable = (val as any).nullable ? ' | null' : ''
      return `${childIndent}${key}${optional}: ${type}${nullable}`
    })
    return `{\n${lines.join('\n')}\n${indent}}`
  }

  const nullable = resolved.nullable ? ' | null' : ''
  switch (resolved.type) {
    case 'string':  return `string${nullable}`
    case 'number':
    case 'integer': return `number${nullable}`
    case 'boolean': return `boolean${nullable}`
    default:        return `unknown${nullable}`
  }
}

// ── Interface generation ──────────────────────────────────────────────────────

function generateInterface(name: string, schema: any, allOptional: boolean): string {
  const resolved = resolveRef(schema)
  if (!resolved || (resolved.type !== 'object' && !resolved.properties)) {
    return `export interface ${name} {\n  // Schema not available or not an object type\n}`
  }
  const required: string[] = allOptional ? [] : (resolved.required ?? [])
  const props = Object.entries(resolved.properties ?? {}).map(([key, val]) => {
    const optional = required.includes(key) ? '' : '?'
    const type = inferType(val as any, '  ')
    const nullable = (val as any).nullable ? ' | null' : ''
    return `  ${key}${optional}: ${type}${nullable}`
  })
  return `export interface ${name} {\n${props.join('\n')}\n}`
}

// ── Main ──────────────────────────────────────────────────────────────────────

const { collectionPath, recordPath } = findPaths(resourceName)

const getSchema    = extractSchema(recordPath, 'get', 'response')
const postSchema   = extractSchema(collectionPath, 'post', 'requestBody')
const patchSchema  = extractSchema(recordPath, 'patch', 'requestBody')

const sections: string[] = [
  `// Generated from Cognigy OpenAPI spec`,
  `// Run: npx tsx scripts/extract-resource-types.ts ${resourceName}`,
  `// Do not edit manually — re-run the script to regenerate`,
  ``,
]

if (getSchema) {
  sections.push(generateInterface(Resource, getSchema, false))
  sections.push('')
} else {
  sections.push(`// ${Resource}: GET response schema not found in spec`)
  sections.push('')
}

if (postSchema) {
  sections.push(generateInterface(`Create${Resource}Input`, postSchema, false))
  sections.push('')
} else {
  sections.push(`export interface Create${Resource}Input {\n  // Not supported by this resource\n}`)
  sections.push('')
}

if (patchSchema) {
  sections.push(generateInterface(`Update${Resource}Input`, patchSchema, true))
  sections.push('')
} else {
  sections.push(`export interface Update${Resource}Input {\n  // Not supported by this resource\n}`)
  sections.push('')
}

const output = sections.join('\n')
const outPath = resolve(__dirname, `../src/resources/${resourceName}.types.ts`)
writeFileSync(outPath, output, 'utf8')

console.log(`Written: ${outPath}`)
console.log('')
console.log(output)
