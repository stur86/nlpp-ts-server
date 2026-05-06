import { readFileSync, writeFileSync } from 'fs'
import { createRequire } from 'module'
import path from 'path'

const _require = createRequire(import.meta.url)
const grammarDir = path.dirname(_require.resolve('nlpp-grammar/package.json'))
const scm = readFileSync(path.join(grammarDir, 'queries', 'highlights.scm'), 'utf8')

const escaped = scm.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')

const out = `// AUTO-GENERATED from nlpp-grammar/queries/highlights.scm — do not edit by hand\nexport const HIGHLIGHTS_QUERY = \`${escaped}\`\n`

writeFileSync(new URL('../src/queries.ts', import.meta.url).pathname, out)
console.log('codegen: wrote src/queries.ts from highlights.scm')
