import type Parser from 'web-tree-sitter'

export type Language = Parser.Language
export type Tree = Parser.Tree
// @ts-ignore(2694)
export type SyntaxNode = Parser.SyntaxNode  
export type FileResolver = (path: string) => Promise<string>

export type Position = { line: number; character: number }

export type Range = {
  start: Position
  end: Position
}

export type Edit = { range: Range; text: string }

export type HighlightRange = {
  startIndex: number
  endIndex: number
  scope: string
}

export const DiagnosticSeverity = {
  Error: 1,
  Warning: 2,
  Information: 3,
  Hint: 4,
} as const
export type DiagnosticSeverity = typeof DiagnosticSeverity[keyof typeof DiagnosticSeverity]

export type Diagnostic = {
  range: Range
  message: string
  severity: DiagnosticSeverity
}

export const CompletionItemKind = {
  Function: 3,
  Variable: 6,
  Class: 7,
  Interface: 8,
  Keyword: 14,
  Constant: 21,
} as const
export type CompletionItemKind = typeof CompletionItemKind[keyof typeof CompletionItemKind]

export type CompletionItem = {
  label: string
  kind: CompletionItemKind
  detail?: string
}

export type HoverResult = {
  range: Range
  contents: string
}

export type FoldingRange = {
  startLine: number
  endLine: number
  kind: 'region' | 'comment'
}

export type Location = {
  uri: string
  range: Range
}

export type PreprocessWarning = {
  kind: 'unresolved_custom_keyword'
  keyword: string
  range: Range
}

export type PreprocessOptions = {
  /** When true, append every built-in keyword and every defined term to the
   *  glossary regardless of whether they appear in the output. */
  fullGlossary?: boolean
}

export type PreprocessResult = {
  output: string
  warnings: PreprocessWarning[]
}
