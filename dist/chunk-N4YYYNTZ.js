// src/parser.ts
import { Parser, Language as WtsLanguage } from "web-tree-sitter";
function charOffsetAt(text, position) {
  let offset = 0;
  for (let i = 0; i < position.line; i++) {
    const nl = text.indexOf("\n", offset);
    if (nl === -1) return text.length;
    offset = nl + 1;
  }
  return offset + position.character;
}
function computeNewEndPosition(startPosition, newText) {
  const lines = newText.split("\n");
  if (lines.length === 1) {
    return { line: startPosition.line, character: startPosition.character + newText.length };
  }
  const lastLine = lines.at(-1) ?? "";
  return { line: startPosition.line + lines.length - 1, character: lastLine.length };
}
async function initParser(wasmUrl) {
  await Parser.init();
  let path;
  if (wasmUrl !== void 0) {
    path = wasmUrl instanceof URL ? wasmUrl.pathname : wasmUrl;
  } else {
    path = new URL(import.meta.resolve("nlpp-grammar/wasm")).pathname;
  }
  return await WtsLanguage.load(path);
}
function parse(language, text) {
  const parser = new Parser();
  parser.setLanguage(language);
  return parser.parse(text);
}
function parseIncremental(language, oldText, newText, oldTree, edit) {
  const tree = oldTree.copy();
  const startIndex = charOffsetAt(oldText, edit.range.start);
  const oldEndIndex = charOffsetAt(oldText, edit.range.end);
  const newEndIndex = startIndex + edit.text.length;
  const newEndPosition = computeNewEndPosition(edit.range.start, edit.text);
  tree.edit({
    startIndex,
    oldEndIndex,
    newEndIndex,
    startPosition: { row: edit.range.start.line, column: edit.range.start.character },
    oldEndPosition: { row: edit.range.end.line, column: edit.range.end.character },
    newEndPosition: { row: newEndPosition.line, column: newEndPosition.character }
  });
  const parser = new Parser();
  parser.setLanguage(language);
  return parser.parse(newText, tree);
}

// src/keywords.ts
import { readFileSync } from "fs";
import { join } from "path";
import { load as parseYaml } from "js-yaml";
var raw = readFileSync(join(import.meta.dirname, "../data/keywords.yaml"), "utf8");
var KEYWORD_REGISTRY = parseYaml(raw);
var KEYWORD_NAMES = new Set(Object.keys(KEYWORD_REGISTRY));
var RESERVED_KEYWORDS = /* @__PURE__ */ new Set([
  "import",
  "define",
  "uses",
  "field",
  "public",
  "private",
  "override",
  "function",
  "method",
  "getter",
  "setter",
  "layer",
  "module",
  "service",
  "component",
  "class",
  "interface",
  "enum",
  "type",
  "inherits",
  "implements",
  "auto"
]);

// src/utils.ts
function nodeToRange(node) {
  return {
    start: { line: node.startPosition.row, character: node.startPosition.column },
    end: { line: node.endPosition.row, character: node.endPosition.column }
  };
}
function nodeAtPosition(tree, position) {
  return tree.rootNode.descendantForPosition({
    row: position.line,
    column: position.character
  });
}
function isInsideNodeOfType(node, type) {
  let current = node;
  while (current) {
    if (current.type === type) return true;
    current = current.parent;
  }
  return false;
}
function collectDefines(tree) {
  const defines = /* @__PURE__ */ new Map();
  function walk(node) {
    if (node.type === "define_statement") {
      const name = node.childForFieldName("name")?.text ?? "";
      const body = node.childForFieldName("definition")?.text?.replace(/^"|"$/g, "") ?? "";
      if (name) defines.set(name, body);
    }
    for (const child of node.children) walk(child);
  }
  walk(tree.rootNode);
  return defines;
}
function extractImportPath(importNode, currentFilePath) {
  const raw2 = importNode.childForFieldName("path")?.text ?? "";
  const relative = raw2.replace(/^"|"$/g, "");
  const dir = currentFilePath.replace(/\/[^/]+$/, "");
  return `${dir}/${relative}`.replace(/\/\.\//g, "/");
}
async function resolveImports(tree, language, currentPath, resolveFile, visited = /* @__PURE__ */ new Set()) {
  const result = /* @__PURE__ */ new Map();
  for (const node of tree.rootNode.children) {
    if (!node) continue;
    if (node.type !== "import_statement") continue;
    const importedPath = extractImportPath(node, currentPath);
    if (visited.has(importedPath)) continue;
    visited.add(importedPath);
    try {
      const text = await resolveFile(importedPath);
      const importedTree = parse(language, text);
      result.set(importedPath, importedTree);
      const nested = await resolveImports(importedTree, language, importedPath, resolveFile, visited);
      for (const [k, v] of nested) result.set(k, v);
    } catch {
    }
  }
  return result;
}

// src/preprocess.ts
function serializeStrippingComments(node, originalText) {
  if (node.type === "line_comment" || node.type === "block_comment") return "";
  if (node.childCount === 0) {
    return originalText.slice(node.startIndex, node.endIndex);
  }
  let result = "";
  let cursor = node.startIndex;
  for (const child of node.children) {
    if (child.type === "line_comment" || child.type === "block_comment") {
      cursor = child.endIndex;
      continue;
    }
    result += originalText.slice(cursor, child.startIndex);
    result += serializeStrippingComments(child, originalText);
    cursor = child.endIndex;
  }
  result += originalText.slice(cursor, node.endIndex);
  return result;
}
var ImportError = class extends Error {
  constructor(importPath, cause) {
    super(`Cannot resolve import "${importPath}": ${cause}`);
    this.importPath = importPath;
    this.name = "ImportError";
  }
  importPath;
};
var CircularImportError = class extends Error {
  constructor(importPath, importStack) {
    super(`Circular import detected: ${[...importStack, importPath].join(" \u2192 ")}`);
    this.importPath = importPath;
    this.importStack = importStack;
    this.name = "CircularImportError";
  }
  importPath;
  importStack;
};
function collectUsedBuiltins(node, out) {
  if (node.type === "object_keyword") out.add(node.text);
  else if (node.type === "function_keyword") out.add(node.text);
  else if (node.type === "access_modifier") out.add(node.text);
  else if (node.type === "import_statement") out.add("import");
  else if (node.type === "define_statement") out.add("define");
  else if (node.type === "uses_statement") out.add("uses");
  else if (node.type === "field_statement") out.add("field");
  if (node.text === "override") out.add("override");
  if (node.text === "inherits") out.add("inherits");
  if (node.text === "implements") out.add("implements");
  if (node.type === "type" && node.text === "auto") out.add("auto");
  for (const child of node.children) collectUsedBuiltins(child, out);
}
async function preprocess(language, entryText, entryPath, resolveFile) {
  const visited = /* @__PURE__ */ new Set();
  const warnings = [];
  const definedTerms = /* @__PURE__ */ new Map();
  const usedBuiltins = /* @__PURE__ */ new Set();
  const usedDefinedTerms = /* @__PURE__ */ new Set();
  async function processFile(text, path, callStack) {
    if (callStack.includes(path)) throw new CircularImportError(path, callStack);
    if (visited.has(path)) return "";
    visited.add(path);
    const tree = parse(language, text);
    collectUsedBuiltins(tree.rootNode, usedBuiltins);
    let output = "";
    for (const node of tree.rootNode.children) {
      if (!node) {
        continue;
      }
      if (node.type === "line_comment" || node.type === "block_comment") {
        continue;
      }
      if (node.type === "import_statement") {
        const importedPath = extractImportPath(node, path);
        let importedText;
        try {
          importedText = await resolveFile(importedPath);
        } catch (err) {
          throw new ImportError(importedPath, err);
        }
        output += await processFile(importedText, importedPath, [...callStack, path]);
        continue;
      }
      if (node.type === "define_statement") {
        const name = node.namedChildren[0]?.text ?? "";
        const defBody = node.namedChildren[1]?.text ?? "";
        const body = defBody.replace(/^\s*"|"\s*$/g, "").trim();
        if (name) definedTerms.set(name, body);
      }
      if (node.type === "custom_block") {
        const keyword = node.children[0]?.text ?? "";
        if (keyword) {
          usedDefinedTerms.add(keyword);
          if (!definedTerms.has(keyword)) {
            warnings.push({
              kind: "unresolved_custom_keyword",
              keyword,
              range: nodeToRange(node)
            });
          }
        }
      }
      output += serializeStrippingComments(node, text) + "\n";
    }
    return output;
  }
  const content = await processFile(entryText, entryPath, []);
  const glossaryLines = [];
  for (const kw of usedBuiltins) {
    if (kw === "import") continue;
    const def = KEYWORD_REGISTRY[kw];
    if (def) glossaryLines.push(`${kw}: ${def}`);
  }
  for (const term of usedDefinedTerms) {
    const def = definedTerms.get(term);
    if (def) glossaryLines.push(`${term}: ${def}`);
  }
  const glossary = glossaryLines.length > 0 ? [
    "",
    "---",
    "KEYWORD GLOSSARY",
    "The following terms appear in the pseudocode above. Treat them as architectural intent.",
    "",
    ...glossaryLines
  ].join("\n") : "";
  return { output: content + glossary, warnings };
}

export {
  initParser,
  parse,
  parseIncremental,
  nodeToRange,
  nodeAtPosition,
  isInsideNodeOfType,
  collectDefines,
  resolveImports,
  KEYWORD_REGISTRY,
  KEYWORD_NAMES,
  RESERVED_KEYWORDS,
  ImportError,
  CircularImportError,
  preprocess
};
//# sourceMappingURL=chunk-N4YYYNTZ.js.map