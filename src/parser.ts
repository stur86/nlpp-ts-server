import { Parser, Language as WtsLanguage } from 'web-tree-sitter'
import type { Language, Tree } from './types.ts'

export type { Language, Tree, SyntaxNode } from './types.ts'

/**
 * Initialise the web-tree-sitter runtime and load the NL++ WASM grammar.
 *
 * Call once at startup and reuse the returned `Language` for all subsequent
 * operations. The call is idempotent — calling it multiple times is safe but
 * wasteful.
 *
 * @param wasmUrl - Optional override for the WASM file location.
 *   Omit in Node/Bun environments — the path is resolved automatically from
 *   the installed `nlpp-grammar` package.
 *   Pass a URL or path string in browser/bundler contexts where the WASM asset
 *   is served from a known URL.
 * @throws If the WASM file cannot be located or fails to load.
 */
export async function initParser(wasmUrl?: string | URL): Promise<Language> {
  await Parser.init()
  let path: string
  if (wasmUrl !== undefined) {
    path = wasmUrl instanceof URL ? wasmUrl.pathname : wasmUrl
  } else {
    path = new URL(import.meta.resolve('nlpp-grammar/wasm')).pathname
  }
  return await WtsLanguage.load(path)
}

/**
 * Parse a NL++ document and return a syntax tree.
 *
 * Always returns a tree — never throws, even for completely invalid input.
 * Syntax errors are represented as `ERROR` and `MISSING` nodes in the tree,
 * which {@link getDiagnostics} converts to {@link Diagnostic} objects.
 *
 * Re-parse on every document change; incremental parsing is not yet supported.
 *
 * @param language - The `Language` object returned by {@link initParser}.
 * @param text - Full document text.
 */
export function parse(language: Language, text: string): Tree {
  const parser = new Parser()
  parser.setLanguage(language)
  return parser.parse(text) as Tree
}
