import { beforeAll, test, expect } from 'bun:test'
import { initParser, parse } from './parser.ts'
import { getHover } from './hover.ts'
import type { Language } from './types.ts'

let language: Language

beforeAll(async () => {
  language = await initParser()
})

test('returns hover for built-in keyword at cursor', async () => {
  // "class Foo {}" — 'class' is at line 0, chars 0-4
  const tree = parse(language, 'class Foo {}')
  const result = await getHover(language, tree, { line: 0, character: 0 })
  expect(result).not.toBeNull()
  expect(result!.contents).toContain('concrete implementation type')
})

test('returns hover for function keyword', async () => {
  const tree = parse(language, 'method auto foo() {}')
  const result = await getHover(language, tree, { line: 0, character: 0 })
  expect(result).not.toBeNull()
  expect(result!.contents).toContain('callable member')
})

test('returns hover for in-file define term', async () => {
  const src = 'define aggregate "A DDD aggregate root."\naggregate Order {}'
  const tree = parse(language, src)
  // "aggregate" keyword on line 1, char 0
  const result = await getHover(language, tree, { line: 1, character: 0 })
  expect(result).not.toBeNull()
  expect(result!.contents).toContain('DDD aggregate root')
})

test('returns null for plain identifier', async () => {
  const tree = parse(language, 'class Foo {}')
  // "Foo" is at char 6
  const result = await getHover(language, tree, { line: 0, character: 6 })
  expect(result).toBeNull()
})

test('returns hover for define term from imported file', async () => {
  const src = 'import "./defs.nlpp"\nsaga MySaga {}'
  const tree = parse(language, src)
  const resolver = async (path: string) => {
    if (path.endsWith('defs.nlpp')) return 'define saga "A long-running process coordinator."\n'
    throw new Error('not found')
  }
  const result = await getHover(language, tree, { line: 1, character: 0 }, resolver)
  expect(result).not.toBeNull()
  expect(result!.contents).toContain('long-running process')
})
