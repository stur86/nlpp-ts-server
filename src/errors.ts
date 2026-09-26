/** Thrown by {@link preprocess} when an imported file cannot be resolved or is not allowed. */
export class ImportError extends Error {
  constructor(public readonly importPath: string, cause: unknown) {
    super(`Cannot resolve import "${importPath}": ${cause}`)
    this.name = 'ImportError'
  }
}

/**
 * Thrown by {@link preprocess} when a cycle is detected in the import graph.
 * @internal
 */
export class CircularImportError extends Error {
  constructor(public readonly importPath: string, public readonly importStack: string[]) {
    super(`Circular import detected: ${[...importStack, importPath].join(' → ')}`)
    this.name = 'CircularImportError'
  }
}
