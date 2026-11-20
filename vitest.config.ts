import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const root = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@luna/core': resolve(root, 'test/helpers/lunaMock.ts'),
      '@luna/lib': resolve(root, 'test/helpers/lunaMock.ts'),
      '@luna/ui': resolve(root, 'test/helpers/lunaMock.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
  },
})
