# NL++ Language Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `nlpp-ts-server` as a pure-function TypeScript library providing syntax highlighting, diagnostics, completions, hover, folding, go-to-definition, and preprocessing for the NL++ pseudocode language, using the WASM build of `nlpp-grammar`.

**Architecture:** All functions are stateless and take a `Language` (from `web-tree-sitter`) plus a `Tree` (from calling `parse()`). The caller calls `initParser()` once at startup. The preprocessor additionally takes a `FileResolver` callback for import resolution, keeping the library free of any direct filesystem dependency.

**Tech Stack:** Bun, TypeScript, web-tree-sitter, nlpp-grammar (linked at `../nlpp-grammar`)

**Spec amendment (applied in Task 2):** `preprocess()` takes `language: Language` as its first parameter — required for internal parsing of imported files. The published spec omits this parameter; correct it before implementing.

---

## File Map

**Modified in `../nlpp-grammar`:**
- `../nlpp-grammar/package.json` — add `exports` field
- `../nlpp-grammar/bindings/node/browser-stub.js` — new file, error on browser import

**Created in `nlpp-ts-server`:**
- `package.json` — add `web-tree-sitter` dependency
- `src/types.ts` — all shared types and enums
- `src/keywords.ts` — hardcoded built-in keyword registry
- `src/queries.ts` — highlights query string constant
- `src/utils.ts` — `nodeToRange`, `nodeAtPosition`, `collectDefines`, `extractImportPath`, `resolveImports`
- `src/parser.ts` — `initParser()`, `parse()`, re-exports of `Language`/`Tree`/`SyntaxNode`
- `src/diagnostics.ts` — `getDiagnostics()`
- `src/highlights.ts` — `getHighlights()`
- `src/folding.ts` — `getFolding()`
- `src/completions.ts` — `getCompletions()`
- `src/hover.ts` — `getHover()`
- `src/definition.ts` — `getDefinition()`
- `src/preprocess.ts` — `preprocess()`, `ImportError`, `CircularImportError`
- `index.ts` — re-exports everything
- `src/parser.test.ts` — parser init integration test
- `src/diagnostics.test.ts`
- `src/highlights.test.ts`
- `src/folding.test.ts`
- `src/completions.test.ts`
- `src/hover.test.ts`
- `src/definition.test.ts`
- `src/preprocess.test.ts`
- `test/integration.test.ts` — full WASM pipeline smoke test

---

## Task 1: nlpp-grammar — Add exports and browser stub

**Files:**
- Modify: `../nlpp-grammar/package.json`
- Create: `../nlpp-grammar/bindings/node/browser-stub.js`

- [ ] **Step 1: Verify the WASM file exists**

```bash
ls ../nlpp-grammar/tree-sitter-nlpp.wasm
```

If missing, build it:
```bash
cd ../nlpp-grammar && tree-sitter build --wasm && cd -
```

Expected: `tree-sitter-nlpp.wasm` present at `../nlpp-grammar/tree-sitter-nlpp.wasm`.

- [ ] **Step 2: Add `exports` field to nlpp-grammar's package.json**

Open `../nlpp-grammar/package.json`. After the `"main"` and `"types"` lines, add:

```json
"exports": {
  ".": {
    "browser": "./bindings/node/browser-stub.js",
    "default": "./bindings/node/index.js"
  },
  "./wasm": "./tree-sitter-nlpp.wasm",
  "./queries/highlights": "./queries/highlights.scm"
},
```

The full `package.json` relevant section becomes:
```json
{
  "name": "nlpp-grammar",
  "version": "0.1.0",
  "type": "module",
  "main": "bindings/node",
  "types": "bindings/node",
  "exports": {
    ".": {
      "browser": "./bindings/node/browser-stub.js",
      "default": "./bindings/node/index.js"
    },
    "./wasm": "./tree-sitter-nlpp.wasm",
    "./queries/highlights": "./queries/highlights.scm"
  }
}
```

- [ ] **Step 3: Create the browser stub**

Create `../nlpp-grammar/bindings/node/browser-stub.js`:

```js
throw new Error(
  "nlpp-grammar native binding is not available in browser contexts. " +
  "Load the WASM grammar via nlpp-ts-server's initParser() instead."
);
```

- [ ] **Step 4: Commit**

```bash
cd ../nlpp-grammar
git add package.json bindings/node/browser-stub.js
git commit -m "feat: add package exports for WASM and highlights query"
cd -
```

---

## Task 2: nlpp-ts-server project setup + spec amendment

**Files:**
- Modify: `package.json`
- Modify: `docs/superpowers/specs/2026-05-01-wasm-language-server-design.md`

- [ ] **Step 1: Add web-tree-sitter to dependencies**

Edit `package.json` so `dependencies` reads:

```json
"dependencies": {
  "nlpp-grammar": "link:../nlpp-grammar",
  "web-tree-sitter": "^0.25.0"
}
```

Note: use a version of `web-tree-sitter` matching the `tree-sitter-cli` version in nlpp-grammar (`^0.26.8` → try `^0.25.0` first; if WASM ABI mismatches at runtime, align versions).

- [ ] **Step 2: Install dependencies**

```bash
bun install
```

Expected: `node_modules/web-tree-sitter` present.

- [ ] **Step 3: Amend the spec — add `language` param to `preprocess`**

In `docs/superpowers/specs/2026-05-01-wasm-language-server-design.md`, update the preprocessor signature from:

```ts
preprocess(
  entryText: string,
  entryPath: string,
  resolveFile: FileResolver
): Promise<PreprocessResult>
```

to:

```ts
preprocess(
  language: Language,
  entryText: string,
  entryPath: string,
  resolveFile: FileResolver
): Promise<PreprocessResult>
```

- [ ] **Step 4: Commit**

```bash
git add package.json bun.lock docs/superpowers/specs/2026-05-01-wasm-language-server-design.md
git commit -m "chore: add web-tree-sitter dependency, amend preprocess signature"
```

---

## Task 3: Foundation — types, keywords, queries, utils

**Files:**
- Create: `src/types.ts`
- Create: `src/keywords.ts`
- Create: `src/queries.ts`
- Create: `src/utils.ts`

These files contain pure data and utility functions with no logic branches to test. No test file for this task.

- [ ] **Step 1: Create `src/types.ts`**

```ts
import type Parser from 'web-tree-sitter'

export type Language = Parser.Language
export type Tree = Parser.Tree
export type SyntaxNode = Parser.SyntaxNode

export type FileResolver = (path: string) => Promise<string>

export type Position = { line: number; character: number }

export type Range = {
  start: Position
  end: Position
}

export type HighlightRange = {
  startIndex: number
  endIndex: number
  scope: string
}

export const DiagnosticSeverity = {
  Error: 1,
  Warning: 2,
  Information: 3,
  Hint: 4,
} as const
export type DiagnosticSeverity = typeof DiagnosticSeverity[keyof typeof DiagnosticSeverity]

export type Diagnostic = {
  range: Range
  message: string
  severity: DiagnosticSeverity
}

export const CompletionItemKind = {
  Function: 3,
  Variable: 6,
  Class: 7,
  Interface: 8,
  Keyword: 14,
  Constant: 21,
} as const
export type CompletionItemKind = typeof CompletionItemKind[keyof typeof CompletionItemKind]

export type CompletionItem = {
  label: string
  kind: CompletionItemKind
  detail?: string
}

export type HoverResult = {
  range: Range
  contents: string
}

export type FoldingRange = {
  startLine: number
  endLine: number
  kind: 'region' | 'comment'
}

export type Location = {
  uri: string
  range: Range
}

export type PreprocessWarning = {
  kind: 'unresolved_custom_keyword'
  keyword: string
  range: Range
}

export type PreprocessResult = {
  output: string
  warnings: PreprocessWarning[]
}
```

- [ ] **Step 2: Create `src/keywords.ts`**

```ts
export const KEYWORD_REGISTRY: Record<string, string> = {
  layer:
    'An architectural tier. Does not correspond to a specific code construct. Use to indicate separation of concerns (e.g. domain, application, infrastructure, presentation).',
  module:
    'A cohesive grouping of related entities. May map to a package, folder, or namespace. The agent decides physical structure.',
  service:
    'A service boundary. May be internal (a bounded context) or external (a third-party API). If described as external, define an interface or client wrapper rather than an implementation.',
  component: 'A UI or logical unit. Interpret based on surrounding architectural context.',
  class: 'A concrete implementation type.',
  interface:
    "An abstract contract. Implement as the target language's idiomatic abstraction (interface, protocol, trait, abstract class).",
  enum: 'A fixed set of named values.',
  type: 'A data shape or type alias.',
  function: 'A standalone callable, not a member of a type.',
  method:
    'A callable member. Signature is advisory — adapt parameter and return types to fit the implementation. Block body contains implementation hints, not implementation.',
  getter:
    "A read accessor. Implement as the target language's idiomatic read accessor (getter method, computed property, etc.).",
  setter: "A write accessor. Implement as the target language's idiomatic write accessor.",
  field: 'A data member.',
  auto: 'Explicit type deferral. Infer the most appropriate type from context.',
  uses: 'A dependency or reference. At type scope: a structural dependency to inject or import. At method scope: a callable or resource involved in the implementation. Resolve the appropriate pattern from context.',
  implements:
    'This entity conforms to the named interface or contract. No implementation is inherited — provide it in full.',
  inherits:
    "This entity extends the named parent type. Take on the parent's implementation and extend or override as described.",
  public:
    "This member is part of the public interface of its parent. Apply the target language's appropriate access modifier.",
  private:
    "This member is internal to its parent. Apply the target language's appropriate access modifier.",
  override:
    "This member overrides an inherited implementation from a parent type. Apply the target language's appropriate override construct.",
  define:
    'Author-defined architectural vocabulary. Treat defined terms as first-class design concepts throughout the implementation.',
  import: 'The contents of the referenced file have been inlined here. Treat it as part of this file.',
}

export const KEYWORD_NAMES = new Set(Object.keys(KEYWORD_REGISTRY))

export const RESERVED_KEYWORDS = new Set([
  'import', 'define', 'uses', 'field',
  'public', 'private', 'override',
  'function', 'method', 'getter', 'setter',
  'layer', 'module', 'service', 'component', 'class', 'interface', 'enum', 'type',
  'inherits', 'implements',
  'auto',
])
```

- [ ] **Step 3: Create `src/queries.ts`**

Copy the content of `../nlpp-grammar/queries/highlights.scm` verbatim as a template literal:

```ts
export const HIGHLIGHTS_QUERY = `
; ── Comments ──────────────────────────────────────────────────────────────────
(line_comment) @comment.line
(block_comment) @comment.block

; ── Keywords ──────────────────────────────────────────────────────────────────
"import" @keyword.import
"define" @keyword
"uses" @keyword

"field" @keyword
"auto" @keyword.type

(function_keyword) @keyword.function
(object_keyword) @keyword.type

(access_modifier) @keyword.modifier
"override" @keyword.modifier

"inherits" @keyword
"implements" @keyword

; ── Strings ───────────────────────────────────────────────────────────────────
(string) @string

; ── Prose blocks ──────────────────────────────────────────────────────────────
"/?" @punctuation.special
"?/" @punctuation.special
(prose_text) @string.special

; ── Fill-in markers ───────────────────────────────────────────────────────────
"???" @punctuation.special
(hint_text) @comment.line

; ── Named definitions ─────────────────────────────────────────────────────────
(define_statement name: (identifier) @constant)
(object_block name: (identifier) @type.definition)
(function_block name: (identifier) @function)
(field_statement name: (identifier) @variable.member)
(custom_block keyword: (identifier) @keyword
              name: (identifier) @type.definition)

; ── Type annotations ──────────────────────────────────────────────────────────
(field_statement type: (type (identifier) @type))
(function_block return_type: (type (identifier) @type))
(param type: (type (identifier) @type))

; ── Parameters ────────────────────────────────────────────────────────────────
(param name: (identifier) @variable.parameter)

; ── Uses targets ──────────────────────────────────────────────────────────────
(uses_statement target: (qualified_identifier) @variable)
`
```

- [ ] **Step 4: Create `src/utils.ts`**

```ts
import type { SyntaxNode, Tree, Language, Range, Position, FileResolver } from './types.ts'
import { parse } from './parser.ts'

export function nodeToRange(node: SyntaxNode): Range {
  return {
    start: { line: node.startPosition.row, character: node.startPosition.column },
    end: { line: node.endPosition.row, character: node.endPosition.column },
  }
}

export function nodeAtPosition(tree: Tree, position: Position): SyntaxNode {
  return tree.rootNode.descendantForPosition({
    row: position.line,
    column: position.character,
  })
}

export function isInsideNodeOfType(node: SyntaxNode, type: string): boolean {
  let current: SyntaxNode | null = node
  while (current) {
    if (current.type === type) return true
    current = current.parent
  }
  return false
}

export function collectDefines(tree: Tree): Map<string, string> {
  const defines = new Map<string, string>()
  function walk(node: SyntaxNode) {
    if (node.type === 'define_statement') {
      const name = node.childForFieldName('name')?.text ?? ''
      const body = node.childForFieldName('definition')?.text?.replace(/^"|"$/g, '') ?? ''
      if (name) defines.set(name, body)
    }
    for (const child of node.children) walk(child)
  }
  walk(tree.rootNode)
  return defines
}

export function extractImportPath(importNode: SyntaxNode, currentFilePath: string): string {
  const raw = importNode.childForFieldName('path')?.text ?? ''
  const relative = raw.replace(/^"|"$/g, '')
  const dir = currentFilePath.replace(/\/[^/]+$/, '')
  return `${dir}/${relative}`.replace(/\/\.\//g, '/')
}

export async function resolveImports(
  tree: Tree,
  language: Language,
  currentPath: string,
  resolveFile: FileResolver,
  visited = new Set<string>(),
): Promise<Map<string, Tree>> {
  const result = new Map<string, Tree>()
  for (const node of tree.rootNode.children) {
    if (node.type !== 'import_statement') continue
    const importedPath = extractImportPath(node, currentPath)
    if (visited.has(importedPath)) continue
    visited.add(importedPath)
    try {
      const text = await resolveFile(importedPath)
      const importedTree = parse(language, text)
      result.set(importedPath, importedTree)
      const nested = await resolveImports(importedTree, language, importedPath, resolveFile, visited)
      for (const [k, v] of nested) result.set(k, v)
    } catch {
      // swallow — callers that need error reporting handle it themselves
    }
  }
  return result
}
```

Note: `utils.ts` imports `parse` from `parser.ts`. This creates a dependency: `parser.ts` must be created before `utils.ts` compiles. Both are created in Task 4; if the TypeScript checker complains during Task 3, that's fine — it resolves after Task 4.

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/keywords.ts src/queries.ts src/utils.ts
git commit -m "feat: add foundation types, keyword registry, highlights query, utilities"
```

---

## Task 4: src/parser.ts — initParser() and parse()

**Files:**
- Create: `src/parser.ts`
- Create: `src/parser.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/parser.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test src/parser.test.ts
```

Expected: FAIL — `parser.ts` does not exist.

- [ ] **Step 3: Write the implementation**

Create `src/parser.ts`:

```ts
import Parser from 'web-tree-sitter'
import type { Language, Tree } from './types.ts'

export type { Language, Tree, SyntaxNode } from './types.ts'

export async function initParser(wasmUrl?: string | URL): Promise<Language> {
  await Parser.init()
  let path: string
  if (wasmUrl !== undefined) {
    path = wasmUrl instanceof URL ? wasmUrl.pathname : wasmUrl
  } else {
    path = new URL(import.meta.resolve('nlpp-grammar/wasm')).pathname
  }
  return await Parser.Language.load(path)
}

export function parse(language: Language, text: string): Tree {
  const parser = new Parser()
  parser.setLanguage(language)
  return parser.parse(text) as Tree
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun test src/parser.test.ts
```

Expected: all 3 tests PASS.

If you see a WASM ABI mismatch error like `"invalid language"`, the `web-tree-sitter` version does not match the tree-sitter-cli version used to build the grammar. Run `cd ../nlpp-grammar && npm list tree-sitter-cli` to see the version, then in `nlpp-ts-server` run `bun add web-tree-sitter@<matching-version>`.

- [ ] **Step 5: Commit**

```bash
git add src/parser.ts src/parser.test.ts
git commit -m "feat: add initParser and parse with integration test"
```

---

## Task 5: src/diagnostics.ts — getDiagnostics()

**Files:**
- Create: `src/diagnostics.ts`
- Create: `src/diagnostics.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/diagnostics.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test src/diagnostics.test.ts
```

Expected: FAIL — `diagnostics.ts` does not exist.

- [ ] **Step 3: Write the implementation**

Create `src/diagnostics.ts`:

```ts
import type { Language, Tree, SyntaxNode, Diagnostic } from './types.ts'
import { DiagnosticSeverity } from './types.ts'
import { nodeToRange } from './utils.ts'

export function getDiagnostics(_language: Language, tree: Tree): Diagnostic[] {
  const diagnostics: Diagnostic[] = []

  function walk(node: SyntaxNode) {
    if (node.type === 'ERROR') {
      diagnostics.push({
        range: nodeToRange(node),
        message: node.text.length > 0
          ? `Syntax error: unexpected "${node.text.slice(0, 20)}"`
          : 'Syntax error',
        severity: DiagnosticSeverity.Error,
      })
    } else if (node.isMissing) {
      diagnostics.push({
        range: nodeToRange(node),
        message: `Syntax error: expected "${node.type}"`,
        severity: DiagnosticSeverity.Error,
      })
    } else {
      for (const child of node.children) walk(child)
    }
  }

  walk(tree.rootNode)
  return diagnostics
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun test src/diagnostics.test.ts
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/diagnostics.ts src/diagnostics.test.ts
git commit -m "feat: add getDiagnostics"
```

---

## Task 6: src/highlights.ts — getHighlights()

**Files:**
- Create: `src/highlights.ts`
- Create: `src/highlights.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/highlights.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test src/highlights.test.ts
```

Expected: FAIL — `highlights.ts` does not exist.

- [ ] **Step 3: Write the implementation**

Create `src/highlights.ts`:

```ts
import type { Language, Tree, HighlightRange } from './types.ts'
import { HIGHLIGHTS_QUERY } from './queries.ts'

export function getHighlights(language: Language, tree: Tree): HighlightRange[] {
  const query = language.query(HIGHLIGHTS_QUERY)
  const captures = query.captures(tree.rootNode)
  return captures.map(capture => ({
    startIndex: capture.node.startIndex,
    endIndex: capture.node.endIndex,
    scope: capture.name,
  }))
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun test src/highlights.test.ts
```

Expected: all 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/highlights.ts src/highlights.test.ts
git commit -m "feat: add getHighlights"
```

---

## Task 7: src/folding.ts — getFolding()

**Files:**
- Create: `src/folding.ts`
- Create: `src/folding.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/folding.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test src/folding.test.ts
```

Expected: FAIL — `folding.ts` does not exist.

- [ ] **Step 3: Write the implementation**

Create `src/folding.ts`:

```ts
import type { Tree, SyntaxNode, FoldingRange } from './types.ts'

export function getFolding(tree: Tree): FoldingRange[] {
  const ranges: FoldingRange[] = []

  function walk(node: SyntaxNode) {
    const startLine = node.startPosition.row
    const endLine = node.endPosition.row
    if (startLine >= endLine) {
      for (const child of node.children) walk(child)
      return
    }

    if (node.type === 'body') {
      ranges.push({ startLine, endLine, kind: 'region' })
    } else if (node.type === 'block_comment') {
      ranges.push({ startLine, endLine, kind: 'comment' })
    } else if (node.type === 'prose_block') {
      ranges.push({ startLine, endLine, kind: 'region' })
    }

    for (const child of node.children) walk(child)
  }

  walk(tree.rootNode)
  return ranges
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun test src/folding.test.ts
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/folding.ts src/folding.test.ts
git commit -m "feat: add getFolding"
```

---

## Task 8: src/completions.ts — getCompletions()

**Files:**
- Create: `src/completions.ts`
- Create: `src/completions.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/completions.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test src/completions.test.ts
```

Expected: FAIL — `completions.ts` does not exist.

- [ ] **Step 3: Write the implementation**

Create `src/completions.ts`:

```ts
import type { Language, Tree, Position, FileResolver, CompletionItem } from './types.ts'
import { CompletionItemKind } from './types.ts'
import { KEYWORD_REGISTRY } from './keywords.ts'
import { nodeAtPosition, isInsideNodeOfType, collectDefines, resolveImports } from './utils.ts'

export async function getCompletions(
  language: Language,
  tree: Tree,
  position: Position,
  resolveFile?: FileResolver,
): Promise<CompletionItem[]> {
  const node = nodeAtPosition(tree, position)

  if (isInsideNodeOfType(node, 'prose_block')) return []
  if (isInsideNodeOfType(node, 'ERROR')) return []

  const items: CompletionItem[] = []

  // Built-in keywords
  for (const [label, detail] of Object.entries(KEYWORD_REGISTRY)) {
    items.push({ label, kind: CompletionItemKind.Keyword, detail })
  }

  // In-file defines
  const inFileDefines = collectDefines(tree)
  for (const [label, detail] of inFileDefines) {
    items.push({ label, kind: CompletionItemKind.Constant, detail })
  }

  // Cross-file defines
  if (resolveFile) {
    const imported = await resolveImports(tree, language, '', resolveFile)
    for (const importedTree of imported.values()) {
      for (const [label, detail] of collectDefines(importedTree)) {
        if (!inFileDefines.has(label)) {
          items.push({ label, kind: CompletionItemKind.Constant, detail })
        }
      }
    }
  }

  return items
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun test src/completions.test.ts
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/completions.ts src/completions.test.ts
git commit -m "feat: add getCompletions"
```

---

## Task 9: src/hover.ts — getHover()

**Files:**
- Create: `src/hover.ts`
- Create: `src/hover.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/hover.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test src/hover.test.ts
```

Expected: FAIL — `hover.ts` does not exist.

- [ ] **Step 3: Write the implementation**

Create `src/hover.ts`:

```ts
import type { Language, Tree, Position, FileResolver, HoverResult, SyntaxNode } from './types.ts'
import { KEYWORD_REGISTRY } from './keywords.ts'
import { nodeAtPosition, nodeToRange, collectDefines, resolveImports } from './utils.ts'

function keywordAtNode(node: SyntaxNode): string | null {
  const KEYWORD_NODE_TYPES = new Set([
    'object_keyword', 'function_keyword', 'access_modifier',
  ])
  const KEYWORD_LITERALS = new Set([
    'field', 'uses', 'import', 'define', 'auto', 'override', 'inherits', 'implements',
  ])

  if (KEYWORD_NODE_TYPES.has(node.type)) return node.text
  if (node.parent?.type === 'custom_block' && node === node.parent.childForFieldName('keyword')) {
    return node.text
  }
  if (KEYWORD_LITERALS.has(node.text) && node.isNamed === false) return node.text
  return null
}

export async function getHover(
  language: Language,
  tree: Tree,
  position: Position,
  resolveFile?: FileResolver,
): Promise<HoverResult | null> {
  const node = nodeAtPosition(tree, position)
  const range = nodeToRange(node)

  // Built-in keyword
  const keyword = keywordAtNode(node)
  if (keyword && KEYWORD_REGISTRY[keyword]) {
    return { range, contents: KEYWORD_REGISTRY[keyword] }
  }

  // In-file define
  const inFileDef = collectDefines(tree).get(node.text)
  if (inFileDef) return { range, contents: inFileDef }

  // Cross-file define
  if (resolveFile) {
    const imported = await resolveImports(tree, language, '', resolveFile)
    for (const importedTree of imported.values()) {
      const def = collectDefines(importedTree).get(node.text)
      if (def) return { range, contents: def }
    }
  }

  return null
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun test src/hover.test.ts
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hover.ts src/hover.test.ts
git commit -m "feat: add getHover"
```

---

## Task 10: src/definition.ts — getDefinition()

**Files:**
- Create: `src/definition.ts`
- Create: `src/definition.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/definition.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test src/definition.test.ts
```

Expected: FAIL — `definition.ts` does not exist.

- [ ] **Step 3: Write the implementation**

Create `src/definition.ts`:

```ts
import type { Language, Tree, Position, FileResolver, Location, SyntaxNode } from './types.ts'
import { RESERVED_KEYWORDS } from './keywords.ts'
import { nodeAtPosition, nodeToRange, resolveImports } from './utils.ts'
import { parse } from './parser.ts'

function findDefineNode(tree: Tree, name: string): SyntaxNode | null {
  for (const node of tree.rootNode.children) {
    if (node.type === 'define_statement') {
      if (node.childForFieldName('name')?.text === name) return node
    }
  }
  return null
}

function findBlockDeclaration(tree: Tree, name: string): SyntaxNode | null {
  function walk(node: SyntaxNode): SyntaxNode | null {
    for (const type of ['object_block', 'function_block', 'custom_block']) {
      if (node.type === type && node.childForFieldName('name')?.text === name) return node
    }
    for (const child of node.children) {
      const found = walk(child)
      if (found) return found
    }
    return null
  }
  return walk(tree.rootNode)
}

export async function getDefinition(
  language: Language,
  tree: Tree,
  position: Position,
  resolveFile?: FileResolver,
): Promise<Location | null> {
  const node = nodeAtPosition(tree, position)
  const word = node.text

  if (!word || RESERVED_KEYWORDS.has(word)) return null

  // In-file define
  const defineNode = findDefineNode(tree, word)
  if (defineNode) return { uri: '', range: nodeToRange(defineNode) }

  // In-file block declaration
  const blockNode = findBlockDeclaration(tree, word)
  if (blockNode) return { uri: '', range: nodeToRange(blockNode) }

  // Cross-file
  if (resolveFile) {
    const imported = await resolveImports(tree, language, '', resolveFile)
    for (const [uri, importedTree] of imported) {
      const d = findDefineNode(importedTree, word) ?? findBlockDeclaration(importedTree, word)
      if (d) return { uri, range: nodeToRange(d) }
    }
  }

  return null
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun test src/definition.test.ts
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/definition.ts src/definition.test.ts
git commit -m "feat: add getDefinition"
```

---

## Task 11: src/preprocess.ts — preprocess()

**Files:**
- Create: `src/preprocess.ts`
- Create: `src/preprocess.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/preprocess.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test src/preprocess.test.ts
```

Expected: FAIL — `preprocess.ts` does not exist.

- [ ] **Step 3: Write the implementation**

Create `src/preprocess.ts`:

```ts
import type { Language, FileResolver, PreprocessResult, PreprocessWarning, SyntaxNode } from './types.ts'
import { KEYWORD_REGISTRY } from './keywords.ts'
import { nodeToRange, extractImportPath } from './utils.ts'
import { parse } from './parser.ts'

export class ImportError extends Error {
  constructor(public readonly importPath: string, cause: unknown) {
    super(`Cannot resolve import "${importPath}": ${cause}`)
    this.name = 'ImportError'
  }
}

export class CircularImportError extends Error {
  constructor(public readonly importPath: string, public readonly stack: string[]) {
    super(`Circular import detected: ${[...stack, importPath].join(' → ')}`)
    this.name = 'CircularImportError'
  }
}

function collectUsedBuiltins(node: SyntaxNode, out: Set<string>): void {
  if (node.type === 'object_keyword') out.add(node.text)
  else if (node.type === 'function_keyword') out.add(node.text)
  else if (node.type === 'access_modifier') out.add(node.text)
  else if (node.type === 'import_statement') out.add('import')
  else if (node.type === 'define_statement') out.add('define')
  else if (node.type === 'uses_statement') out.add('uses')
  else if (node.type === 'field_statement') out.add('field')
  if (node.text === 'override') out.add('override')
  if (node.text === 'inherits') out.add('inherits')
  if (node.text === 'implements') out.add('implements')
  if (node.type === 'type' && node.text === 'auto') out.add('auto')
  for (const child of node.children) collectUsedBuiltins(child, out)
}

export async function preprocess(
  language: Language,
  entryText: string,
  entryPath: string,
  resolveFile: FileResolver,
): Promise<PreprocessResult> {
  const visited = new Set<string>()
  const warnings: PreprocessWarning[] = []
  const definedTerms = new Map<string, string>()
  const usedBuiltins = new Set<string>()
  const usedDefinedTerms = new Set<string>()

  async function processFile(text: string, path: string, callStack: string[]): Promise<string> {
    if (callStack.includes(path)) throw new CircularImportError(path, callStack)
    if (visited.has(path)) return ''
    visited.add(path)

    const tree = parse(language, text)
    collectUsedBuiltins(tree.rootNode, usedBuiltins)

    let output = ''

    for (const node of tree.rootNode.children) {
      if (node.type === 'line_comment' || node.type === 'block_comment') {
        continue
      }

      if (node.type === 'import_statement') {
        const importedPath = extractImportPath(node, path)
        let importedText: string
        try {
          importedText = await resolveFile(importedPath)
        } catch (err) {
          throw new ImportError(importedPath, err)
        }
        output += await processFile(importedText, importedPath, [...callStack, path])
        continue
      }

      if (node.type === 'define_statement') {
        const name = node.childForFieldName('name')?.text ?? ''
        const body = node.childForFieldName('definition')?.text?.replace(/^"|"$/g, '') ?? ''
        if (name) definedTerms.set(name, body)
      }

      if (node.type === 'custom_block') {
        const keyword = node.childForFieldName('keyword')?.text ?? ''
        if (keyword) {
          usedDefinedTerms.add(keyword)
          if (!definedTerms.has(keyword)) {
            warnings.push({
              kind: 'unresolved_custom_keyword',
              keyword,
              range: nodeToRange(node),
            })
          }
        }
      }

      output += text.slice(node.startIndex, node.endIndex) + '\n'
    }

    return output
  }

  const content = await processFile(entryText, entryPath, [])

  // Build glossary
  const glossaryLines: string[] = []
  for (const kw of usedBuiltins) {
    const def = KEYWORD_REGISTRY[kw]
    if (def) glossaryLines.push(`${kw}: ${def}`)
  }
  for (const term of usedDefinedTerms) {
    const def = definedTerms.get(term)
    if (def) glossaryLines.push(`${term}: ${def}`)
  }

  const glossary = glossaryLines.length > 0
    ? [
        '',
        '---',
        'KEYWORD GLOSSARY',
        'The following terms appear in the pseudocode above. Treat them as architectural intent.',
        '',
        ...glossaryLines,
      ].join('\n')
    : ''

  return { output: content + glossary, warnings }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun test src/preprocess.test.ts
```

Expected: all 13 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/preprocess.ts src/preprocess.test.ts
git commit -m "feat: add preprocess with import inlining, comment stripping, glossary"
```

---

## Task 12: index.ts and full integration test

**Files:**
- Modify: `index.ts`
- Create: `test/integration.test.ts`

- [ ] **Step 1: Write the integration test**

Create `test/integration.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the integration test to verify it fails**

```bash
bun test test/integration.test.ts
```

Expected: FAIL — `index.ts` does not export the expected symbols.

- [ ] **Step 3: Replace index.ts with full re-exports**

Replace the current `index.ts` placeholder:

```ts
export { initParser, parse } from './src/parser.ts'
export { getDiagnostics } from './src/diagnostics.ts'
export { getHighlights } from './src/highlights.ts'
export { getFolding } from './src/folding.ts'
export { getCompletions } from './src/completions.ts'
export { getHover } from './src/hover.ts'
export { getDefinition } from './src/definition.ts'
export { preprocess, ImportError, CircularImportError } from './src/preprocess.ts'
export type {
  Language,
  Tree,
  SyntaxNode,
  FileResolver,
  Position,
  Range,
  HighlightRange,
  DiagnosticSeverity,
  Diagnostic,
  CompletionItemKind,
  CompletionItem,
  HoverResult,
  FoldingRange,
  Location,
  PreprocessWarning,
  PreprocessResult,
} from './src/types.ts'
export { DiagnosticSeverity, CompletionItemKind } from './src/types.ts'
export { KEYWORD_REGISTRY, KEYWORD_NAMES, RESERVED_KEYWORDS } from './src/keywords.ts'
```

- [ ] **Step 4: Run the full test suite**

```bash
bun test
```

Expected: all tests across all files PASS. Note the count — should be 40+ tests.

- [ ] **Step 5: Final commit**

```bash
git add index.ts test/integration.test.ts
git commit -m "feat: wire index.ts exports, add integration test"
```

---

## Self-Review

**Spec coverage check:**
- ✅ `nlpp-grammar` exports (Task 1)
- ✅ `initParser(wasmUrl?)` (Task 4)
- ✅ `parse()` never throws (Task 4 + diagnostics tests)
- ✅ `getHighlights()` (Task 6)
- ✅ `getDiagnostics()` (Task 5)
- ✅ `getCompletions()` with optional resolveFile (Task 8)
- ✅ `getHover()` with optional resolveFile (Task 9)
- ✅ `getFolding()` (Task 7)
- ✅ `getDefinition()` with optional resolveFile (Task 10)
- ✅ `preprocess()` with FileResolver, ImportError, CircularImportError, warnings (Task 11)
- ✅ Graceful degradation without resolveFile (completions/hover/definition tests)
- ✅ Browser stub in nlpp-grammar (Task 1)
- ✅ Integration test on example file (Task 12)
- ✅ Spec amendment (preprocess language param) (Task 2)

**Type consistency check:** All functions use `Language` and `Tree` from `src/types.ts`. `nodeToRange`, `nodeAtPosition`, `collectDefines`, `resolveImports`, `extractImportPath` all live in `utils.ts` and are referenced consistently across tasks. `DiagnosticSeverity` and `CompletionItemKind` are const objects, used as both type and value.

**Placeholder check:** All code blocks are complete. No TBDs.
