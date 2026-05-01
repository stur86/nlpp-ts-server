import { beforeAll, test, expect } from 'bun:test'
import { initParser, parse } from './parser.ts'
import { getDefinition } from './definition.ts'
import type { Language } from './types.ts'

let language: Language

beforeAll(async () => {
  language = await initParser()
})

test('resolves define statement in same file', async () => {
  const src = 'define aggregate "A DDD aggregate root."\naggregate Order {}'
  const tree = parse(language, src)
  // "aggregate" on line 1, char 0 — should resolve to the define on line 0
  const loc = await getDefinition(language, tree, { line: 1, character: 0 })
  expect(loc).not.toBeNull()
  expect(loc!.range.start.line).toBe(0)
  expect(loc!.uri).toBe('')
})

test('resolves block declaration in same file', async () => {
  const src = 'class OrderService {}\nclass Client {\n  uses OrderService\n}'
  const tree = parse(language, src)
  // "OrderService" in uses_statement, line 2 char 6
  const loc = await getDefinition(language, tree, { line: 2, character: 6 })
  expect(loc).not.toBeNull()
  expect(loc!.range.start.line).toBe(0)
})

test('returns null for undefined symbol', async () => {
  const tree = parse(language, 'class Foo {}')
  const loc = await getDefinition(language, tree, { line: 0, character: 6 })
  expect(loc).toBeNull()
})

test('returns null for built-in keyword', async () => {
  const tree = parse(language, 'class Foo {}')
  const loc = await getDefinition(language, tree, { line: 0, character: 0 })
  expect(loc).toBeNull()
})

test('resolves define from imported file', async () => {
  const src = 'import "./defs.nlpp"\nsaga MySaga {}'
  const tree = parse(language, src)
  const resolver = async (path: string) => {
    if (path.endsWith('defs.nlpp')) return 'define saga "A long-running process."\n'
    throw new Error('not found')
  }
  const loc = await getDefinition(language, tree, { line: 1, character: 0 }, resolver)
  expect(loc).not.toBeNull()
  expect(loc!.uri).toMatch(/defs\.nlpp$/)
  expect(loc!.range.start.line).toBe(0)
})
