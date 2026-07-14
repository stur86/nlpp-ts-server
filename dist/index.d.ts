import Parser from 'web-tree-sitter';

type Language = Parser.Language;
type Tree = Parser.Tree;
type SyntaxNode = Parser.SyntaxNode;
type FileResolver = (path: string) => Promise<string>;
type Position = {
    line: number;
    character: number;
};
type Range = {
    start: Position;
    end: Position;
};
type Edit = {
    range: Range;
    text: string;
};
type HighlightRange = {
    startIndex: number;
    endIndex: number;
    scope: string;
};
declare const DiagnosticSeverity: {
    readonly Error: 1;
    readonly Warning: 2;
    readonly Information: 3;
    readonly Hint: 4;
};
type DiagnosticSeverity = typeof DiagnosticSeverity[keyof typeof DiagnosticSeverity];
type Diagnostic = {
    range: Range;
    message: string;
    severity: DiagnosticSeverity;
};
declare const CompletionItemKind: {
    readonly Function: 3;
    readonly Variable: 6;
    readonly Class: 7;
    readonly Interface: 8;
    readonly Keyword: 14;
    readonly Constant: 21;
};
type CompletionItemKind = typeof CompletionItemKind[keyof typeof CompletionItemKind];
type CompletionItem = {
    label: string;
    kind: CompletionItemKind;
    detail?: string;
};
type HoverResult = {
    range: Range;
    contents: string;
};
type FoldingRange = {
    startLine: number;
    endLine: number;
    kind: 'region' | 'comment';
};
type Location = {
    uri: string;
    range: Range;
};
type PreprocessWarning = {
    kind: 'unresolved_custom_keyword';
    keyword: string;
    range: Range;
};
type PreprocessResult = {
    output: string;
    warnings: PreprocessWarning[];
};

/**
 * Initialise the web-tree-sitter runtime and load the NL++ WASM grammar.
 *
 * Call once at startup and reuse the returned `Language` for all subsequent
 * operations. The call is idempotent — calling it multiple times is safe but
 * wasteful.
 *
 * @param wasmUrl - Optional override for the WASM file location.
 *   Omit in Node/Bun environments — the path is resolved automatically from
 *   the installed `nlpp-grammar` package.
 *   Pass a URL or path string in browser/bundler contexts where the WASM asset
 *   is served from a known URL.
 * @throws If the WASM file cannot be located or fails to load.
 *
 * @category Core API
 */
declare function initParser(wasmUrl?: string | URL): Promise<Language>;
/**
 * Parse a NL++ document and return a syntax tree.
 *
 * Always returns a tree — never throws, even for completely invalid input.
 * Syntax errors are represented as `ERROR` and `MISSING` nodes in the tree,
 * which {@link getDiagnostics} converts to {@link Diagnostic} objects.
 *
 * @param language - The `Language` object returned by {@link initParser}.
 * @param text - Full document text.
 *
 * @category Core API
 */
declare function parse(language: Language, text: string): Tree;
/**
 * Parse a NL++ document incrementally, reusing unchanged parts of a previous tree.
 *
 * Prefer this over {@link parse} in editor/LSP contexts where the same document
 * is updated repeatedly. Pass the tree returned by the previous `parse` or
 * `parseIncremental` call together with the edit that produced `newText`.
 *
 * For batches of edits (multi-cursor, find-replace), call this function once
 * per edit in sequence, threading `newText`/returned tree into the next call.
 *
 * The `edit` type is structurally compatible with LSP `TextDocumentContentChangeEvent`
 * so LSP change events can be passed directly.
 *
 * @param language - The `Language` object returned by {@link initParser}.
 * @param oldText - Full document text before the edit.
 * @param newText - Full document text after the edit.
 * @param oldTree - The syntax tree for `oldText`.
 * @param edit - The content change that transforms `oldText` into `newText`.
 *
 * @category Core API
 */
declare function parseIncremental(language: Language, oldText: string, newText: string, oldTree: Tree, edit: Edit): Tree;

/**
 * Walk a syntax tree and return all parse errors as {@link Diagnostic} objects.
 *
 * Reports `ERROR` nodes (unexpected tokens) and `MISSING` nodes (expected
 * tokens that were absent) at {@link DiagnosticSeverity.Error} severity.
 * Returns an empty array for a clean parse.
 *
 * @param _language - The `Language` object (reserved for future query-based diagnostics).
 * @param tree - The syntax tree returned by {@link parse}.
 *
 * @category Core API
 */
declare function getDiagnostics(_language: Language, tree: Tree): Diagnostic[];

/**
 * Run the NL++ highlights query against a syntax tree and return token ranges.
 *
 * Each {@link HighlightRange} carries a `scope` name drawn from the
 * `highlights.scm` TextMate grammar (e.g. `"keyword.type"`, `"comment.line"`,
 * `"variable.member"`). Results are in document order.
 *
 * @param language - The `Language` object returned by {@link initParser}.
 * @param tree - The syntax tree returned by {@link parse}.
 *
 * @category Core API
 */
declare function getHighlights(language: Language, tree: Tree): HighlightRange[];

/**
 * Return all foldable regions in a syntax tree.
 *
 * Covers three kinds of foldable construct:
 * - **`region`** — multi-line block bodies and prose blocks (`/? … ?/`)
 * - **`comment`** — multi-line block comments
 *
 * Single-line constructs are never returned.
 *
 * @param tree - The syntax tree returned by {@link parse}.
 *
 * @category Core API
 */
declare function getFolding(tree: Tree): FoldingRange[];

/**
 * Return completion items appropriate for the cursor position.
 *
 * Always includes all built-in NL++ keywords (from the keyword registry) and
 * any `define`d terms visible in the current file. Pass `resolveFile` to also
 * surface terms defined in imported files.
 *
 * Returns an empty array when the cursor is inside a prose block (`/? … ?/`)
 * or an `ERROR` node.
 *
 * @param language - The `Language` object returned by {@link initParser}.
 * @param tree - The syntax tree returned by {@link parse}.
 * @param position - Zero-based `{ line, character }` cursor position.
 * @param resolveFile - Optional async callback that resolves an absolute file
 *   path to its text content. Required for cross-file define completions.
 *
 * @category Core API
 */
declare function getCompletions(language: Language, tree: Tree, position: Position, resolveFile?: FileResolver): Promise<CompletionItem[]>;

/**
 * Return the hover documentation for the symbol at the cursor position.
 *
 * Resolves in order: built-in keyword definition → in-file `define` term →
 * cross-file `define` term (requires `resolveFile`). Returns `null` if the
 * cursor is not over a known keyword or defined term.
 *
 * @param language - The `Language` object returned by {@link initParser}.
 * @param tree - The syntax tree returned by {@link parse}.
 * @param position - Zero-based `{ line, character }` cursor position.
 * @param resolveFile - Optional async callback that resolves an absolute file
 *   path to its text content. Required for hover on cross-file defined terms.
 *
 * @category Core API
 */
declare function getHover(language: Language, tree: Tree, position: Position, resolveFile?: FileResolver): Promise<HoverResult | null>;

/**
 * Resolve the definition site of the symbol at the cursor position.
 *
 * Searches in order: in-file `define` statements → in-file block declarations
 * → cross-file definitions (requires `resolveFile`). Returns `null` if the
 * cursor is on a built-in keyword, a declaration name itself, or an unknown
 * symbol.
 *
 * The returned {@link Location} uses an empty string `uri` for in-file
 * definitions and the resolved file path for cross-file definitions.
 *
 * @param language - The `Language` object returned by {@link initParser}.
 * @param tree - The syntax tree returned by {@link parse}.
 * @param position - Zero-based `{ line, character }` cursor position.
 * @param resolveFile - Optional async callback that resolves an absolute file
 *   path to its text content. Required for cross-file go-to-definition.
 *
 * @category Core API
 */
declare function getDefinition(language: Language, tree: Tree, position: Position, resolveFile?: FileResolver): Promise<Location | null>;

/** Thrown by {@link preprocess} when an imported file cannot be resolved. */
declare class ImportError extends Error {
    readonly importPath: string;
    constructor(importPath: string, cause: unknown);
}
/**
 * Thrown by {@link preprocess} when a cycle is detected in the import graph.
 * @internal
 */
declare class CircularImportError extends Error {
    readonly importPath: string;
    readonly importStack: string[];
    constructor(importPath: string, importStack: string[]);
}
/**
 * Produce a single prompt-ready string from an entry NL++ file.
 *
 * Processing steps:
 * 1. Resolves `import` statements recursively via `resolveFile`, deduplicating on path.
 * 2. Strips `//` line comments and block comments.
 * 3. Retains prose blocks (`/? … ?/`) and fill-in markers (`???`) verbatim.
 * 4. Appends a `KEYWORD GLOSSARY` section listing every built-in keyword and
 *    `define`d term that appears in the output, with their definitions.
 *
 * Unresolved custom block keywords (used but not `define`d) are reported as
 * {@link PreprocessWarning} objects in the result rather than throwing.
 *
 * @param language - The `Language` object returned by {@link initParser}.
 *   Required to parse imported files internally.
 * @param entryText - The text content of the entry file.
 * @param entryPath - The absolute path of the entry file, used to resolve
 *   relative `import` paths.
 * @param resolveFile - Async callback that receives an absolute path and
 *   returns the file's text content.
 * @throws {@link ImportError} if a file cannot be resolved.
 * @throws `CircularImportError` if a cycle is detected in the import graph.
 *
 * @category Core API
 */
declare function preprocess(language: Language, entryText: string, entryPath: string, resolveFile: FileResolver): Promise<PreprocessResult>;

/** Map of every built-in NL++ keyword to its definition string. */
declare const KEYWORD_REGISTRY: Record<string, string>;
/** @internal */
declare const KEYWORD_NAMES: Set<string>;
/** @internal */
declare const RESERVED_KEYWORDS: Set<string>;

export { CircularImportError, type CompletionItem, CompletionItemKind, type Diagnostic, DiagnosticSeverity, type Edit, type FileResolver, type FoldingRange, type HighlightRange, type HoverResult, ImportError, KEYWORD_NAMES, KEYWORD_REGISTRY, type Language, type Location, type Position, type PreprocessResult, type PreprocessWarning, RESERVED_KEYWORDS, type Range, type SyntaxNode, type Tree, getCompletions, getDefinition, getDiagnostics, getFolding, getHighlights, getHover, initParser, parse, parseIncremental, preprocess };
