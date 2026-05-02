#!/usr/bin/env bun

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import {
  initParser, parse,
  getDiagnostics, getHighlights, getFolding,
  getCompletions, getHover,
  preprocess,
} from '../index.ts'
import type { FileResolver } from '../index.ts'

const filePath = process.argv[2]
if (!filePath) {
  console.error('Usage: bun scripts/demo.ts <file.nlpp>')
  process.exit(1)
}

const absPath = resolve(filePath)
const src = readFileSync(absPath, 'utf8')
const fileDir = dirname(absPath)

const hr = (label: string) => console.log(`\n${'─'.repeat(60)}\n  ${label}\n${'─'.repeat(60)}`)

hr(`NL++ Demo — ${filePath}`)
console.log(src.trimEnd())

const language = await initParser()
const tree = parse(language, src)

const resolver: FileResolver = async (importPath) => readFileSync(importPath, 'utf8')

// ── Diagnostics ─────────────────────────────────────────────────────────────
hr('Diagnostics')
const diags = getDiagnostics(language, tree)
if (diags.length === 0) {
  console.log('  ✓ No errors')
} else {
  for (const d of diags) {
    console.log(`  ✗ Line ${d.range.start.line + 1}:${d.range.start.character + 1}  ${d.message}`)
  }
}

// ── Syntax highlights ────────────────────────────────────────────────────────
hr('Syntax Highlights')
const highlights = getHighlights(language, tree)
const scopeCounts = new Map<string, number>()
for (const h of highlights) scopeCounts.set(h.scope, (scopeCounts.get(h.scope) ?? 0) + 1)
console.log(`  ${highlights.length} tokens across ${scopeCounts.size} scopes:`)
for (const [scope, count] of [...scopeCounts.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  console.log(`    ${scope.padEnd(32)} ${count}`)
}

// ── Folding ranges ───────────────────────────────────────────────────────────
hr('Folding Ranges')
const folds = getFolding(tree)
console.log(`  ${folds.length} foldable regions:`)
for (const f of folds) {
  console.log(`    lines ${String(f.startLine + 1).padStart(3)}–${String(f.endLine + 1).padEnd(3)}  (${f.kind})`)
}

// ── Hover ────────────────────────────────────────────────────────────────────
hr('Hover — sampling a few positions')
const hoverTargets: Array<{ label: string; line: number; char: number }> = [
  { label: 'import keyword (line 1)', line: 0, char: 0 },
  { label: 'aggregate keyword', line: src.split('\n').findIndex(l => l.trim().startsWith('aggregate Order')), char: 0 },
  { label: 'service keyword', line: src.split('\n').findIndex(l => l.trim().startsWith('service OrderService')), char: 0 },
]
for (const { label, line, char } of hoverTargets) {
  if (line < 0) continue
  const result = await getHover(language, tree, { line, character: char }, resolver)
  if (result) {
    const snippet = result.contents.length > 80 ? result.contents.slice(0, 80) + '…' : result.contents
    console.log(`  ${label}:\n    "${snippet}"`)
  } else {
    console.log(`  ${label}: (no hover)`)
  }
}

// ── Completions ──────────────────────────────────────────────────────────────
hr('Completions — at start of last line')
const lines = src.split('\n')
const completions = await getCompletions(language, tree, { line: lines.length - 1, character: 0 }, resolver)
const keywords = completions.filter(c => c.kind === 14)
const defines = completions.filter(c => c.kind !== 14)
console.log(`  ${completions.length} total — ${keywords.length} keywords, ${defines.length} defined terms`)
if (defines.length > 0) {
  console.log('  Defined terms available:')
  for (const d of defines) console.log(`    ${d.label}: ${d.detail?.slice(0, 60)}…`)
}

// ── Preprocessor ─────────────────────────────────────────────────────────────
hr('Preprocessor Output')
const result = await preprocess(language, src, absPath, resolver)
if (result.warnings.length > 0) {
  console.log(`  ⚠  ${result.warnings.length} warning(s):`)
  for (const w of result.warnings) {
    console.log(`     ${w.kind}: "${w.keyword}" at line ${w.range.start.line + 1}`)
  }
  console.log()
}
console.log(result.output)
