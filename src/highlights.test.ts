import { beforeAll, test, expect } from 'bun:test'
import { initParser, parse } from './parser.ts'
import { getHighlights } from './highlights.ts'
import type { Language } from './types.ts'

let language: Language

beforeAll(async () => {
  language = await initParser()
})

test('returns highlights for a simple class', () => {
  const tree = parse(language, 'class Foo {}')
  const highlights = getHighlights(language, tree)
  expect(highlights.length).toBeGreaterThan(0)
})

test('class keyword has keyword.type scope', () => {
  const tree = parse(language, 'class Foo {}')
  const highlights = getHighlights(language, tree)
  const classHighlight = highlights.find(h => h.scope === 'keyword.type')
  expect(classHighlight).toBeDefined()
})

test('function keyword has keyword.function scope', () => {
  const tree = parse(language, 'method auto place_order() {}')
  const highlights = getHighlights(language, tree)
  const fnHighlight = highlights.find(h => h.scope === 'keyword.function')
  expect(fnHighlight).toBeDefined()
})

test('line comment has comment.line scope', () => {
  const tree = parse(language, '// this is a comment\nclass Foo {}')
  const highlights = getHighlights(language, tree)
  const commentHighlight = highlights.find(h => h.scope === 'comment.line')
  expect(commentHighlight).toBeDefined()
})

test('highlights are in document order', () => {
  const tree = parse(language, 'class Foo { field auto id }')
  const highlights = getHighlights(language, tree)
  for (let i = 1; i < highlights.length; i++) {
    expect(highlights[i]!.startIndex).toBeGreaterThanOrEqual(highlights[i - 1]!.startIndex)
  }
})

test('returns empty array for empty input', () => {
  const tree = parse(language, '')
  expect(getHighlights(language, tree)).toEqual([])
})
