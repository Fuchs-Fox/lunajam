import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import esbuild from 'esbuild'

const root = dirname(fileURLToPath(import.meta.url))

await esbuild.build({
  entryPoints: [resolve(root, 'server/src/main.ts')],
  outfile: resolve(root, 'server/build/server.mjs'),
  platform: 'node',
  format: 'esm',
  bundle: true,
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
})

console.log('built server/build/server.mjs')
