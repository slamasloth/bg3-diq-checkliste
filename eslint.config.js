import js from '@eslint/js'
import globals from 'globals'
import svelte from 'eslint-plugin-svelte'
import ts from 'typescript-eslint'

export default ts.config(
  { ignores: ['dist/', 'dev-dist/', 'node_modules/'] },
  js.configs.recommended,
  ...ts.configs.recommended,
  ...svelte.configs['flat/recommended'],
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  { files: ['**/*.svelte', '**/*.svelte.ts'], languageOptions: { parserOptions: { parser: ts.parser } } },
)
