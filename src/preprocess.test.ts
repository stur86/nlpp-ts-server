import { beforeAll, test, expect } from 'bun:test'
import { initParser } from './parser.ts'
import { preprocess, ImportError, CircularImportError } from './preprocess.ts'
import type { Language } from './types.ts'

let language: Language

beforeAll(async () => {
  language = await initParser()
})

const SIMPLE = `class OrderService {
  field auto id
}
`

const WITH_COMMENT = `// author comment
class Foo {
  /* block comment */
  field auto id
}
`

const WITH_PROSE = `service Bar {
  /?
    External boundary.
  ?/
}
`

const WITH_FILLIN = `class Foo {
  ???
  ??? add a method here
}
`

const WITH_DEFINE = `define aggregate "A DDD aggregate root."
aggregate Order {
  field auto id
}
`

const WITH_IMPORT = `import "./defs.nlpp"
aggregate Order {
  field auto id
}
`

const DEFS_CONTENT = `define aggregate "A DDD aggregate root."
`

const CIRCULAR_A = `import "./b.nlpp"
class A {}
`

const CIRCULAR_B = `import "./a.nlpp"
class B {}
`

const noopResolver = async (path: string): Promise<string> => {
  throw new Error(`Unexpected resolve: ${path}`)
}

test('output contains class keyword for simple file', async () => {
  const result = await preprocess(language, SIMPLE, '/entry.nlpp', noopResolver)
  expect(result.output).toContain('class OrderService')
  expect(result.warnings).toEqual([])
})

test('strips line comments', async () => {
  const result = await preprocess(language, WITH_COMMENT, '/entry.nlpp', noopResolver)
  expect(result.output).not.toContain('// author comment')
  expect(result.output).toContain('class Foo')
})

test('strips block comments', async () => {
  const result = await preprocess(language, WITH_COMMENT, '/entry.nlpp', noopResolver)
  expect(result.output).not.toContain('/* block comment */')
})

test('retains prose blocks as-is', async () => {
  const result = await preprocess(language, WITH_PROSE, '/entry.nlpp', noopResolver)
  expect(result.output).toContain('/?')
  expect(result.output).toContain('?/')
  expect(result.output).toContain('External boundary.')
})

test('retains fill-in markers as-is', async () => {
  const result = await preprocess(language, WITH_FILLIN, '/entry.nlpp', noopResolver)
  expect(result.output).toContain('???')
  expect(result.output).toContain('add a method here')
})

test('appends keyword glossary', async () => {
  const result = await preprocess(language, SIMPLE, '/entry.nlpp', noopResolver)
  expect(result.output).toContain('KEYWORD GLOSSARY')
  expect(result.output).toContain('class:')
})

test('glossary includes only keywords present in file', async () => {
  const result = await preprocess(language, SIMPLE, '/entry.nlpp', noopResolver)
  expect(result.output).not.toContain('function:')
})

test('glossary includes defined terms', async () => {
  const result = await preprocess(language, WITH_DEFINE, '/entry.nlpp', noopResolver)
  expect(result.output).toContain('aggregate:')
  expect(result.output).toContain('DDD aggregate root')
})

test('prepends the specification preamble', async () => {
  const result = await preprocess(language, SIMPLE, '/entry.nlpp', noopResolver)
  expect(result.output.startsWith('NL++ SPECIFICATION')).toBe(true)
})

test('preamble instructs to infer the target language and ask when ambiguous', async () => {
  const result = await preprocess(language, SIMPLE, '/entry.nlpp', noopResolver)
  expect(result.output).toContain('no programming language is fixed here')
  expect(result.output).toContain('surrounding codebase')
})

test('preamble instructs to check for reuse of existing declarations', async () => {
  const result = await preprocess(language, SIMPLE, '/entry.nlpp', noopResolver)
  expect(result.output).toContain('Reuse vs. new declaration')
  expect(result.output).toContain('already resolve to things declared')
})

test('preamble is present even for a file with no glossary terms', async () => {
  // A bare prose block yields no keyword/defined-term glossary, but the
  // preamble must still frame the output.
  const proseOnly = `/?\n  just prose\n?/\n`
  const result = await preprocess(language, proseOnly, '/entry.nlpp', noopResolver)
  expect(result.output.startsWith('NL++ SPECIFICATION')).toBe(true)
})

test('preamble is on by default when no options are passed', async () => {
  const result = await preprocess(language, SIMPLE, '/entry.nlpp', noopResolver)
  expect(result.output).toContain('NL++ SPECIFICATION')
})

test('preamble can be disabled with { preamble: false }', async () => {
  const result = await preprocess(language, SIMPLE, '/entry.nlpp', noopResolver, { preamble: false })
  expect(result.output).not.toContain('NL++ SPECIFICATION')
  // The pseudocode and glossary are still produced.
  expect(result.output).toContain('class OrderService')
  expect(result.output).toContain('KEYWORD GLOSSARY')
})

test('inlines imported file content', async () => {
  const resolver = async (path: string) => {
    if (path.endsWith('defs.nlpp')) return DEFS_CONTENT
    throw new Error('not found')
  }
  const result = await preprocess(language, WITH_IMPORT, '/entry.nlpp', resolver)
  expect(result.output).toContain('define aggregate')
  expect(result.output).not.toContain('import')
})

test('deduplicates imports', async () => {
  const src = `import "./defs.nlpp"\nimport "./defs.nlpp"\nclass Foo {}\n`
  const resolver = async () => DEFS_CONTENT
  const result = await preprocess(language, src, '/entry.nlpp', resolver)
  const count = (result.output.match(/define aggregate/g) ?? []).length
  expect(count).toBe(1)
})

test('warns on unresolved custom block keyword', async () => {
  const result = await preprocess(language, 'unknownkeyword Foo {}', '/entry.nlpp', noopResolver)
  expect(result.warnings.length).toBeGreaterThan(0)
  expect(result.warnings[0]!.kind).toBe('unresolved_custom_keyword')
  expect(result.warnings[0]!.keyword).toBe('unknownkeyword')
})

test('throws ImportError for unresolvable import path', async () => {
  const src = `import "./missing.nlpp"\nclass Foo {}\n`
  const failingResolver = async () => { throw new Error('ENOENT') }
  await expect(preprocess(language, src, '/entry.nlpp', failingResolver)).rejects.toBeInstanceOf(ImportError)
})

test('throws CircularImportError for circular imports', async () => {
  const resolver = async (path: string) => {
    if (path.endsWith('b.nlpp')) return CIRCULAR_B
    if (path.endsWith('a.nlpp')) return CIRCULAR_A
    throw new Error('not found')
  }
  await expect(preprocess(language, CIRCULAR_A, '/a.nlpp', resolver)).rejects.toBeInstanceOf(CircularImportError)
})

test('preserves reference and template type text verbatim', async () => {
  const src = `class Store {
  field &Array[int, 32] buffer
  method &Order fetch(Map[string, int] q) {
  }
}
`
  const result = await preprocess(language, src, '/entry.nlpp', noopResolver)
  expect(result.output).toContain('field &Array[int, 32] buffer')
  expect(result.output).toContain('method &Order fetch(Map[string, int] q)')
})
