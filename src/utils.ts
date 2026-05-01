import type { SyntaxNode, Tree, Language, Range, Position, FileResolver } from './types.ts'
import { parse } from './parser.ts'

export function nodeToRange(node: SyntaxNode): Range {
  return {
    start: { line: node.startPosition.row, character: node.startPosition.column },
    end: { line: node.endPosition.row, character: node.endPosition.column },
  }
}

export function nodeAtPosition(tree: Tree, position: Position): SyntaxNode {
  return tree.rootNode.descendantForPosition({
    row: position.line,
    column: position.character,
  })
}

export function isInsideNodeOfType(node: SyntaxNode, type: string): boolean {
  let current: SyntaxNode | null = node
  while (current) {
    if (current.type === type) return true
    current = current.parent
  }
  return false
}

export function collectDefines(tree: Tree): Map<string, string> {
  const defines = new Map<string, string>()
  function walk(node: SyntaxNode) {
    if (node.type === 'define_statement') {
      const name = node.childForFieldName('name')?.text ?? ''
      const body = node.childForFieldName('definition')?.text?.replace(/^"|"$/g, '') ?? ''
      if (name) defines.set(name, body)
    }
    for (const child of node.children) walk(child)
  }
  walk(tree.rootNode)
  return defines
}

export function extractImportPath(importNode: SyntaxNode, currentFilePath: string): string {
  const raw = importNode.childForFieldName('path')?.text ?? ''
  const relative = raw.replace(/^"|"$/g, '')
  const dir = currentFilePath.replace(/\/[^/]+$/, '')
  return `${dir}/${relative}`.replace(/\/\.\//g, '/')
}

export async function resolveImports(
  tree: Tree,
  language: Language,
  currentPath: string,
  resolveFile: FileResolver,
  visited = new Set<string>(),
): Promise<Map<string, Tree>> {
  const result = new Map<string, Tree>()
  for (const node of tree.rootNode.children) {
    if (node.type !== 'import_statement') continue
    const importedPath = extractImportPath(node, currentPath)
    if (visited.has(importedPath)) continue
    visited.add(importedPath)
    try {
      const text = await resolveFile(importedPath)
      const importedTree = parse(language, text)
      result.set(importedPath, importedTree)
      const nested = await resolveImports(importedTree, language, importedPath, resolveFile, visited)
      for (const [k, v] of nested) result.set(k, v)
    } catch {
      // swallow — callers that need error reporting handle it themselves
    }
  }
  return result
}
