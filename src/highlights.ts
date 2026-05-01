import { Query } from 'web-tree-sitter'
import type { Language, Tree, HighlightRange } from './types.ts'
import { HIGHLIGHTS_QUERY } from './queries.ts'

export function getHighlights(language: Language, tree: Tree): HighlightRange[] {
  const query = new Query(language, HIGHLIGHTS_QUERY)
  const captures = query.captures(tree.rootNode)
  return captures.map(capture => ({
    startIndex: capture.node.startIndex,
    endIndex: capture.node.endIndex,
    scope: capture.name,
  }))
}
