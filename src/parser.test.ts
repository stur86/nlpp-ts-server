import { beforeAll, test, expect } from 'bun:test'
import { initParser, parse, parseIncremental } from './parser.ts'
import type { Language, Edit } from './types.ts'

let language: Language

beforeAll(async () => {
  language = await initParser()
})

test('initParser returns a Language object', () => {
  expect(language).toBeDefined()
  expect(typeof language).toBe('object')
})

test('parse returns a tree with a root node', () => {
  const tree = parse(language, 'class Foo {}')
  expect(tree).toBeDefined()
  expect(tree.rootNode).toBeDefined()
  expect(tree.rootNode.type).toBe('source_file')
})

test('parse never throws on malformed input', () => {
  expect(() => parse(language, '{')).not.toThrow()
  expect(() => parse(language, '')).not.toThrow()
  expect(() => parse(language, 'class {')).not.toThrow()
})

test('parseIncremental: insertion produces correct tree', () => {
  const original = 'class Foo {}'
  const tree = parse(language, original)
  const edit: Edit = {
    range: { start: { line: 0, character: 9 }, end: { line: 0, character: 9 } },
    text: 'Bar',
  }
  const newText = 'class FooBar {}'
  const result = parseIncremental(language, original, newText, tree, edit)
  expect(result.rootNode.type).toBe('source_file')
  expect(result.rootNode.text).toBe(newText)
})

test('parseIncremental: deletion produces correct tree', () => {
  const original = 'class FooBar {}'
  const tree = parse(language, original)
  const edit: Edit = {
    range: { start: { line: 0, character: 9 }, end: { line: 0, character: 12 } },
    text: '',
  }
  const newText = 'class Foo {}'
  const result = parseIncremental(language, original, newText, tree, edit)
  expect(result.rootNode.type).toBe('source_file')
  expect(result.rootNode.text).toBe(newText)
})

test('parseIncremental: no-op edit matches full parse', () => {
  const text = 'class Foo {}'
  const tree = parse(language, text)
  const edit: Edit = {
    range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
    text: '',
  }
  const result = parseIncremental(language, text, text, tree, edit)
  expect(result.rootNode.type).toBe('source_file')
  expect(result.rootNode.childCount).toBe(tree.rootNode.childCount)
})

test('parseIncremental: stale oldText does not throw', () => {
  const original = 'class Foo {}'
  const tree = parse(language, original)
  const staleText = 'completely wrong text that bears no relation'
  const edit: Edit = {
    range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } },
    text: 'class',
  }
  expect(() =>
    parseIncremental(language, staleText, 'class Foo {}', tree, edit)
  ).not.toThrow()
})

test('parseIncremental: does not mutate oldTree', () => {
  // Use a deletion so endIndex changes, making mutation detectable
  const original = 'class FooBar {}'
  const tree = parse(language, original)
  const originalEndIndex = tree.rootNode.endIndex  // 15
  const edit: Edit = {
    range: { start: { line: 0, character: 9 }, end: { line: 0, character: 12 } },
    text: '',
  }
  parseIncremental(language, original, 'class Foo {}', tree, edit)
  expect(tree.rootNode.endIndex).toBe(originalEndIndex)  // still 15
})
