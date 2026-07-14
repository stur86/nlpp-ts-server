import { KEYWORD_REGISTRY } from './keywords.data.ts'

/** Map of every built-in NL++ keyword to its definition string. */
export { KEYWORD_REGISTRY }

/** @internal */
export const KEYWORD_NAMES = new Set(Object.keys(KEYWORD_REGISTRY))

/** @internal */
export const RESERVED_KEYWORDS = new Set([
  'import', 'define', 'uses', 'field',
  'public', 'private', 'override',
  'function', 'method', 'getter', 'setter',
  'layer', 'module', 'service', 'component', 'class', 'interface', 'enum', 'type',
  'inherits', 'implements',
  'auto',
])
