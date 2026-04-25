import js from '@eslint/js';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import vitest from 'eslint-plugin-vitest';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    {ignores: ['dist', 'node_modules']},
    {
        // Extend the recommended configs
        extends: [
            js.configs.recommended,
            ...tseslint.configs.recommended,
        ],
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
            ecmaVersion: 2020,
            globals: {
                ...vitest.environments.env.globals,
            },
        },
        plugins: {
            'react-hooks': reactHooks,
            'react': react,
            'vitest': vitest,
            'simple-import-sort': simpleImportSort,
        },
        rules: {
            ...react.configs['jsx-runtime'].rules,

            'react-hooks/rules-of-hooks': 'error',
            'react-hooks/exhaustive-deps': 'warn',
            'simple-import-sort/imports': 'error',
            '@typescript-eslint/no-any': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-non-null-asserted-optional-chain': 'off',
            '@typescript-eslint/no-non-null-assertion': 'off',
            '@typescript-eslint/no-unused-vars': ['warn', {'argsIgnorePattern': '^_', 'varsIgnorePattern': '^_', 'caughtErrorsIgnorePattern': '^_'}],
            '@typescript-eslint/no-empty-object-type': 'off',
            '@typescript-eslint/no-unused-expressions': 'off',
            'prefer-const': 'off',
            'no-case-declarations': 'off'
        },
        settings: {
            react: {
                version: 'detect',
            },
        },
    },
    // Specific config for test files
    {
        files: ['**/*.test.{ts,tsx}'],
        rules: {
            ...vitest.configs.recommended.rules,
            'vitest/expect-expect': 'off',
        },
    }
);