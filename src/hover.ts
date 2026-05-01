import type { Language, Tree, Position, FileResolver, HoverResult, SyntaxNode } from './types.ts'
import { KEYWORD_REGISTRY } from './keywords.ts'
import { nodeAtPosition, nodeToRange, collectDefines, resolveImports } from './utils.ts'

function keywordAtNode(node: SyntaxNode): string | null {
  const KEYWORD_NAMED_PARENT_TYPES = new Set([
    'object_keyword', 'function_keyword', 'access_modifier',
  ])
  const KEYWORD_LITERALS = new Set([
    'field', 'uses', 'import', 'define', 'auto', 'override', 'inherits', 'implements',
  ])

  // Anonymous token whose parent is a named keyword node
  if (!node.isNamed && node.parent && KEYWORD_NAMED_PARENT_TYPES.has(node.parent.type)) {
    return node.text
  }
  // Named keyword node directly
  if (KEYWORD_NAMED_PARENT_TYPES.has(node.type)) return node.text
  // Anonymous token that is the keyword field of a custom_block
  if (!node.isNamed && node.parent?.type === 'custom_block' && node === node.parent.childForFieldName('keyword')) {
    return node.text
  }
  if (KEYWORD_LITERALS.has(node.text) && node.isNamed === false) return node.text
  return null
}

/**
 * Return the hover documentation for the symbol at the cursor position.
 *
 * Resolves in order: built-in keyword definition → in-file `define` term →
 * cross-file `define` term (requires `resolveFile`). Returns `null` if the
 * cursor is not over a known keyword or defined term.
 *
 * @param language - The `Language` object returned by {@link initParser}.
 * @param tree - The syntax tree returned by {@link parse}.
 * @param position - Zero-based `{ line, character }` cursor position.
 * @param resolveFile - Optional async callback that resolves an absolute file
 *   path to its text content. Required for hover on cross-file defined terms.
 */
export async function getHover(
  language: Language,
  tree: Tree,
  position: Position,
  resolveFile?: FileResolver,
): Promise<HoverResult | null> {
  const node = nodeAtPosition(tree, position)
  const range = nodeToRange(node)

  // Built-in keyword
  const keyword = keywordAtNode(node)
  if (keyword && KEYWORD_REGISTRY[keyword]) {
    return { range, contents: KEYWORD_REGISTRY[keyword] }
  }

  // In-file define
  const inFileDef = collectDefines(tree).get(node.text)
  if (inFileDef) return { range, contents: inFileDef }

  // Cross-file define
  if (resolveFile) {
    const imported = await resolveImports(tree, language, '', resolveFile)
    for (const importedTree of imported.values()) {
      const def = collectDefines(importedTree).get(node.text)
      if (def) return { range, contents: def }
    }
  }

  return null
}
