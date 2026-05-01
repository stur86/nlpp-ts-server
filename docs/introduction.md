---
title: Introduction
---

# nlpp-ts-server

`nlpp-ts-server` is a TypeScript library providing language tooling for [NL++](https://github.com/stur86/nlpp-grammar) — a pseudocode language for expressing software architecture and implementation intent to AI coding agents.

It wraps the `nlpp-grammar` Tree-sitter parser (via its WASM build) and exposes a set of pure, stateless functions that power editor features and prompt preprocessing.

---

## Installation

```bash
npm install nlpp-ts-server
# or
bun add nlpp-ts-server
```

---

## Quick start

All functions share the same two-step setup: initialise the parser once, then call `parse()` on each document change.

```ts
import { initParser, parse, getDiagnostics, getHighlights } from 'nlpp-ts-server'

// 1. Load the WASM grammar — do this once at startup
const language = await initParser()

// 2. Parse a document
const tree = parse(language, `
class OrderService {
  field auto id
  method auto place_order(Order order) {}
}
`)

// 3. Use the tree with any of the library's functions
const diagnostics = getDiagnostics(language, tree)  // []
const highlights  = getHighlights(language, tree)   // HighlightRange[]
```

In browser or bundler contexts where the WASM asset is served from a custom URL, pass it to `initParser`:

```ts
const language = await initParser('/assets/tree-sitter-nlpp.wasm')
```

---

## Functions

| Function | Returns | Description |
|---|---|---|
| {@link initParser} | `Promise<Language>` | Load the WASM grammar. Call once. |
| {@link parse} | `Tree` | Parse a document. Never throws. |
| {@link getDiagnostics} | `Diagnostic[]` | Syntax errors from the tree. |
| {@link getHighlights} | `HighlightRange[]` | Token scopes for syntax colouring. |
| {@link getFolding} | `FoldingRange[]` | Foldable block and comment regions. |
| {@link getCompletions} | `Promise<CompletionItem[]>` | Keyword and define completions. |
| {@link getHover} | `Promise<HoverResult \| null>` | Definition of the symbol at the cursor. |
| {@link getDefinition} | `Promise<Location \| null>` | Jump-to-definition for symbols. |
| {@link preprocess} | `Promise<PreprocessResult>` | Produce a prompt-ready string. |

---

## The file resolver pattern

Functions that resolve cross-file symbols (`getCompletions`, `getHover`, `getDefinition`, `preprocess`) accept an optional `resolveFile` callback:

```ts
type FileResolver = (path: string) => Promise<string>
```

The callback receives an absolute path and should return the file's text content. Keeping I/O out of the library makes it runtime-agnostic — the same code runs in Bun, Node.js, and bundler environments.

**Bun / Node.js example:**

```ts
import { readFile } from 'node:fs/promises'

const resolveFile: FileResolver = (path) => readFile(path, 'utf8')
```

**Browser example (fetching from a server):**

```ts
const resolveFile: FileResolver = (path) =>
  fetch(`/api/files?path=${encodeURIComponent(path)}`).then(r => r.text())
```

When `resolveFile` is omitted, cross-file features degrade gracefully — in-file results are still returned.

---

## Preprocessor

`preprocess` is the primary output of the library: it converts an NL++ entry file into a single, prompt-ready string.

```ts
import { initParser, preprocess } from 'nlpp-ts-server'
import { readFile } from 'node:fs/promises'

const language  = await initParser()
const entryText = await readFile('./architecture.nlpp', 'utf8')

const { output, warnings } = await preprocess(
  language,
  entryText,
  '/absolute/path/to/architecture.nlpp',
  (path) => readFile(path, 'utf8'),
)

// `output` is ready to inject into a system prompt
```

The preprocessor:
1. Resolves `import` statements recursively (deduplicating on path)
2. Strips `//` line comments and block comments
3. Retains prose blocks (`/? … ?/`) and fill-in markers (`???`) verbatim
4. Appends a `KEYWORD GLOSSARY` with definitions for every keyword and `define`d term that appears in the output

Unresolved custom block keywords produce `PreprocessWarning` entries in the result rather than throwing. Import errors and circular imports throw `ImportError` and `CircularImportError` respectively.

---

## Positions and ranges

All positional types use **zero-based** line and character offsets, matching the [LSP specification](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#position). `line: 0, character: 0` is the very first character of the document.

```ts
type Position = { line: number; character: number }
type Range    = { start: Position; end: Position }
```
