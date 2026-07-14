import {
  CircularImportError,
  ImportError,
  KEYWORD_NAMES,
  KEYWORD_REGISTRY,
  RESERVED_KEYWORDS,
  collectDefines,
  initParser,
  isInsideNodeOfType,
  nodeAtPosition,
  nodeToRange,
  parse,
  parseIncremental,
  preprocess,
  resolveImports
} from "./chunk-N4YYYNTZ.js";

// src/types.ts
var DiagnosticSeverity = {
  Error: 1,
  Warning: 2,
  Information: 3,
  Hint: 4
};
var CompletionItemKind = {
  Function: 3,
  Variable: 6,
  Class: 7,
  Interface: 8,
  Keyword: 14,
  Constant: 21
};

// src/diagnostics.ts
function getDiagnostics(_language, tree) {
  const diagnostics = [];
  function walk(node) {
    if (node.type === "ERROR") {
      diagnostics.push({
        range: nodeToRange(node),
        message: node.text.length > 0 ? `Syntax error: unexpected "${node.text.slice(0, 20)}"` : "Syntax error",
        severity: DiagnosticSeverity.Error
      });
    } else if (node.isMissing) {
      diagnostics.push({
        range: nodeToRange(node),
        message: `Syntax error: expected "${node.type}"`,
        severity: DiagnosticSeverity.Error
      });
    } else {
      for (const child of node.children) walk(child);
    }
  }
  walk(tree.rootNode);
  return diagnostics;
}

// src/highlights.ts
import { Query } from "web-tree-sitter";

// src/queries.ts
var HIGHLIGHTS_QUERY = `; \u2500\u2500 Comments \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
(line_comment) @comment.line
(block_comment) @comment.block

; \u2500\u2500 Keywords \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
"import" @keyword.import
"define" @keyword
"uses" @keyword

"field" @keyword
"auto" @keyword.type

(function_keyword) @keyword.function
(object_keyword) @keyword.type

(access_modifier) @keyword.modifier
"override" @keyword.modifier

"inherits" @keyword
"implements" @keyword

; \u2500\u2500 Strings \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
(string) @string

; \u2500\u2500 Prose blocks \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
"/?" @string.special
"?/" @string.special
(prose_text) @string.special

; \u2500\u2500 Fill-in markers \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
"???" @string.special
(hint_text) @string.special

; \u2500\u2500 Named definitions \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
(define_statement name: (identifier) @constant)
(object_block name: (identifier) @type.definition)
(function_block name: (identifier) @function)
(field_statement name: (identifier) @variable.member)
(custom_block keyword: (identifier) @keyword
              name: (identifier) @type.definition)

; \u2500\u2500 Type annotations \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
(field_statement type: (type (identifier) @type))
(function_block return_type: (type (identifier) @type))
(param type: (type (identifier) @type))

; \u2500\u2500 Parameters \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
(param name: (identifier) @variable.parameter)

; \u2500\u2500 Uses targets \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
(uses_statement target: (qualified_identifier) @variable)
`;

// src/highlights.ts
function getHighlights(language, tree) {
  const query = new Query(language, HIGHLIGHTS_QUERY);
  const captures = query.captures(tree.rootNode);
  return captures.map((capture) => ({
    startIndex: capture.node.startIndex,
    endIndex: capture.node.endIndex,
    scope: capture.name
  }));
}

// src/folding.ts
function getFolding(tree) {
  const ranges = [];
  function walk(node) {
    const startLine = node.startPosition.row;
    const endLine = node.endPosition.row;
    if (startLine >= endLine) {
      for (const child of node.children) walk(child);
      return;
    }
    if (node.type === "block_comment") {
      ranges.push({ startLine, endLine, kind: "comment" });
    } else if (node.type === "prose_block") {
      ranges.push({ startLine, endLine, kind: "region" });
    } else if (node.type === "body") {
      const hasNonProseChild = node.children.some(
        (c) => c.type !== "prose_block" && c.type !== "{" && c.type !== "}"
      );
      if (hasNonProseChild) {
        ranges.push({ startLine, endLine, kind: "region" });
      }
    }
    for (const child of node.children) walk(child);
  }
  walk(tree.rootNode);
  return ranges;
}

// src/completions.ts
async function getCompletions(language, tree, position, resolveFile) {
  const node = nodeAtPosition(tree, position);
  if (isInsideNodeOfType(node, "prose_block")) return [];
  if (isInsideNodeOfType(node, "ERROR")) return [];
  const items = [];
  for (const [label, detail] of Object.entries(KEYWORD_REGISTRY)) {
    items.push({ label, kind: CompletionItemKind.Keyword, detail });
  }
  const inFileDefines = collectDefines(tree);
  for (const [label, detail] of inFileDefines) {
    items.push({ label, kind: CompletionItemKind.Constant, detail });
  }
  if (resolveFile) {
    const imported = await resolveImports(tree, language, "", resolveFile);
    for (const importedTree of imported.values()) {
      for (const [label, detail] of collectDefines(importedTree)) {
        if (!inFileDefines.has(label)) {
          items.push({ label, kind: CompletionItemKind.Constant, detail });
        }
      }
    }
  }
  return items;
}

// src/hover.ts
function keywordAtNode(node) {
  const KEYWORD_NAMED_PARENT_TYPES = /* @__PURE__ */ new Set([
    "object_keyword",
    "function_keyword",
    "access_modifier"
  ]);
  const KEYWORD_LITERALS = /* @__PURE__ */ new Set([
    "field",
    "uses",
    "import",
    "define",
    "auto",
    "override",
    "inherits",
    "implements"
  ]);
  if (!node.isNamed && node.parent && KEYWORD_NAMED_PARENT_TYPES.has(node.parent.type)) {
    return node.text;
  }
  if (KEYWORD_NAMED_PARENT_TYPES.has(node.type)) return node.text;
  if (!node.isNamed && node.parent?.type === "custom_block" && node === node.parent.childForFieldName("keyword")) {
    return node.text;
  }
  if (KEYWORD_LITERALS.has(node.text) && node.isNamed === false) return node.text;
  return null;
}
async function getHover(language, tree, position, resolveFile) {
  const node = nodeAtPosition(tree, position);
  const range = nodeToRange(node);
  const keyword = keywordAtNode(node);
  if (keyword && KEYWORD_REGISTRY[keyword]) {
    return { range, contents: KEYWORD_REGISTRY[keyword] };
  }
  const inFileDef = collectDefines(tree).get(node.text);
  if (inFileDef) return { range, contents: inFileDef };
  if (resolveFile) {
    const imported = await resolveImports(tree, language, "", resolveFile);
    for (const importedTree of imported.values()) {
      const def = collectDefines(importedTree).get(node.text);
      if (def) return { range, contents: def };
    }
  }
  return null;
}

// src/definition.ts
function findDefineNode(tree, name) {
  for (const node of tree.rootNode.children) {
    if (node && node.type === "define_statement") {
      if (node.childForFieldName("name")?.text === name) return node;
    }
  }
  return null;
}
function findBlockDeclaration(tree, name) {
  function walk(node) {
    for (const type of ["object_block", "function_block", "custom_block"]) {
      if (node.type === type && node.childForFieldName("name")?.text === name) return node;
    }
    for (const child of node.children) {
      const found = walk(child);
      if (found) return found;
    }
    return null;
  }
  return walk(tree.rootNode);
}
function isOnDeclarationName(blockNode, cursorNode) {
  const nameNode = blockNode.childForFieldName("name");
  if (!nameNode) return false;
  return nameNode === cursorNode || nameNode.id === cursorNode.id;
}
function resolveWordNode(node) {
  if (node.type === "uses_statement") {
    const target = node.childForFieldName("target");
    if (target) return target;
  }
  return node;
}
async function getDefinition(language, tree, position, resolveFile) {
  const rawNode = nodeAtPosition(tree, position);
  const node = resolveWordNode(rawNode);
  const word = node.text;
  if (!word || RESERVED_KEYWORDS.has(word)) return null;
  const defineNode = findDefineNode(tree, word);
  if (defineNode) return { uri: "", range: nodeToRange(defineNode) };
  const blockNode = findBlockDeclaration(tree, word);
  if (blockNode && !isOnDeclarationName(blockNode, node)) {
    return { uri: "", range: nodeToRange(blockNode) };
  }
  if (resolveFile) {
    const imported = await resolveImports(tree, language, "", resolveFile);
    for (const [uri, importedTree] of imported) {
      const d = findDefineNode(importedTree, word) ?? findBlockDeclaration(importedTree, word);
      if (d) return { uri, range: nodeToRange(d) };
    }
  }
  return null;
}
export {
  CircularImportError,
  CompletionItemKind,
  DiagnosticSeverity,
  ImportError,
  KEYWORD_NAMES,
  KEYWORD_REGISTRY,
  RESERVED_KEYWORDS,
  getCompletions,
  getDefinition,
  getDiagnostics,
  getFolding,
  getHighlights,
  getHover,
  initParser,
  parse,
  parseIncremental,
  preprocess
};
//# sourceMappingURL=index.js.map