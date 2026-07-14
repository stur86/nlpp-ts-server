// AUTO-GENERATED from nlpp-grammar/queries/highlights.scm — do not edit by hand
export const HIGHLIGHTS_QUERY = `; ── Comments ──────────────────────────────────────────────────────────────────
(line_comment) @comment.line
(block_comment) @comment.block

; ── Keywords ──────────────────────────────────────────────────────────────────
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

; ── Strings ───────────────────────────────────────────────────────────────────
(string) @string

; ── Prose blocks ──────────────────────────────────────────────────────────────
"/?" @string.special
"?/" @string.special
(prose_text) @string.special

; ── Fill-in markers ───────────────────────────────────────────────────────────
"???" @string.special
(hint_text) @string.special

; ── Named definitions ─────────────────────────────────────────────────────────
(define_statement name: (identifier) @constant)
(object_block name: (identifier) @type.definition)
(function_block name: (identifier) @function)
(field_statement name: (identifier) @variable.member)
(custom_block keyword: (identifier) @keyword
              name: (identifier) @type.definition)

; ── Type annotations ──────────────────────────────────────────────────────────
; A \`type\` node appears in field/return/param positions and, recursively, inside
; template arguments — so one query highlights base type identifiers at any depth.
(type (identifier) @type)
(type "&" @operator)
(type_arguments ["[" "]"] @punctuation.bracket)
(type_arguments "," @punctuation.delimiter)
(number) @number

; ── Parameters ────────────────────────────────────────────────────────────────
(param name: (identifier) @variable.parameter)

; ── Uses targets ──────────────────────────────────────────────────────────────
(uses_statement target: (qualified_identifier) @variable)
`
