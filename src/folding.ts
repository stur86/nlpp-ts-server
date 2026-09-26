import type { Tree, SyntaxNode, FoldingRange } from './types.ts'
import { childrenOf } from './utils.ts'

/**
 * Return all foldable regions in a syntax tree.
 *
 * Covers three kinds of foldable construct:
 * - **`region`** — multi-line block bodies and prose blocks (`/? … ?/`)
 * - **`comment`** — multi-line block comments
 *
 * Single-line constructs are never returned.
 *
 * @param tree - The syntax tree returned by {@link parse}.
 * 
 * @category Core API
 */
export function getFolding(tree: Tree): FoldingRange[] {
  const ranges: FoldingRange[] = []

  function walk(node: SyntaxNode) {
    const startLine = node.startPosition.row
    const endLine = node.endPosition.row
    if (startLine >= endLine) {
      for (const child of childrenOf(node)) walk(child)
      return
    }

    if (node.type === 'block_comment') {
      ranges.push({ startLine, endLine, kind: 'comment' })
    } else if (node.type === 'prose_block') {
      ranges.push({ startLine, endLine, kind: 'region' })
    } else if (node.type === 'body') {
      // Only fold bodies that span multiple lines and don't just contain prose blocks
      const hasNonProseChild = childrenOf(node).some(
        (c: SyntaxNode) => c.type !== 'prose_block' && c.type !== '{' && c.type !== '}'
      )
      if (hasNonProseChild) {
        ranges.push({ startLine, endLine, kind: 'region' })
      }
    }

    for (const child of childrenOf(node)) walk(child)
  }

  walk(tree.rootNode)
  return ranges
}
