import { Parser, Language as WtsLanguage } from 'web-tree-sitter'
import type { Language, Tree } from './types.ts'

export type { Language, Tree, SyntaxNode } from './types.ts'

export async function initParser(wasmUrl?: string | URL): Promise<Language> {
  await Parser.init()
  let path: string
  if (wasmUrl !== undefined) {
    path = wasmUrl instanceof URL ? wasmUrl.pathname : wasmUrl
  } else {
    path = new URL(import.meta.resolve('nlpp-grammar/wasm')).pathname
  }
  return await WtsLanguage.load(path)
}

export function parse(language: Language, text: string): Tree {
  const parser = new Parser()
  parser.setLanguage(language)
  return parser.parse(text) as Tree
}
