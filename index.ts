/**
 * @packageDocumentation
 */

/**
 * @categoryDescription Core API
 * These functions provide the core API for parsing and analyzing NL++ code. They are the ones
 * you should use in most cases when working with NL++ documents.
 * @showCategories
 * @module
 */


export { initParser, parse, parseIncremental } from './src/parser.ts'
export { getDiagnostics } from './src/diagnostics.ts'
export { getHighlights } from './src/highlights.ts'
export { getFolding } from './src/folding.ts'
export { getCompletions } from './src/completions.ts'
export { getHover } from './src/hover.ts'
export { getDefinition } from './src/definition.ts'
export { preprocess, ImportError, CircularImportError } from './src/preprocess.ts'
export type {
  Language,
  Tree,
  SyntaxNode,
  FileResolver,
  Position,
  Range,
  Edit,
  HighlightRange,
  Diagnostic,
  CompletionItem,
  HoverResult,
  FoldingRange,
  Location,
  PreprocessWarning,
  PreprocessResult,
  PreprocessOptions,
} from './src/types.ts'
export { DiagnosticSeverity, CompletionItemKind } from './src/types.ts'
export { KEYWORD_REGISTRY, KEYWORD_NAMES, RESERVED_KEYWORDS } from './src/keywords.ts'
