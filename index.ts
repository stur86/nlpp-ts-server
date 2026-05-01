/**
 * @packageDocumentation
 * @document ./docs/introduction.md
 */

export { initParser, parse } from './src/parser.ts'
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
  HighlightRange,
  Diagnostic,
  CompletionItem,
  HoverResult,
  FoldingRange,
  Location,
  PreprocessWarning,
  PreprocessResult,
} from './src/types.ts'
export { DiagnosticSeverity, CompletionItemKind } from './src/types.ts'
export { KEYWORD_REGISTRY, KEYWORD_NAMES, RESERVED_KEYWORDS } from './src/keywords.ts'
