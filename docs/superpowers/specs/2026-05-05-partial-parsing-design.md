# Partial (Incremental) Parsing

**Date:** 2026-05-05
**Status:** Draft

## Problem

`parse(language, text)` creates a fresh `Parser` instance on every call and passes no previous tree to tree-sitter. For an LSP server that re-parses on every keystroke, this throws away all incremental parsing benefit that `web-tree-sitter` already supports natively.

## Goal

Add a `parseIncremental` function that wires up tree-sitter's incremental parsing API, reducing the work done on each document change without breaking the existing `parse()` API.

## Non-goals

- Caching or pooling `Parser` instances
- Changing the signatures of any existing function
- Handling text-diff computation (callers provide edit coordinates)

## API

### New type: `Edit`

Added to `src/types.ts` alongside `Range`:

```ts
export type Edit = { range: Range; text: string }
```

Structurally identical to LSP's `TextDocumentContentChangeEvent` (minus the deprecated optional `rangeLength`), so LSP change events can be passed directly with no cast.

### New function: `parseIncremental`

```ts
export function parseIncremental(
  language: Language,
  oldText: string,
  newText: string,
  oldTree: Tree,
  edit: Edit,
): Tree
```

- **`oldText`** — document text before the edit; required to convert the LSP `range` (line/character) into the character-offset format tree-sitter expects.
- **`newText`** — document text after the edit; passed directly to tree-sitter as the new source.
- **`oldTree`** — the `Tree` returned from the previous `parse` or `parseIncremental` call. The function copies it before mutating, so the caller's reference remains valid.
- **`edit`** — the single content change to apply. For multi-edit batches (multi-cursor, find-replace), call `parseIncremental` in a loop, threading `currentText` and `currentTree` through each iteration. LSP servers already compute intermediate text states when applying a batch of changes, so this requires no extra work.

**Contract:** Never throws. If `oldText` is stale or edit coordinates are wrong, tree-sitter degrades gracefully — the returned tree may have more `ERROR` nodes but is always a valid `Tree`.

## Internals

All implementation lives in `src/parser.ts`. Two private helpers:

**`charOffsetAt(text: string, position: Position): number`**
Scans `text` line-by-line to return the character index at `{ line, character }`. Used to compute `startIndex` and `oldEndIndex` for the tree-sitter edit object.

Note: `web-tree-sitter`'s WASM binding uses JS string character indices, not UTF-8 byte offsets, so no encoding conversion is needed.

**`computeNewEndPosition(startPosition: Position, newText: string): Position`**
Counts newlines in `newText` to find where the replacement ends:
- No newlines → `{ line: start.line, character: start.character + newText.length }`
- N newlines → `{ line: start.line + N, character: length of last line }`

The body of `parseIncremental`:
1. Copy `oldTree` via `oldTree.copy()`.
2. Compute the tree-sitter edit object (`startIndex`, `oldEndIndex`, `newEndIndex`, `startPosition`, `oldEndPosition`, `newEndPosition`).
3. Call `tree.edit(tsEdit)` on the copy.
4. Create a fresh `Parser`, set language, call `parser.parse(newText, tree)`, return the result.

## Exports

Added to `index.ts`:
- `parseIncremental` (function)
- `Edit` (type)

## Testing

In `src/parser.test.ts`:

- Incremental parse of a no-op edit returns a tree structurally equal to a full parse of the same text.
- Incremental parse of a single insertion produces the correct tree.
- Incremental parse of a single deletion produces the correct tree.
- Passing stale `oldText` still returns a valid (non-throwing) tree.
- `oldTree` is not mutated after the call.

## Feature branch

Implemented on a dedicated branch (`feature/partial-parsing`) branched from `main`. The feature is backward-compatible — no existing signatures change — but is kept separate until validated against a real LSP server integration.
