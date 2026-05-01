import type { Language, Tree, SyntaxNode, Diagnostic } from './types.ts'
import { DiagnosticSeverity } from './types.ts'
import { nodeToRange } from './utils.ts'

/**
 * Walk a syntax tree and return all parse errors as {@link Diagnostic} objects.
 *
 * Reports `ERROR` nodes (unexpected tokens) and `MISSING` nodes (expected
 * tokens that were absent) at {@link DiagnosticSeverity.Error} severity.
 * Returns an empty array for a clean parse.
 *
 * @param _language - The `Language` object (reserved for future query-based diagnostics).
 * @param tree - The syntax tree returned by {@link parse}.
 */
export function getDiagnostics(_language: Language, tree: Tree): Diagnostic[] {
  const diagnostics: Diagnostic[] = []

  function walk(node: SyntaxNode) {
    if (node.type === 'ERROR') {
      diagnostics.push({
        range: nodeToRange(node),
        message: node.text.length > 0
          ? `Syntax error: unexpected "${node.text.slice(0, 20)}"`
          : 'Syntax error',
        severity: DiagnosticSeverity.Error,
      })
    } else if (node.isMissing) {
      diagnostics.push({
        range: nodeToRange(node),
        message: `Syntax error: expected "${node.type}"`,
        severity: DiagnosticSeverity.Error,
      })
    } else {
      for (const child of node.children) walk(child)
    }
  }

  walk(tree.rootNode)
  return diagnostics
}
