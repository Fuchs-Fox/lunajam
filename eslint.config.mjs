import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist/', 'server/build/', 'reference/', 'node_modules/', 'patches/', '.zcode/', '.orion/', 'graphify-out/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ['*.mjs'], languageOptions: { globals: { console: 'readonly' } } },
)
