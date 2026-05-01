export const HIGHLIGHTS_QUERY = `
; ── Comments ──────────────────────────────────────────────────────────────────
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
"/?" @punctuation.special
"?/" @punctuation.special
(prose_text) @string.special

; ── Fill-in markers ───────────────────────────────────────────────────────────
"???" @punctuation.special
(hint_text) @comment.line

; ── Named definitions ─────────────────────────────────────────────────────────
(define_statement name: (identifier) @constant)
(object_block name: (identifier) @type.definition)
(function_block name: (identifier) @function)
(field_statement name: (identifier) @variable.member)
(custom_block keyword: (identifier) @keyword
              name: (identifier) @type.definition)

; ── Type annotations ──────────────────────────────────────────────────────────
(field_statement type: (type (identifier) @type))
(function_block return_type: (type (identifier) @type))
(param type: (type (identifier) @type))

; ── Parameters ────────────────────────────────────────────────────────────────
(param name: (identifier) @variable.parameter)

; ── Uses targets ──────────────────────────────────────────────────────────────
(uses_statement target: (qualified_identifier) @variable)
`
