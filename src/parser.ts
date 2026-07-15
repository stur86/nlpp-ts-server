import { Parser, Language as WtsLanguage } from 'web-tree-sitter'
import type { Language, Tree, Position, Edit } from './types.ts'

export type { Language, Tree, SyntaxNode } from './types.ts'

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
  const lastLine = lines.at(-1) ?? ''
  return { line: startPosition.line + lines.length - 1, character: lastLine.length }
}

/**
 * Initialise the web-tree-sitter runtime and load the NL++ WASM grammar.
 *
 * Call once at startup and reuse the returned `Language` for all subsequent
 * operations. The call is idempotent — calling it multiple times is safe but
 * wasteful.
 *
 * @param wasmUrl - Optional override for the WASM file location.
 *   Omit in Node/Bun environments — the path comes from the installed
 *   `nlpp-grammar` package's `wasmPath` export.
 *   Pass a URL or path string in browser/bundler contexts where the WASM asset
 *   is served from a known URL, or where `nlpp-grammar` is not resolvable at
 *   runtime (a bundled vsix, for instance).
 * @throws If the WASM file cannot be located or fails to load.
 * 
 * @category Core API
 */
export async function initParser(wasmUrl?: string | URL): Promise<Language> {
  await Parser.init()
  return await WtsLanguage.load(await resolveWasm(wasmUrl))
}

/**
 * Work out where the grammar WASM lives.
 *
 * The `nlpp-grammar` import is dynamic on purpose. Bundlers that inline this
 * module (nlpp-vscode builds a self-contained vsix) would otherwise pull the
 * grammar's entry point into the bundle and run its top-level file reads at
 * load — against paths relative to the bundle, where nothing exists. Keeping it
 * lazy means the import only happens when no override was given, which is
 * exactly the case those bundles never hit: they pass an explicit path.
 */
async function resolveWasm(wasmUrl?: string | URL): Promise<string> {
  if (wasmUrl === undefined) {
    const { wasmPath } = await import('nlpp-grammar')
    return wasmPath
  }
  if (typeof wasmUrl === 'string') return wasmUrl
  // Keep the full href for http(s): taking `.pathname` would silently drop the
  // origin and break a WASM served from another host.
  return wasmUrl.protocol === 'file:' ? decodeURIComponent(wasmUrl.pathname) : wasmUrl.href
}

/**
 * Parse a NL++ document and return a syntax tree.
 *
 * Always returns a tree — never throws, even for completely invalid input.
 * Syntax errors are represented as `ERROR` and `MISSING` nodes in the tree,
 * which {@link getDiagnostics} converts to {@link Diagnostic} objects.
 *
 * @param language - The `Language` object returned by {@link initParser}.
 * @param text - Full document text.
 * 
 * @category Core API
 */
export function parse(language: Language, text: string): Tree {
  const parser = new Parser()
  parser.setLanguage(language)
  return parser.parse(text) as Tree
}

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
