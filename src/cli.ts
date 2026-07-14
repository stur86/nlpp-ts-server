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
 */
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { initParser } from './parser.ts'
import { preprocess } from './preprocess.ts'
import type { FileResolver } from './types.ts'

async function main(argv: string[]): Promise<number> {
  const args = argv.filter(a => a !== '--')
  const file = args[0]
  if (!file || file === '-h' || file === '--help') {
    const stream = file ? process.stdout : process.stderr
    stream.write('Usage: nlpp-compile <entry.nlpp>\n\n')
    stream.write('Resolves imports, strips comments, and appends the keyword glossary,\n')
    stream.write('printing the prompt-ready output to stdout.\n')
    return file ? 0 : 1
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

  try {
    const language = await initParser()
    const { output, warnings } = await preprocess(language, entryText, entryPath, resolver)
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

main(process.argv.slice(2)).then(code => process.exit(code))
