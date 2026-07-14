import type { Language, FileResolver, PreprocessResult, PreprocessOptions, PreprocessWarning, SyntaxNode } from './types.ts'
import { KEYWORD_REGISTRY } from './keywords.ts'
import { nodeToRange, extractImportPath } from './utils.ts'
import { parse } from './parser.ts'

/**
 * Fixed instruction block prepended to every compiled prompt. Frames the
 * resolved pseudocode as a specification and pins down the two things NL++
 * deliberately leaves open — target language and reuse-vs-new — with an
 * explicit instruction to ask rather than guess when either is ambiguous.
 */
const PREAMBLE = [
  'NL++ SPECIFICATION',
  'The following is resolved NL++ pseudocode describing software architecture and',
  'implementation intent. It is a specification for you to implement, not code to run.',
  'Interpret it faithfully; treat prose blocks and the keyword glossary as authoritative intent.',
  '',
  'Type annotations may use two notations. `&T` denotes a reference/address to `T`',
  '(e.g. `&int`). `T[…]` denotes a templated/parameterized type whose one or more',
  'comma-separated arguments are themselves types or integer literals — e.g.',
  '`Array[int]`, `Map[string, int]`, `Array[&int]`, and `Array[int, 32]` (an integer',
  'argument denotes a size or count). The two notations compose and nest freely.',
  'Like all NL++ type annotations they are advisory — adapt them to the target',
  'language\'s idioms.',
  '',
  'Two things are intentionally left unspecified. Resolve them from context, and ask',
  'instead of guessing whenever the answer is unclear:',
  '',
  '- Target language: no programming language is fixed here. Infer it from the conventions',
  '  of the surrounding codebase. If there is no surrounding codebase, or the choice is',
  '  genuinely ambiguous, ask before writing any code.',
  '- Reuse vs. new declaration: when working inside an existing codebase, check whether the',
  '  entities this pseudocode names or references already resolve to things declared',
  '  elsewhere. Where reusing an existing declaration matches the author\'s intent, reuse it',
  '  instead of creating a duplicate; where it is ambiguous whether a reference means an',
  '  existing entity or a new one, ask rather than assuming.',
  '',
  '---',
  '',
  '',
].join('\n')

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

/** Thrown by {@link preprocess} when an imported file cannot be resolved. */
export class ImportError extends Error {
  constructor(public readonly importPath: string, cause: unknown) {
    super(`Cannot resolve import "${importPath}": ${cause}`)
    this.name = 'ImportError'
  }
}

/**
 * Thrown by {@link preprocess} when a cycle is detected in the import graph.
 * @internal
 */
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

/**
 * Produce a single prompt-ready string from an entry NL++ file.
 *
 * Processing steps:
 * 1. Prepends a fixed `NL++ SPECIFICATION` preamble instructing the agent to
 *    infer the target language from the surrounding codebase and to reuse
 *    already-declared entities where intended — asking when either is ambiguous.
 *    Can be disabled via `options.preamble = false`.
 * 2. Resolves `import` statements recursively via `resolveFile`, deduplicating on path.
 * 3. Strips `//` line comments and block comments.
 * 4. Retains prose blocks (`/? … ?/`) and fill-in markers (`???`) verbatim.
 * 5. Appends a `KEYWORD GLOSSARY` section listing every built-in keyword and
 *    `define`d term that appears in the output, with their definitions.
 *
 * Unresolved custom block keywords (used but not `define`d) are reported as
 * {@link PreprocessWarning} objects in the result rather than throwing.
 *
 * @param language - The `Language` object returned by {@link initParser}.
 *   Required to parse imported files internally.
 * @param entryText - The text content of the entry file.
 * @param entryPath - The absolute path of the entry file, used to resolve
 *   relative `import` paths.
 * @param resolveFile - Async callback that receives an absolute path and
 *   returns the file's text content.
 * @param options - Optional {@link PreprocessOptions}. By default the
 *   `NL++ SPECIFICATION` preamble is prepended; pass `{ preamble: false }` to omit it.
 * @throws {@link ImportError} if a file cannot be resolved.
 * @throws `CircularImportError` if a cycle is detected in the import graph.
 *
 * @category Core API
 */
export async function preprocess(
  language: Language,
  entryText: string,
  entryPath: string,
  resolveFile: FileResolver,
  options: PreprocessOptions = {},
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
      if (!node) {
        continue
      }

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

  const preamble = (options.preamble ?? true) ? PREAMBLE : ''

  return { output: preamble + content + glossary, warnings }
}
