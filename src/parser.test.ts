import { beforeAll, test, expect } from 'bun:test'
import { initParser, parse } from './parser.ts'
import type { Language } from './types.ts'

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
