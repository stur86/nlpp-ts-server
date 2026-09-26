import { test, expect } from 'bun:test'
import { normalizePath, dirnamePath, resolvePath, isWithinRoot, isAbsolutePath } from './paths.ts'

test('normalizePath collapses . and .. segments and duplicate slashes', () => {
  expect(normalizePath('/a/./b//c/../d.nlpp')).toBe('/a/b/d.nlpp')
  expect(normalizePath('/a/sub/../sub/../sub/b.nlpp')).toBe('/a/sub/b.nlpp')
})

test('normalizePath never climbs above an absolute root', () => {
  expect(normalizePath('/a/../../../etc/passwd')).toBe('/etc/passwd')
  expect(normalizePath('C:\\x\\..\\..\\y')).toBe('C:/y')
})

test('normalizePath keeps leading .. on relative paths', () => {
  expect(normalizePath('../a/./b')).toBe('../a/b')
  expect(normalizePath('')).toBe('.')
})

test('normalizePath converts Windows separators', () => {
  expect(normalizePath('C:\\proj\\src\\entry.nlpp')).toBe('C:/proj/src/entry.nlpp')
})

test('isAbsolutePath recognises POSIX and drive-letter paths', () => {
  expect(isAbsolutePath('/a')).toBe(true)
  expect(isAbsolutePath('C:\\a')).toBe(true)
  expect(isAbsolutePath('a/b')).toBe(false)
})

test('dirnamePath', () => {
  expect(dirnamePath('/a/b.nlpp')).toBe('/a')
  expect(dirnamePath('/b.nlpp')).toBe('/')
  expect(dirnamePath('C:\\x\\e.nlpp')).toBe('C:/x')
  expect(dirnamePath('e.nlpp')).toBe('.')
})

test('resolvePath joins relative targets and keeps absolute ones', () => {
  expect(resolvePath('/proj/src', '../lib/x.nlpp')).toBe('/proj/lib/x.nlpp')
  expect(resolvePath('/proj/src', '/etc/x.nlpp')).toBe('/etc/x.nlpp')
  expect(resolvePath('C:/proj', 'x.nlpp')).toBe('C:/proj/x.nlpp')
})

test('isWithinRoot', () => {
  expect(isWithinRoot('/proj/a.nlpp', '/proj')).toBe(true)
  expect(isWithinRoot('/proj/sub/a.nlpp', '/proj/')).toBe(true)
  expect(isWithinRoot('/proj', '/proj')).toBe(true)
  expect(isWithinRoot('/project2/a.nlpp', '/proj')).toBe(false)
  expect(isWithinRoot('/proj/../etc/a.nlpp', '/proj')).toBe(false)
  expect(isWithinRoot('/anything.nlpp', '/')).toBe(true)
})

test('isWithinRoot with relative paths', () => {
  expect(isWithinRoot('lib/a.nlpp', '.')).toBe(true)
  expect(isWithinRoot('../a.nlpp', '.')).toBe(false)
  expect(isWithinRoot('/a.nlpp', '.')).toBe(false)
  expect(isWithinRoot('src/a.nlpp', 'src')).toBe(true)
  expect(isWithinRoot('/src/a.nlpp', 'src')).toBe(false)
})
