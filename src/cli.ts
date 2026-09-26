#!/usr/bin/env node
/**
 * `nlpp-compile` — resolve an NL++ entry file into a single prompt-ready string.
 *
 * Reads the entry file, resolves imports, strips comments, and appends the
 * keyword glossary (via {@link preprocess}), then writes the result to stdout.
 * Preprocess warnings (e.g. unresolved custom keywords) go to stderr so stdout
 * stays a clean, pipeable prompt.
 *
 * Usage:
 *   nlpp-compile <entry.nlpp>
 *   nlpp-compile <entry.nlpp> > prompt.txt
 *   nlpp-compile --no-preamble <entry.nlpp>   # omit the NL++ SPECIFICATION preamble
 *   nlpp-compile --root <dir> <entry.nlpp>    # allow imports anywhere under <dir>
 */
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { initParser } from './parser.ts'
import { preprocess } from './preprocess.ts'
import type { FileResolver } from './types.ts'

const USAGE = `Usage: nlpp-compile [--no-preamble] [--root <dir>] <entry.nlpp>

Resolves imports, strips comments, and appends the keyword glossary,
printing the prompt-ready output to stdout.

  --no-preamble   omit the NL++ SPECIFICATION instruction preamble
  --root <dir>    directory imports must stay inside (default: the entry
                  file's directory). Only .nlpp files can be imported.
  -h, --help      show this help
`

type Args = { file?: string; preamble: boolean; root?: string; help: boolean }

function parseArgs(argv: string[]): Args | string {
  const args: Args = { preamble: true, help: false }
  let positionalOnly = false
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!
    if (!positionalOnly && a.startsWith('-')) {
      if (a === '--') positionalOnly = true
      else if (a === '-h' || a === '--help') args.help = true
      else if (a === '--no-preamble') args.preamble = false
      else if (a === '--root') {
        const dir = argv[++i]
        if (dir === undefined) return '--root requires a directory'
        args.root = dir
      } else if (a.startsWith('--root=')) args.root = a.slice('--root='.length)
      else return `unknown option ${a}`
      continue
    }
    if (args.file !== undefined) return `unexpected extra argument ${a}`
    args.file = a
  }
  return args
}

async function main(argv: string[]): Promise<number> {
  const args = parseArgs(argv)
  if (typeof args === 'string') {
    process.stderr.write(`nlpp-compile: ${args}\n\n${USAGE}`)
    return 1
  }
  if (args.help) {
    process.stdout.write(USAGE)
    return 0
  }
  const file = args.file
  if (!file) {
    process.stderr.write(USAGE)
    return 1
  }

  const entryPath = resolve(file)
  let entryText: string
  try {
    entryText = await readFile(entryPath, 'utf-8')
  } catch (err) {
    process.stderr.write(`nlpp-compile: cannot read ${file}: ${err}\n`)
    return 1
  }

  const resolver: FileResolver = (path: string) => readFile(path, 'utf-8')
  const root = args.root === undefined ? undefined : resolve(args.root)

  try {
    const language = await initParser()
    const { output, warnings } = await preprocess(language, entryText, entryPath, resolver, {
      preamble: args.preamble,
      root,
    })
    for (const w of warnings) {
      process.stderr.write(
        `nlpp-compile: warning: ${w.kind}: "${w.keyword}" at line ${w.range.start.line + 1}\n`,
      )
    }
    process.stdout.write(output.endsWith('\n') ? output : output + '\n')
    return 0
  } catch (err) {
    process.stderr.write(`nlpp-compile: ${(err as Error).message ?? err}\n`)
    return 1
  }
}

// Set exitCode rather than calling process.exit(): exit() does not wait for
// pending stdout writes, which are asynchronous for pipes on macOS/Windows, so
// a large prompt piped to another program could be truncated.
main(process.argv.slice(2)).then(code => { process.exitCode = code })
