import { readFileSync, writeFileSync } from 'fs'
import { load as parseYaml } from 'js-yaml'
import { HIGHLIGHTS_QUERY as scm } from 'nlpp-grammar'

// nlpp-grammar's entry point hands us the query directly. Previously this
// resolved 'nlpp-grammar/package.json' and walked to queries/highlights.scm by
// hand — a path the grammar's `exports` map does not list, so it worked only
// because bun's resolver ignores `exports`. Under Node it throws
// ERR_PACKAGE_PATH_NOT_EXPORTED.

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
