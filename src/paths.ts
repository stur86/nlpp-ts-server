/**
 * Minimal, platform-independent path handling for import resolution.
 *
 * Deliberately avoids `node:path` so the library keeps working in browser and
 * bundled (vsix) contexts. Paths are treated as POSIX-style: backslashes are
 * converted to `/`, and a leading `/` or Windows drive (`C:`) marks a path as
 * absolute.
 */

const DRIVE = /^[A-Za-z]:(?=\/|$)/

function splitRoot(path: string): [root: string, rest: string] {
  const p = path.replace(/\\/g, '/')
  const drive = p.match(DRIVE)?.[0]
  if (drive) return [drive + '/', p.slice(drive.length).replace(/^\/+/, '')]
  if (p.startsWith('/')) return ['/', p.replace(/^\/+/, '')]
  return ['', p]
}

/** True if `path` is absolute (POSIX root or Windows drive). */
export function isAbsolutePath(path: string): boolean {
  return splitRoot(path)[0] !== ''
}

/**
 * Normalise a path: unify separators, collapse `.` and `..` segments and
 * repeated slashes. `..` never climbs above the root of an absolute path.
 */
export function normalizePath(path: string): string {
  const [root, rest] = splitRoot(path)
  const out: string[] = []
  for (const seg of rest.split('/')) {
    if (seg === '' || seg === '.') continue
    if (seg === '..') {
      if (out.length > 0 && out.at(-1) !== '..') out.pop()
      else if (!root) out.push('..')
      continue
    }
    out.push(seg)
  }
  const joined = out.join('/')
  return root ? root + joined : joined || '.'
}

/** Directory part of a normalised path (`/a/b.nlpp` → `/a`). */
export function dirnamePath(path: string): string {
  const p = normalizePath(path)
  const [root, rest] = splitRoot(p)
  const i = rest.lastIndexOf('/')
  if (i === -1) return root || '.'
  return root + rest.slice(0, i)
}

/** Resolve `target` against the directory `baseDir`, unless it is already absolute. */
export function resolvePath(baseDir: string, target: string): string {
  if (isAbsolutePath(target)) return normalizePath(target)
  return normalizePath(`${baseDir}/${target}`)
}

/** True if normalised `path` is `root` itself or lies below it. */
export function isWithinRoot(path: string, root: string): boolean {
  const p = normalizePath(path)
  const r = normalizePath(root)
  if (p === r) return true
  // Relative root '.': anything relative that does not climb out of it.
  if (r === '.') return !isAbsolutePath(p) && p !== '..' && !p.startsWith('../')
  if (isAbsolutePath(p) !== isAbsolutePath(r)) return false
  return p.startsWith(r.endsWith('/') ? r : r + '/')
}
