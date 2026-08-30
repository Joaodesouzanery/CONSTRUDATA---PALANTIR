import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', '.vercel', '.vercel/**', '.claude', '.claude/**']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      /**
       * Seletor de zustand que devolve OBJETO precisa de `useShallow`.
       *
       * ⚠️ Sem ele o seletor cria um objeto novo a cada chamada e, no zustand 5 + React 19, isso é
       * re-render infinito. O sintoma não é erro de compilação: é o módulo INTEIRO caindo no
       * ErrorBoundary da rota — foi assim que o Fluxo de Caixa Projetado derrubou o Controle de
       * Caixa junto, que não tinha defeito nenhum.
       *
       * O padrão certo já é o dominante no repositório (93 usos contra os 2 que escaparam), então
       * a regra não pede refatoração: ela só impede a reincidência.
       */
      'no-restricted-syntax': ['error', {
        selector:
          "CallExpression[callee.name=/^use[A-Z]\\w*Store$/]" +
          " > ArrowFunctionExpression.arguments"                +
          " > ObjectExpression.body",
        message:
          'Seletor de store que devolve objeto precisa de useShallow: ' +
          'useXStore(useShallow((s) => ({ ... }))). Sem ele o objeto é novo a cada render e o ' +
          'componente entra em re-render infinito (zustand 5 + React 19).',
      }],
    },
  },
])
