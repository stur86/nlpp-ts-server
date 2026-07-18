# nlpp-ts-server

Language tooling for **NL++**, a pseudocode language for describing software
architecture to AI coding agents. NL++ "compiles" to a prompt — resolved
pseudocode plus a keyword glossary — that an LLM implements.

This package provides two things:

- **A library** of language-analysis functions built on the
  [`nlpp-grammar`](https://www.npmjs.com/package/nlpp-grammar) tree-sitter
  parser: diagnostics, completions, hover, folding, go-to-definition,
  syntax highlighting, and `preprocess()` — the compiler core.
- **The `nlpp-compile` CLI**, which resolves an `.nlpp` entry file into a single
  prompt-ready string.

`preprocess()` is the single source of truth for compilation; the CLI and every
editor feature delegate to it.

## Install

```bash
npm install nlpp-ts-server        # or: bun add nlpp-ts-server
```

## CLI

```bash
npx nlpp-compile path/to/entry.nlpp            # print the compiled prompt to stdout
npx nlpp-compile entry.nlpp > prompt.txt       # redirect it to a file
npx nlpp-compile --no-preamble entry.nlpp      # omit the NL++ specification preamble
```

The command resolves `import`s, strips comments, and appends the keyword
glossary. The prompt goes to **stdout**; warnings (e.g. unresolved custom
keywords) go to **stderr**, so stdout stays a clean, pipeable prompt.

## Library

```ts
import { initParser, preprocess, getDiagnostics } from 'nlpp-ts-server'
import { readFile } from 'node:fs/promises'

const language = await initParser()

// Compile an entry file into a prompt.
const source = await readFile('entry.nlpp', 'utf-8')
const { output, warnings } = await preprocess(
  language,
  source,
  'entry.nlpp',
  (path) => readFile(path, 'utf-8'),   // how imports are resolved
)

// Or drive individual editor features.
const diagnostics = getDiagnostics(language, source)
```

Exported entry points include `preprocess`, `initParser`/`parse`/
`parseIncremental`, and the LSP feature functions `getDiagnostics`,
`getHighlights`, `getFolding`, `getCompletions`, `getHover`, and
`getDefinition`, along with the `KEYWORD_REGISTRY` and their TypeScript types.

## License

MIT © Simone Sturniolo
