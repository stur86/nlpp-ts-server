import { beforeAll, test, expect } from 'bun:test'
import { initParser, parse, getDiagnostics, getHighlights, getFolding } from '../index.ts'
import type { Language } from '../index.ts'
import { readFileSync } from 'node:fs'

let language: Language

beforeAll(async () => {
  language = await initParser()
})

const EXAMPLE_PATH = new URL('../../nlpp-grammar/examples/class.nlpp', import.meta.url).pathname

test('full pipeline: initParser → parse → getDiagnostics on example file', () => {
  const src = readFileSync(EXAMPLE_PATH, 'utf8')
  const tree = parse(language, src)
  const diags = getDiagnostics(language, tree)
  expect(diags).toEqual([])
})

test('full pipeline: getHighlights returns results for example file', () => {
  const src = readFileSync(EXAMPLE_PATH, 'utf8')
  const tree = parse(language, src)
  const highlights = getHighlights(language, tree)
  expect(highlights.length).toBeGreaterThan(0)
})

test('full pipeline: getFolding returns results for example file', () => {
  const src = readFileSync(EXAMPLE_PATH, 'utf8')
  const tree = parse(language, src)
  const ranges = getFolding(tree)
  expect(ranges.length).toBeGreaterThan(0)
})
