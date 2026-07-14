import { readFileSync, writeFileSync } from 'fs'
import { createRequire } from 'module'
import path from 'path'
import { load as parseYaml } from 'js-yaml'

const _require = createRequire(import.meta.url)
const grammarDir = path.dirname(_require.resolve('nlpp-grammar/package.json'))
const scm = readFileSync(path.join(grammarDir, 'queries', 'highlights.scm'), 'utf8')

const escaped = scm.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')

const out = `// AUTO-GENERATED from nlpp-grammar/queries/highlights.scm — do not edit by hand\nexport const HIGHLIGHTS_QUERY = \`${escaped}\`\n`

writeFileSync(new URL('../src/queries.ts', import.meta.url).pathname, out)
console.log('codegen: wrote src/queries.ts from highlights.scm')

// Compile the keyword definitions into TS so there is no runtime file read —
// a bundler-independent alternative to reading data/keywords.yaml at runtime.
const yamlPath = new URL('../data/keywords.yaml', import.meta.url).pathname
const keywords = parseYaml(readFileSync(yamlPath, 'utf8')) as Record<string, string>
const kwOut = `// AUTO-GENERATED from data/keywords.yaml — do not edit by hand\nexport const KEYWORD_REGISTRY: Record<string, string> = ${JSON.stringify(keywords, null, 2)}\n`
writeFileSync(new URL('../src/keywords.data.ts', import.meta.url).pathname, kwOut)
console.log('codegen: wrote src/keywords.data.ts from keywords.yaml')
