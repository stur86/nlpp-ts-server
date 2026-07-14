import { beforeAll, test, expect } from 'bun:test'
import { initParser, parse } from './parser.ts'
import { getDiagnostics } from './diagnostics.ts'
import { DiagnosticSeverity } from './types.ts'
import type { Language } from './types.ts'

let language: Language

beforeAll(async () => {
  language = await initParser()
})

const CLEAN = `class OrderService implements IOrderService {
  field auto id
  method auto place_order(Order order) {
    uses PaymentGateway.charge
  }
}`

const MISSING_NAME = `class {
  field auto id
}`

const UNEXPECTED_TOKEN = `class Foo {
  field {
}`

test('returns empty array for valid NL++', () => {
  const tree = parse(language, CLEAN)
  expect(getDiagnostics(language, tree)).toEqual([])
})

test('returns diagnostics for missing name after class', () => {
  const tree = parse(language, MISSING_NAME)
  const diags = getDiagnostics(language, tree)
  expect(diags.length).toBeGreaterThan(0)
  expect(diags[0]!.severity).toBe(DiagnosticSeverity.Error)
})

test('diagnostic has a valid range', () => {
  const tree = parse(language, MISSING_NAME)
  const diags = getDiagnostics(language, tree)
  const d = diags[0]!
  expect(d.range.start.line).toBeGreaterThanOrEqual(0)
  expect(d.range.start.character).toBeGreaterThanOrEqual(0)
})

test('returns empty array for empty input', () => {
  const tree = parse(language, '')
  expect(getDiagnostics(language, tree)).toEqual([])
})

const REFERENCE_AND_TEMPLATE_TYPES = `class Store {
  field &Array[int, 32] buffer
  method &Order fetch(Map[string, Array[int]] q) {
    /?
      look up and return a reference
    ?/
  }
}`

test('accepts reference and template type syntax without diagnostics', () => {
  const tree = parse(language, REFERENCE_AND_TEMPLATE_TYPES)
  expect(getDiagnostics(language, tree)).toEqual([])
})
