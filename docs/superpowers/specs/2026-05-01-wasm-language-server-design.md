# NL++ Language Server — Design Spec
**Date:** 2026-05-01
**Status:** Approved

---

## Overview

`nlpp-ts-server` is a TypeScript library that provides language tooling for the NL++ pseudocode language. It wraps the `nlpp-grammar` Tree-sitter parser (via its WASM build) and exposes pure functions for syntax highlighting, diagnostics, completions, hover, folding, go-to-definition, and preprocessing. There is no server process — callers use the functions directly.

The library is environment-agnostic. Browser-safe functions have no I/O dependencies at all. The preprocessor accepts a caller-supplied file resolver so it works under both Bun and Node.js without hard-coding either runtime's filesystem API.

---

## Scope

### In scope

- Changes to `nlpp-grammar` to make it NPM-publishable and WASM-accessible
- All exported functions in `nlpp-ts-server`
- Unit and integration tests

### Out of scope

- The VSCode extension itself (separate repo)
- An MCP server wrapper (future work)
- Language server protocol (LSP) wire encoding — the extension hooks call these functions directly

---

## `nlpp-grammar` Changes

Three changes to `package.json`; no grammar or parser source changes.

### 1. Add `exports` field

```json
"exports": {
  ".": {
    "browser": "./bindings/node/browser-stub.js",
    "default": "./bindings/node/index.js"
  },
  "./wasm": "./tree-sitter-nlpp.wasm",
  "./queries/highlights": "./queries/highlights.scm"
}
```

`"./wasm"` lets `nlpp-ts-server` locate the WASM file without path-guessing. `"./queries/highlights"` exposes the highlight query so the library can import it at build time. The `"."` export keeps the existing native binding for Node consumers while giving browser bundlers a safe fallback.

### 2. Add `bindings/node/browser-stub.js`

```js
throw new Error(
  "nlpp-grammar native binding is not available in browser contexts. " +
  "Use the WASM build via nlpp-ts-server instead."
);
```

Prevents silent failures when a browser bundler resolves the default `"."` export.

### 3. Verify WASM output filename

Confirm `tree-sitter build --wasm` (run by `prepublishOnly`) produces `tree-sitter-nlpp.wasm` at the package root. If the output name differs, adjust the `"./wasm"` export path to match — do not rename the file.

---

## `nlpp-ts-server` Architecture

### Dependencies

- `web-tree-sitter` — WASM-based Tree-sitter bindings, works in browser and Node/Bun
- `nlpp-grammar` — provides `tree-sitter-nlpp.wasm` and `queries/highlights.scm`

No native addons. No `node:fs` or `Bun.file` in the library itself.

### Module structure

```
src/
  parser.ts       — initParser(), re-exports Tree/Language types from web-tree-sitter
  highlights.ts   — getHighlights()
  diagnostics.ts  — getDiagnostics()
  completions.ts  — getCompletions()
  hover.ts        — getHover()
  folding.ts      — getFolding()
  definition.ts   — getDefinition()
  preprocess.ts   — preprocess()
  keywords.ts     — built-in keyword registry (hardcoded definitions from spec)
  types.ts        — shared types (Position, Range, Diagnostic, etc.)
index.ts          — re-exports everything
```

Each file has one clear responsibility and no cross-dependencies except on `types.ts` and `keywords.ts`.

---

## API

### Types

```ts
type FileResolver = (path: string) => Promise<string>

type Position = { line: number; character: number }

type Range = { start: Position; end: Position }

type HighlightRange = {
  startIndex: number
  endIndex: number
  scope: string        // e.g. "keyword.function", "comment.line"
}

type Diagnostic = {
  range: Range
  message: string
  severity: DiagnosticSeverity  // Error | Warning | Information | Hint
}

type CompletionItem = {
  label: string
  kind: CompletionItemKind      // Keyword | Variable | Function | etc.
  detail?: string               // keyword definition from registry
}

type HoverResult = {
  range: Range
  contents: string
}

type FoldingRange = {
  startLine: number
  endLine: number
  kind: 'region' | 'comment'
}

type Location = {
  uri: string
  range: Range
}
```

These types are compatible with the LSP specification types by design, but do not depend on any LSP library.

### Parser initialization

```ts
initParser(wasmUrl?: string | URL): Promise<Language>
```

Loads `web-tree-sitter` and the NL++ WASM grammar. In Node/Bun, resolves the WASM path from the installed `nlpp-grammar` package automatically when `wasmUrl` is omitted. In browser/bundler contexts, the caller passes the URL of the served WASM asset.

Returns a `Language` object (from `web-tree-sitter`) to be passed to all other functions. Call once at startup; the result is safe to reuse across calls.

Throws if the WASM fails to load.

### Core functions (browser-safe)

All functions are synchronous except where noted. All are pure — they do not cache or mutate state.

```ts
parse(language: Language, text: string): Tree
```
Parses the full document text. Always returns a tree; never throws. Use the returned `Tree` as input to all other functions. Re-parse on every document change (Tree-sitter is fast enough for this; incremental parsing is a future optimization).

```ts
getHighlights(language: Language, tree: Tree): HighlightRange[]
```
Runs the `highlights.scm` query against the tree. Returns one range per captured node, with the capture name as `scope`. Order is document order.

```ts
getDiagnostics(language: Language, tree: Tree): Diagnostic[]
```
Walks the tree for `ERROR` and `MISSING` nodes. Each produces one `Diagnostic` at error severity with a human-readable message describing what was expected. Returns an empty array for a clean parse.

```ts
getCompletions(
  language: Language,
  tree: Tree,
  position: Position,
  resolveFile?: FileResolver
): Promise<CompletionItem[]>
```
Returns completions appropriate for the cursor position. Without `resolveFile`: built-in keywords and `define`d terms visible in the current file. With `resolveFile`: additionally includes symbols from imported files. Returns an empty array inside ERROR nodes or prose blocks.

```ts
getHover(
  language: Language,
  tree: Tree,
  position: Position,
  resolveFile?: FileResolver
): Promise<HoverResult | null>
```
Returns the definition of the keyword or `define`d term under the cursor. Built-in keyword definitions come from the hardcoded registry. `define`d terms from imported files require `resolveFile`. Returns `null` if the cursor is not on a known term.

```ts
getFolding(tree: Tree): FoldingRange[]
```
Returns folding ranges for block bodies (`{ … }`), block comments (`/* … */`), and prose blocks (`/? … ?/`).

```ts
getDefinition(
  language: Language,
  tree: Tree,
  position: Position,
  resolveFile?: FileResolver
): Promise<Location | null>
```
Resolves the `define` statement or block declaration that defines the symbol under the cursor. In-file definitions are always resolved. Cross-file definitions require `resolveFile`. Returns `null` if no definition is found.

### Preprocessor

```ts
preprocess(
  language: Language,
  entryText: string,
  entryPath: string,
  resolveFile: FileResolver
): Promise<PreprocessResult>
```

Produces a single prompt-ready string from an entry NL++ file:

1. Resolves `import` statements recursively via `resolveFile`. Deduplicates on canonical path. Inlines file contents at the import site.
2. Strips `line_comment` (`//`) and `block_comment` (`/* … */`) nodes.
3. Retains prose blocks (`/? … ?/` and `???`) as is.
4. Collects all built-in keywords and `define`d terms present in the result.
5. Appends a `KEYWORD GLOSSARY` section containing only the collected terms, using definitions from the built-in registry and from `define` statements in the file.

Throws `ImportError` (unresolvable path or rejected resolver promise) and `CircularImportError`. Emits unresolved custom block keyword warnings as part of the return value rather than throwing:

```ts
type PreprocessResult = {
  output: string
  warnings: PreprocessWarning[]
}

type PreprocessWarning = {
  kind: 'unresolved_custom_keyword'
  keyword: string
  range: Range
}
```

---

## Error Handling

| Situation | Behaviour |
|---|---|
| Syntax errors in input | `getDiagnostics()` returns `Diagnostic[]`; parse never throws |
| Cursor in ERROR node | `getCompletions`, `getHover`, `getDefinition` return empty/null |
| `resolveFile` omitted | Cross-file features degrade; in-file results still returned |
| Import path unresolvable | `preprocess()` throws `ImportError` |
| Circular import | `preprocess()` throws `CircularImportError` |
| WASM load failure | `initParser()` throws |
| Unknown custom block keyword | `preprocess()` returns warning in `PreprocessResult.warnings` |

---

## `nlpp-grammar` NPM Publication Notes

- `prepublishOnly` already runs `tree-sitter generate && tree-sitter build --wasm` — the WASM is built before publish.
- The `files` field already includes `*.wasm` and `queries/*` — no changes needed there.
- The new `exports` field is the only required `package.json` change beyond what already exists.
- The native binding (`bindings/node/`) continues to work for Node consumers who install the package and run `node-gyp-build` via the `install` script.

---

## Testing

### Unit tests (`bun test`)

One test file per exported function in `src/*.test.ts`. Tests feed raw NL++ strings (no WASM required — native binding available in Bun test environment).

| Test file | What it covers |
|---|---|
| `highlights.test.ts` | Scope names on keywords, strings, comments, prose blocks |
| `diagnostics.test.ts` | ERROR nodes from malformed input, clean parse returns `[]` |
| `completions.test.ts` | Keyword list at top level; `define`d term at custom block position; empty in prose block |
| `hover.test.ts` | Built-in keyword definition returned; `null` on plain identifier |
| `folding.test.ts` | Block bodies, block comments, prose blocks |
| `definition.test.ts` | Resolves `define` statement in same file; `null` on undefined symbol |
| `preprocess.test.ts` | Mock `fileResolver` with fixture strings; glossary content; comment stripping; prose retention; circular import throws |

### Integration test

`initParser()` (real WASM load) → `parse()` → `getDiagnostics()` on `nlpp-grammar/examples/class.nlpp`. Asserts zero diagnostics and at least one highlight range. Confirms the full WASM pipeline round-trips correctly.

### Test fixtures

`test/fixtures/` — a small set of `.nlpp` strings covering: clean file, file with syntax errors, file with `define` + custom block, file with prose blocks and fill-in markers.
