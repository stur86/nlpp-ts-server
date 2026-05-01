import { Query } from 'web-tree-sitter'
import type { Language, Tree, HighlightRange } from './types.ts'
import { HIGHLIGHTS_QUERY } from './queries.ts'

/**
 * Run the NL++ highlights query against a syntax tree and return token ranges.
 *
 * Each {@link HighlightRange} carries a `scope` name drawn from the
 * `highlights.scm` TextMate grammar (e.g. `"keyword.type"`, `"comment.line"`,
 * `"variable.member"`). Results are in document order.
 *
 * @param language - The `Language` object returned by {@link initParser}.
 * @param tree - The syntax tree returned by {@link parse}.
 */
export function getHighlights(language: Language, tree: Tree): HighlightRange[] {
  const query = new Query(language, HIGHLIGHTS_QUERY)
  const captures = query.captures(tree.rootNode)
  return captures.map(capture => ({
    startIndex: capture.node.startIndex,
    endIndex: capture.node.endIndex,
    scope: capture.name,
  }))
}
