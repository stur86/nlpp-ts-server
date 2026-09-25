import { test, expect, beforeAll, afterAll } from 'bun:test'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CLI = new URL('./cli.ts', import.meta.url).pathname
let dir: string

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'nlpp-cli-'))
  mkdirSync(join(dir, 'proj', 'src'), { recursive: true })
  mkdirSync(join(dir, 'proj', 'shared'))
  writeFileSync(join(dir, 'secret.txt'), 'TOP SECRET\n')
  writeFileSync(join(dir, 'proj', 'shared', 'vocab.nlpp'), 'define saga "A long-running process."\n')
  writeFileSync(join(dir, 'proj', 'src', 'entry.nlpp'), 'import "../shared/vocab.nlpp"\nclass Foo {}\n')
  writeFileSync(join(dir, 'proj', 'src', 'leak.nlpp'), 'import "../../secret.txt"\n')
})

afterAll(() => rmSync(dir, { recursive: true, force: true }))

async function run(...args: string[]) {
  const proc = Bun.spawn(['bun', CLI, ...args], { stdout: 'pipe', stderr: 'pipe' })
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  return { stdout, stderr, code }
}

test('--help prints usage to stdout and exits 0', async () => {
  const r = await run('--help')
  expect(r.code).toBe(0)
  expect(r.stdout).toContain('Usage: nlpp-compile')
})

test('no arguments prints usage to stderr and exits 1', async () => {
  const r = await run()
  expect(r.code).toBe(1)
  expect(r.stderr).toContain('Usage: nlpp-compile')
})

test('unknown options are rejected instead of being read as a file', async () => {
  const r = await run('--nopreamble', 'x.nlpp')
  expect(r.code).toBe(1)
  expect(r.stderr).toContain('unknown option --nopreamble')
})

test('refuses imports outside the entry directory by default', async () => {
  const r = await run(join(dir, 'proj', 'src', 'entry.nlpp'))
  expect(r.code).toBe(1)
  expect(r.stderr).toContain('outside the allowed root')
})

test('--root widens the allowed import directory', async () => {
  const r = await run('--no-preamble', '--root', join(dir, 'proj'), join(dir, 'proj', 'src', 'entry.nlpp'))
  expect(r.code).toBe(0)
  expect(r.stdout).toContain('define saga')
})

test('never reads non-.nlpp files into the prompt', async () => {
  const r = await run('--root', dir, join(dir, 'proj', 'src', 'leak.nlpp'))
  expect(r.code).toBe(1)
  expect(r.stdout).not.toContain('TOP SECRET')
  expect(r.stderr).toContain('only .nlpp files')
})
