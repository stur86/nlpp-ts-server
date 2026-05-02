import { beforeAll, test, expect } from 'bun:test'
import { initParser, parse } from './parser.ts'
import { getCompletions } from './completions.ts'
import { CompletionItemKind } from './types.ts'
import type { Language } from './types.ts'

let language: Language

beforeAll(async () => {
  language = await initParser()
})

test('returns keyword completions at top level', async () => {
  const tree = parse(language, '')
  const items = await getCompletions(language, tree, { line: 0, character: 0 })
  expect(items.length).toBeGreaterThan(0)
  const labels = items.map(i => i.label)
  expect(labels).toContain('class')
  expect(labels).toContain('function')
  expect(labels).toContain('layer')
})

test('completions include detail from registry', async () => {
  const tree = parse(language, '')
  const items = await getCompletions(language, tree, { line: 0, character: 0 })
  const classItem = items.find(i => i.label === 'class')
  expect(classItem).toBeDefined()
  expect(classItem!.detail).toBeDefined()
  expect(classItem!.detail!.length).toBeGreaterThan(0)
})

test('returns in-file define as completion', async () => {
  const src = 'define aggregate "A DDD aggregate root."\n'
  const tree = parse(language, src)
  const items = await getCompletions(language, tree, { line: 1, character: 0 })
  const labels = items.map(i => i.label)
  expect(labels).toContain('aggregate')
})

test('returns empty array inside prose block', async () => {
  const src = '/?\n  some text\n?/'
  const tree = parse(language, src)
  const items = await getCompletions(language, tree, { line: 1, character: 2 })
  expect(items).toEqual([])
})

test('cross-file defines appear when resolveFile provided', async () => {
  const src = 'import "./defs.nlpp"\n'
  const tree = parse(language, src)
  const resolver = async (path: string) => {
    if (path.endsWith('defs.nlpp')) return 'define saga "A long-running process."\n'
    throw new Error('not found')
  }
  const items = await getCompletions(language, tree, { line: 1, character: 0 }, resolver)
  const labels = items.map(i => i.label)
  expect(labels).toContain('saga')
})
