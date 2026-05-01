import type { Tree, SyntaxNode, FoldingRange } from './types.ts'

export function getFolding(tree: Tree): FoldingRange[] {
  const ranges: FoldingRange[] = []

  function walk(node: SyntaxNode) {
    const startLine = node.startPosition.row
    const endLine = node.endPosition.row
    if (startLine >= endLine) {
      for (const child of node.children) walk(child)
      return
    }

    if (node.type === 'block_comment') {
      ranges.push({ startLine, endLine, kind: 'comment' })
    } else if (node.type === 'prose_block') {
      ranges.push({ startLine, endLine, kind: 'region' })
    } else if (node.type === 'body') {
      // Only fold bodies that span multiple lines and don't just contain prose blocks
      const hasNonProseChild = node.children.some(
        (c: SyntaxNode) => c.type !== 'prose_block' && c.type !== '{' && c.type !== '}'
      )
      if (hasNonProseChild) {
        ranges.push({ startLine, endLine, kind: 'region' })
      }
    }

    for (const child of node.children) walk(child)
  }

  walk(tree.rootNode)
  return ranges
}
