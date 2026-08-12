import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import i18next from 'eslint-plugin-i18next';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    // Register the i18next plugin everywhere (rule off by default) so that
    // `eslint-disable i18next/no-literal-string` directives always resolve —
    // even when ESLint runs on a subset of files (e.g. via lint-staged).
    plugins: { i18next },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      'i18next/no-literal-string': 'off',
    },
  },
  {
    // Vendored shadcn/ui primitives (`npx shadcn add …`). These are upstream
    // files we re-pull rather than hand-author, so the rules that assume our
    // own authoring conventions are relaxed here — keeping the directory
    // diff-clean against upstream. Anything we write ourselves lives outside
    // this path and is still fully linted.
    files: ['src/components/shadcn/**/*.{ts,tsx}'],
    rules: {
      // Upstream co-locates cva variant objects with the component.
      'react-refresh/only-export-components': 'off',
      // Upstream ships English a11y labels ("Close", "Previous"); those get
      // translated at the call site or by wrapping the primitive, not by
      // editing the vendored file.
      'i18next/no-literal-string': 'off',
    },
  },
  {
    // Guard against new hardcoded user-facing strings: flag literal JSX text so
    // every visible string goes through t()/<Trans>. The i18n setup itself and
    // tests are exempt.
    files: ['src/**/*.tsx'],
    ignores: ['src/i18n/**', '**/*.test.tsx', 'src/components/shadcn/**'],
    rules: {
      'i18next/no-literal-string': [
        'error',
        {
          mode: 'jsx-text-only',
          'jsx-components': { exclude: ['Trans'] },
          words: {
            exclude: [
              // anything with no Latin letters: numbers, punctuation, symbols,
              // decorative glyphs and emoji (✓ ✕ ▾ • — 📅 ⏺ 👤 🔎 ∨ ⚠ ↑ ↓ …)
              '^[^A-Za-z]+$',
              // product / provider proper nouns
              '^(Devlane|GitHub|GitLab|Google|OpenAI|Unsplash|GitHub App)$',
              // short format/unit/acronym labels and code tokens that stay verbatim
              '^(B|I|U|K|KB|CSV|JSON|TLS|SSL|\\.pem|INSTANCE_ENCRYPTION_KEY)$',
              // GitHub App permission/event labels shown verbatim to mirror GitHub
              '^(Contents: Read|Issues: R/W|Pull requests: R/W|Metadata: Read|Pull request|Push|Issue comment|Installation|Installation repositories)$',
            ],
          },
        },
      ],
    },
  },
]);
