// Shared ESLint 10 flat config for the whole workspace (tech doc §2.1, §2.4).
// Each package runs `eslint .` from its own directory; ESLint finds this file by walking up.
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import pluginQuery from '@tanstack/eslint-plugin-query';
import featureSliced from '@conarti/eslint-plugin-feature-sliced';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const FSD_EXEMPT = ['**/*.test.*', '**/src/test/**'];

export default defineConfig([
  globalIgnores([
    '**/node_modules/',
    '**/dist/',
    'docs/',
    'apps/web/e2e/test-results/',
    'apps/web/e2e/playwright-report/',
    'context/',
    '.claude/',
    '.awos/',
    'bin/',
  ]),

  js.configs.recommended,

  // TypeScript everywhere: type-aware rules, each file resolved to its nearest tsconfig.
  {
    files: ['**/*.{ts,tsx}'],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
    },
  },

  // Plain JS/MJS (this file, apps/api/scripts/*.mjs): no type information, Node globals.
  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
  },

  // apps/api: an `import type` of an injected class turns Nest's DI metadata into `Object`,
  // so the rule that would autofix imports to `import type` stays OFF here.
  {
    files: ['apps/api/**/*.ts'],
    rules: {
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },

  // apps/web: React 19 + FSD boundaries.
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    extends: [
      reactHooks.configs.flat.recommended,
      jsxA11y.flatConfigs.recommended,
      reactRefresh.configs.vite,
      pluginQuery.configs['flat/recommended'],
    ],
    languageOptions: { globals: globals.browser },
    rules: {
      // jsx-a11y's allowlist for <table> is ['grid'], but WAI-ARIA also permits `treegrid`
      // (APG: Treegrid pattern) — spec 002's Monthly Detail Table is one. The plugin's list is
      // incomplete, not the markup: https://www.w3.org/WAI/ARIA/apg/patterns/treegrid/
      'jsx-a11y/no-noninteractive-element-to-interactive-role': [
        'error',
        {
          table: ['grid', 'treegrid'],
          ul: ['listbox', 'menu', 'menubar', 'radiogroup', 'tablist', 'tree', 'treegrid'],
          ol: ['listbox', 'menu', 'menubar', 'radiogroup', 'tablist', 'tree', 'treegrid'],
          li: ['menuitem', 'option', 'row', 'tab', 'treeitem'],
          td: ['gridcell'],
        },
      ],
    },
  },
  {
    // Tests sit next to their subject and may reach across layers; `ignoreFiles` is matched
    // against absolute paths, hence the leading `**/`.
    ...featureSliced({
      layersSlices: { ignoreFiles: FSD_EXEMPT },
      absoluteRelative: { ignoreFiles: FSD_EXEMPT },
      publicApi: { ignoreFiles: FSD_EXEMPT },
      noCrossSegmentReexport: { ignoreFiles: FSD_EXEMPT },
    }),
    files: ['apps/web/src/**/*.{ts,tsx}'],
  },
  {
    files: ['apps/web/e2e/**/*.ts', 'apps/web/vite.config.ts'],
    languageOptions: { globals: globals.node },
  },

  // Prettier last: turns off every formatting rule the plugins above enable.
  prettier,
]);
