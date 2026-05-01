import { beforeAll, test, expect } from 'bun:test'
import { initParser, parse } from './parser.ts'
import { getFolding } from './folding.ts'
import type { Language } from './types.ts'

let language: Language

beforeAll(async () => {
  language = await initParser()
})

const MULTILINE_CLASS = `class Foo {
  field auto id
  field auto name
}`

const BLOCK_COMMENT = `/*
  This spans
  multiple lines
*/
class Foo {}`

const PROSE_BLOCK = `service Bar {
  /?
    External boundary.
  ?/
}`

test('returns folding range for multi-line block body', () => {
  const tree = parse(language, MULTILINE_CLASS)
  const ranges = getFolding(tree)
  const bodyRange = ranges.find(r => r.kind === 'region')
  expect(bodyRange).toBeDefined()
  expect(bodyRange!.startLine).toBe(0)
  expect(bodyRange!.endLine).toBe(3)
})

test('returns folding range for block comment', () => {
  const tree = parse(language, BLOCK_COMMENT)
  const ranges = getFolding(tree)
  const commentRange = ranges.find(r => r.kind === 'comment')
  expect(commentRange).toBeDefined()
  expect(commentRange!.startLine).toBe(0)
  expect(commentRange!.endLine).toBe(3)
})

test('returns folding range for prose block', () => {
  const tree = parse(language, PROSE_BLOCK)
  const ranges = getFolding(tree)
  const proseRange = ranges.find(r => r.kind === 'region')
  expect(proseRange).toBeDefined()
  expect(proseRange!.startLine).toBeGreaterThanOrEqual(1)
})

test('does not return folding range for single-line block', () => {
  const tree = parse(language, 'class Foo { field auto id }')
  const ranges = getFolding(tree)
  expect(ranges).toEqual([])
})

test('returns empty array for empty input', () => {
  const tree = parse(language, '')
  expect(getFolding(tree)).toEqual([])
})
