import type { Language, Tree, Position, FileResolver, Location, SyntaxNode } from './types.ts'
import { RESERVED_KEYWORDS } from './keywords.ts'
import { nodeAtPosition, nodeToRange, resolveImports } from './utils.ts'

function findDefineNode(tree: Tree, name: string): SyntaxNode | null {
  for (const node of tree.rootNode.children) {
    if (node && node.type === 'define_statement') {
      if (node.childForFieldName('name')?.text === name) return node
    }
  }
  return null
}

function findBlockDeclaration(tree: Tree, name: string): SyntaxNode | null {
  function walk(node: SyntaxNode): SyntaxNode | null {
    for (const type of ['object_block', 'function_block', 'custom_block']) {
      if (node.type === type && node.childForFieldName('name')?.text === name) return node
    }
    for (const child of node.children) {
      const found = walk(child)
      if (found) return found
    }
    return null
  }
  return walk(tree.rootNode)
}

function isOnDeclarationName(blockNode: SyntaxNode, cursorNode: SyntaxNode): boolean {
  const nameNode = blockNode.childForFieldName('name')
  if (!nameNode) return false
  return nameNode === cursorNode || nameNode.id === cursorNode.id
}

function resolveWordNode(node: SyntaxNode): SyntaxNode {
  // When cursor is on a uses_statement, the referenced name is the target field
  if (node.type === 'uses_statement') {
    const target = node.childForFieldName('target')
    if (target) return target
  }
  return node
}

/**
 * Resolve the definition site of the symbol at the cursor position.
 *
 * Searches in order: in-file `define` statements → in-file block declarations
 * → cross-file definitions (requires `resolveFile`). Returns `null` if the
 * cursor is on a built-in keyword, a declaration name itself, or an unknown
 * symbol.
 *
 * The returned {@link Location} uses an empty string `uri` for in-file
 * definitions and the resolved file path for cross-file definitions.
 *
 * @param language - The `Language` object returned by {@link initParser}.
 * @param tree - The syntax tree returned by {@link parse}.
 * @param position - Zero-based `{ line, character }` cursor position.
 * @param resolveFile - Optional async callback that resolves an absolute file
 *   path to its text content. Required for cross-file go-to-definition.
 * 
 * @category Core API
 */
export async function getDefinition(
  language: Language,
  tree: Tree,
  position: Position,
  resolveFile?: FileResolver,
): Promise<Location | null> {
  const rawNode = nodeAtPosition(tree, position)
  const node = resolveWordNode(rawNode)
  const word = node.text

  if (!word || RESERVED_KEYWORDS.has(word)) return null

  // In-file define
  const defineNode = findDefineNode(tree, word)
  if (defineNode) return { uri: '', range: nodeToRange(defineNode) }

  // In-file block declaration — but not if cursor is on the declaration name itself
  const blockNode = findBlockDeclaration(tree, word)
  if (blockNode && !isOnDeclarationName(blockNode, node)) {
    return { uri: '', range: nodeToRange(blockNode) }
  }

  // Cross-file
  if (resolveFile) {
    const imported = await resolveImports(tree, language, '', resolveFile)
    for (const [uri, importedTree] of imported) {
      const d = findDefineNode(importedTree, word) ?? findBlockDeclaration(importedTree, word)
      if (d) return { uri, range: nodeToRange(d) }
    }
  }

  return null
}
