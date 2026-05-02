import type { Language, Tree, Position, FileResolver, CompletionItem } from './types.ts'
import { CompletionItemKind } from './types.ts'
import { KEYWORD_REGISTRY } from './keywords.ts'
import { nodeAtPosition, isInsideNodeOfType, collectDefines, resolveImports } from './utils.ts'

/**
 * Return completion items appropriate for the cursor position.
 *
 * Always includes all built-in NL++ keywords (from the keyword registry) and
 * any `define`d terms visible in the current file. Pass `resolveFile` to also
 * surface terms defined in imported files.
 *
 * Returns an empty array when the cursor is inside a prose block (`/? … ?/`)
 * or an `ERROR` node.
 *
 * @param language - The `Language` object returned by {@link initParser}.
 * @param tree - The syntax tree returned by {@link parse}.
 * @param position - Zero-based `{ line, character }` cursor position.
 * @param resolveFile - Optional async callback that resolves an absolute file
 *   path to its text content. Required for cross-file define completions.
 * 
 * @category Core API
 */
export async function getCompletions(
  language: Language,
  tree: Tree,
  position: Position,
  resolveFile?: FileResolver,
): Promise<CompletionItem[]> {
  const node = nodeAtPosition(tree, position)

  if (isInsideNodeOfType(node, 'prose_block')) return []
  if (isInsideNodeOfType(node, 'ERROR')) return []

  const items: CompletionItem[] = []

  // Built-in keywords
  for (const [label, detail] of Object.entries(KEYWORD_REGISTRY)) {
    items.push({ label, kind: CompletionItemKind.Keyword, detail })
  }

  // In-file defines
  const inFileDefines = collectDefines(tree)
  for (const [label, detail] of inFileDefines) {
    items.push({ label, kind: CompletionItemKind.Constant, detail })
  }

  // Cross-file defines
  if (resolveFile) {
    const imported = await resolveImports(tree, language, '', resolveFile)
    for (const importedTree of imported.values()) {
      for (const [label, detail] of collectDefines(importedTree)) {
        if (!inFileDefines.has(label)) {
          items.push({ label, kind: CompletionItemKind.Constant, detail })
        }
      }
    }
  }

  return items
}
