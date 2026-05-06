# Partial Parsing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `parseIncremental` function that wires up web-tree-sitter's incremental parsing API so LSP servers avoid full re-parses on every keystroke.

**Architecture:** A new stateless `parseIncremental(language, oldText, newText, oldTree, edit)` function alongside the existing `parse()`. Two private helpers handle LSP→tree-sitter coordinate conversion. The caller manages the old tree; for multi-edit batches they call in a loop, threading `currentText`/`currentTree` through each iteration.

**Tech Stack:** Bun, TypeScript, `web-tree-sitter` (already a dependency — uses `Tree.copy()` and `Tree.edit()`)

---

### Task 1: Create feature branch

**Files:**
- No file changes

- [ ] **Step 1: Create and switch to the feature branch**

```bash
git checkout -b feature/partial-parsing
```

Expected: `Switched to a new branch 'feature/partial-parsing'`

---

### Task 2: Add `Edit` type to `src/types.ts`

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Add the `Edit` type after the `Range` type block**

Open `src/types.ts`. After the `Range` type (currently ends around line 14), add:

```ts
export type Edit = { range: Range; text: string }
```

The block should now read:

```ts
export type Position = { line: number; character: number }

export type Range = {
  start: Position
  end: Position
}

export type Edit = { range: Range; text: string }
```

- [ ] **Step 2: Verify TypeScript is clean**

```bash
bunx tsc --noEmit
```

Expected: no output (no errors).

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add Edit type for incremental parsing"
```

---

### Task 3: Write failing tests for `parseIncremental`

**Files:**
- Modify: `src/parser.test.ts`

- [ ] **Step 1: Add imports at the top of `src/parser.test.ts`**

The file currently imports:
```ts
import { beforeAll, test, expect } from 'bun:test'
import { initParser, parse } from './parser.ts'
import type { Language } from './types.ts'
```

Change to:
```ts
import { beforeAll, test, expect } from 'bun:test'
import { initParser, parse, parseIncremental } from './parser.ts'
import type { Language, Edit } from './types.ts'
```

- [ ] **Step 2: Add the five new tests at the bottom of `src/parser.test.ts`**

```ts
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
```

- [ ] **Step 3: Run tests and confirm they fail with the right error**

```bash
bun test src/parser.test.ts
```

Expected: the five new tests fail with something like `SyntaxError: The requested module './parser.ts' does not provide an export named 'parseIncremental'` or `TypeError: parseIncremental is not a function`. The original three tests must still pass.

- [ ] **Step 4: Commit the failing tests**

```bash
git add src/parser.test.ts
git commit -m "test: add failing tests for parseIncremental"
```

---

### Task 4: Implement helpers and `parseIncremental` in `src/parser.ts`

**Files:**
- Modify: `src/parser.ts`

- [ ] **Step 1: Add `Edit` and `Position` to the import from `./types.ts`**

The current import at the top of `src/parser.ts` is:
```ts
import type { Language, Tree } from './types.ts'
```

Change it to:
```ts
import type { Language, Tree, Position, Edit } from './types.ts'
```

- [ ] **Step 2: Add the two private helper functions after the imports, before `initParser`**

```ts
function charOffsetAt(text: string, position: Position): number {
  let offset = 0
  for (let i = 0; i < position.line; i++) {
    const nl = text.indexOf('\n', offset)
    if (nl === -1) return text.length
    offset = nl + 1
  }
  return offset + position.character
}

function computeNewEndPosition(startPosition: Position, newText: string): Position {
  const lines = newText.split('\n')
  if (lines.length === 1) {
    return { line: startPosition.line, character: startPosition.character + newText.length }
  }
  return { line: startPosition.line + lines.length - 1, character: lines[lines.length - 1].length }
}
```

- [ ] **Step 3: Add `parseIncremental` after the existing `parse` function**

```ts
/**
 * Parse a NL++ document incrementally, reusing unchanged parts of a previous tree.
 *
 * Prefer this over {@link parse} in editor/LSP contexts where the same document
 * is updated repeatedly. Pass the tree returned by the previous `parse` or
 * `parseIncremental` call together with the edit that produced `newText`.
 *
 * For batches of edits (multi-cursor, find-replace), call this function once
 * per edit in sequence, threading `newText`/returned tree into the next call.
 *
 * The `edit` type is structurally compatible with LSP `TextDocumentContentChangeEvent`
 * so LSP change events can be passed directly.
 *
 * @param language - The `Language` object returned by {@link initParser}.
 * @param oldText - Full document text before the edit.
 * @param newText - Full document text after the edit.
 * @param oldTree - The syntax tree for `oldText`.
 * @param edit - The content change that transforms `oldText` into `newText`.
 *
 * @category Core API
 */
export function parseIncremental(
  language: Language,
  oldText: string,
  newText: string,
  oldTree: Tree,
  edit: Edit,
): Tree {
  const tree = oldTree.copy()

  const startIndex = charOffsetAt(oldText, edit.range.start)
  const oldEndIndex = charOffsetAt(oldText, edit.range.end)
  const newEndIndex = startIndex + edit.text.length
  const newEndPosition = computeNewEndPosition(edit.range.start, edit.text)

  tree.edit({
    startIndex,
    oldEndIndex,
    newEndIndex,
    startPosition: { row: edit.range.start.line, column: edit.range.start.character },
    oldEndPosition: { row: edit.range.end.line, column: edit.range.end.character },
    newEndPosition: { row: newEndPosition.line, column: newEndPosition.character },
  })

  const parser = new Parser()
  parser.setLanguage(language)
  return parser.parse(newText, tree) as Tree
}
```

- [ ] **Step 4: Run tests and verify all eight pass**

```bash
bun test src/parser.test.ts
```

Expected: all 8 tests pass (`3 original + 5 new`). Zero failures.

- [ ] **Step 5: Commit**

```bash
git add src/parser.ts
git commit -m "feat: implement parseIncremental with charOffsetAt and computeNewEndPosition helpers"
```

---

### Task 5: Export `parseIncremental` and `Edit` from `index.ts`

**Files:**
- Modify: `index.ts`

- [ ] **Step 1: Add `parseIncremental` to the parser export line**

The current export line in `index.ts` is:
```ts
export { initParser, parse } from './src/parser.ts'
```

Change it to:
```ts
export { initParser, parse, parseIncremental } from './src/parser.ts'
```

- [ ] **Step 2: Add `Edit` to the type export block**

The current type export block is:
```ts
export type {
  Language,
  Tree,
  SyntaxNode,
  FileResolver,
  Position,
  Range,
  HighlightRange,
  Diagnostic,
  CompletionItem,
  HoverResult,
  FoldingRange,
  Location,
  PreprocessWarning,
  PreprocessResult,
} from './src/types.ts'
```

Change it to:
```ts
export type {
  Language,
  Tree,
  SyntaxNode,
  FileResolver,
  Position,
  Range,
  Edit,
  HighlightRange,
  Diagnostic,
  CompletionItem,
  HoverResult,
  FoldingRange,
  Location,
  PreprocessWarning,
  PreprocessResult,
} from './src/types.ts'
```

- [ ] **Step 3: Verify TypeScript is clean**

```bash
bunx tsc --noEmit
```

Expected: no output.

- [ ] **Step 4: Run the full test suite to confirm no regressions**

```bash
bun test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add index.ts
git commit -m "feat: export parseIncremental and Edit type from public API"
```
