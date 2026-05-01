import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { load as parseYaml } from 'js-yaml'

const raw = readFileSync(join(import.meta.dirname, '../data/keywords.yaml'), 'utf8')
export const KEYWORD_REGISTRY: Record<string, string> = parseYaml(raw) as Record<string, string>

export const KEYWORD_NAMES = new Set(Object.keys(KEYWORD_REGISTRY))

export const RESERVED_KEYWORDS = new Set([
  'import', 'define', 'uses', 'field',
  'public', 'private', 'override',
  'function', 'method', 'getter', 'setter',
  'layer', 'module', 'service', 'component', 'class', 'interface', 'enum', 'type',
  'inherits', 'implements',
  'auto',
])
