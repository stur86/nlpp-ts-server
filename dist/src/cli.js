#!/usr/bin/env node
import {
  initParser,
  preprocess
} from "../chunk-N4YYYNTZ.js";

// src/cli.ts
import { readFile } from "fs/promises";
import { resolve } from "path";
async function main(argv) {
  const args = argv.filter((a) => a !== "--");
  const file = args[0];
  if (!file || file === "-h" || file === "--help") {
    const stream = file ? process.stdout : process.stderr;
    stream.write("Usage: nlpp-compile <entry.nlpp>\n\n");
    stream.write("Resolves imports, strips comments, and appends the keyword glossary,\n");
    stream.write("printing the prompt-ready output to stdout.\n");
    return file ? 0 : 1;
  }
  const entryPath = resolve(file);
  let entryText;
  try {
    entryText = await readFile(entryPath, "utf-8");
  } catch (err) {
    process.stderr.write(`nlpp-compile: cannot read ${file}: ${err}
`);
    return 1;
  }
  const resolver = (path) => readFile(path, "utf-8");
  try {
    const language = await initParser();
    const { output, warnings } = await preprocess(language, entryText, entryPath, resolver);
    for (const w of warnings) {
      process.stderr.write(
        `nlpp-compile: warning: ${w.kind}: "${w.keyword}" at line ${w.range.start.line + 1}
`
      );
    }
    process.stdout.write(output.endsWith("\n") ? output : output + "\n");
    return 0;
  } catch (err) {
    process.stderr.write(`nlpp-compile: ${err.message ?? err}
`);
    return 1;
  }
}
main(process.argv.slice(2)).then((code) => process.exit(code));
//# sourceMappingURL=cli.js.map