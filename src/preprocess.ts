import type { Language, FileResolver, PreprocessResult, PreprocessWarning, SyntaxNode } from './types.ts'
import { KEYWORD_REGISTRY } from './keywords.ts'
import { nodeToRange, extractImportPath } from './utils.ts'
import { parse } from './parser.ts'

/** Serialize a node back to text, stripping line_comment and block_comment nodes. */
function serializeStrippingComments(node: SyntaxNode, originalText: string): string {
  if (node.type === 'line_comment' || node.type === 'block_comment') return ''
  if (node.childCount === 0) {
    return originalText.slice(node.startIndex, node.endIndex)
  }
  let result = ''
  let cursor = node.startIndex
  for (const child of node.children) {
    if (child.type === 'line_comment' || child.type === 'block_comment') {
      // skip — also skip trailing whitespace/newline after comment if any
      cursor = child.endIndex
      continue
    }
    // fill gap between cursor and child start
    result += originalText.slice(cursor, child.startIndex)
    result += serializeStrippingComments(child, originalText)
    cursor = child.endIndex
  }
  // append trailing text up to end of node
  result += originalText.slice(cursor, node.endIndex)
  return result
}

export class ImportError extends Error {
  constructor(public readonly importPath: string, cause: unknown) {
    super(`Cannot resolve import "${importPath}": ${cause}`)
    this.name = 'ImportError'
  }
}

export class CircularImportError extends Error {
  constructor(public readonly importPath: string, public readonly importStack: string[]) {
    super(`Circular import detected: ${[...importStack, importPath].join(' → ')}`)
    this.name = 'CircularImportError'
  }
}

function collectUsedBuiltins(node: SyntaxNode, out: Set<string>): void {
  if (node.type === 'object_keyword') out.add(node.text)
  else if (node.type === 'function_keyword') out.add(node.text)
  else if (node.type === 'access_modifier') out.add(node.text)
  else if (node.type === 'import_statement') out.add('import')
  else if (node.type === 'define_statement') out.add('define')
  else if (node.type === 'uses_statement') out.add('uses')
  else if (node.type === 'field_statement') out.add('field')
  if (node.text === 'override') out.add('override')
  if (node.text === 'inherits') out.add('inherits')
  if (node.text === 'implements') out.add('implements')
  if (node.type === 'type' && node.text === 'auto') out.add('auto')
  for (const child of node.children) collectUsedBuiltins(child, out)
}

export async function preprocess(
  language: Language,
  entryText: string,
  entryPath: string,
  resolveFile: FileResolver,
): Promise<PreprocessResult> {
  const visited = new Set<string>()
  const warnings: PreprocessWarning[] = []
  const definedTerms = new Map<string, string>()
  const usedBuiltins = new Set<string>()
  const usedDefinedTerms = new Set<string>()

  async function processFile(text: string, path: string, callStack: string[]): Promise<string> {
    if (callStack.includes(path)) throw new CircularImportError(path, callStack)
    if (visited.has(path)) return ''
    visited.add(path)

    const tree = parse(language, text)
    collectUsedBuiltins(tree.rootNode, usedBuiltins)

    let output = ''

    for (const node of tree.rootNode.children) {
      if (node.type === 'line_comment' || node.type === 'block_comment') {
        continue
      }

      if (node.type === 'import_statement') {
        const importedPath = extractImportPath(node, path)
        let importedText: string
        try {
          importedText = await resolveFile(importedPath)
        } catch (err) {
          throw new ImportError(importedPath, err)
        }
        output += await processFile(importedText, importedPath, [...callStack, path])
        continue
      }

      if (node.type === 'define_statement') {
        const name = node.namedChildren[0]?.text ?? ''
        const defBody = node.namedChildren[1]?.text ?? ''
        const body = defBody.replace(/^\s*"|"\s*$/g, '').trim()
        if (name) definedTerms.set(name, body)
      }

      if (node.type === 'custom_block') {
        const keyword = node.children[0]?.text ?? ''
        if (keyword) {
          usedDefinedTerms.add(keyword)
          if (!definedTerms.has(keyword)) {
            warnings.push({
              kind: 'unresolved_custom_keyword',
              keyword,
              range: nodeToRange(node),
            })
          }
        }
      }

      output += serializeStrippingComments(node, text) + '\n'
    }

    return output
  }

  const content = await processFile(entryText, entryPath, [])

  // Build glossary — skip 'import' since import statements are stripped from output
  const glossaryLines: string[] = []
  for (const kw of usedBuiltins) {
    if (kw === 'import') continue
    const def = KEYWORD_REGISTRY[kw]
    if (def) glossaryLines.push(`${kw}: ${def}`)
  }
  for (const term of usedDefinedTerms) {
    const def = definedTerms.get(term)
    if (def) glossaryLines.push(`${term}: ${def}`)
  }

  const glossary = glossaryLines.length > 0
    ? [
        '',
        '---',
        'KEYWORD GLOSSARY',
        'The following terms appear in the pseudocode above. Treat them as architectural intent.',
        '',
        ...glossaryLines,
      ].join('\n')
    : ''

  return { output: content + glossary, warnings }
}
