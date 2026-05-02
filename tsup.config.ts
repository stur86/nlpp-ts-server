import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['index.ts'],
  format: ['esm'],
  dts: true,
  target: 'node18',
  platform: 'node',
  external: ['web-tree-sitter', 'nlpp-grammar', 'js-yaml'],
  clean: true,
  sourcemap: true,
  tsconfig: 'tsconfig.build.json',
})
