import type { Language, Tree, Position, FileResolver, CompletionItem } from './types.ts'
import { CompletionItemKind } from './types.ts'
import { KEYWORD_REGISTRY } from './keywords.ts'
import { nodeAtPosition, isInsideNodeOfType, collectDefines, resolveImports } from './utils.ts'

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
