import type { SyntaxNode, Tree, Language, Range, Position, FileResolver } from './types.ts'
import { parse } from './parser.ts'
import { ImportError } from './errors.ts'
import { dirnamePath, isWithinRoot, normalizePath, resolvePath } from './paths.ts'

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

/** Extract the raw (unquoted) path string of an `import` statement. */
export function extractImportPath(importNode: SyntaxNode): string {
  const raw = importNode.childForFieldName('path')?.text ?? ''
  return raw.replace(/^"|"$/g, '')
}

/**
 * Resolve the target of an `import` statement to a normalised absolute path.
 *
 * Rejects (throws {@link ImportError}) imports that do not name a `.nlpp` file
 * and, when `root` is given, imports that resolve outside `root`. Both checks
 * exist because the compiled prompt is usually sent to a third-party LLM: an
 * untrusted `.nlpp` file must not be able to pull arbitrary local files
 * (`~/.ssh/id_rsa`, `.env`, …) into it.
 */
export function resolveImportTarget(
  importNode: SyntaxNode,
  currentFilePath: string,
  root?: string,
): string {
  const raw = extractImportPath(importNode)
  if (!raw.endsWith('.nlpp')) {
    throw new ImportError(raw, 'only .nlpp files can be imported')
  }
  const resolved = resolvePath(dirnamePath(currentFilePath), raw)
  if (root !== undefined && !isWithinRoot(resolved, root)) {
    throw new ImportError(raw, `resolves to ${resolved}, outside the allowed root ${normalizePath(root)}`)
  }
  return resolved
}

/**
 * Parse every file reachable through `import`s from `tree`.
 *
 * Imports that are invalid or fail to resolve are skipped silently — this
 * powers best-effort editor features, not compilation.
 *
 * @param currentPath - Path of the document `tree` was parsed from. Relative
 *   imports are resolved against its directory.
 * @param root - If given, imports resolving outside this directory are skipped.
 */
export async function resolveImports(
  tree: Tree,
  language: Language,
  currentPath: string,
  resolveFile: FileResolver,
  root?: string,
  visited = new Set<string>([normalizePath(currentPath)]),
): Promise<Map<string, Tree>> {
  const result = new Map<string, Tree>()
  for (const node of tree.rootNode.children) {
    if (!node) continue
    if (node.type !== 'import_statement') continue
    try {
      const importedPath = resolveImportTarget(node, currentPath, root)
      if (visited.has(importedPath)) continue
      visited.add(importedPath)
      const text = await resolveFile(importedPath)
      const importedTree = parse(language, text)
      result.set(importedPath, importedTree)
      const nested = await resolveImports(importedTree, language, importedPath, resolveFile, root, visited)
      for (const [k, v] of nested) result.set(k, v)
    } catch {
      // swallow — callers that need error reporting handle it themselves
    }
  }
  return result
}
