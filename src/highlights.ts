import { Query } from 'web-tree-sitter'
import type { Language, Tree, HighlightRange } from './types.ts'
import { HIGHLIGHTS_QUERY } from './queries.ts'

// Compiling the query is expensive and the result lives in WASM memory that is
// never garbage-collected, so compile once per Language and reuse it.
const queries = new WeakMap<Language, Query>()

function queryFor(language: Language): Query {
  let query = queries.get(language)
  if (!query) {
    query = new Query(language, HIGHLIGHTS_QUERY)
    queries.set(language, query)
  }
  return query
}

/**
 * Run the NL++ highlights query against a syntax tree and return token ranges.
 *
 * Each {@link HighlightRange} carries a `scope` name drawn from the
 * `highlights.scm` TextMate grammar (e.g. `"keyword.type"`, `"comment.line"`,
 * `"variable.member"`). Results are in document order.
 *
 * @param language - The `Language` object returned by {@link initParser}.
 * @param tree - The syntax tree returned by {@link parse}.
 * 
 * @category Core API
 */
export function getHighlights(language: Language, tree: Tree): HighlightRange[] {
  const captures = queryFor(language).captures(tree.rootNode)
  return captures.map(capture => ({
    startIndex: capture.node.startIndex,
    endIndex: capture.node.endIndex,
    scope: capture.name,
  }))
}
