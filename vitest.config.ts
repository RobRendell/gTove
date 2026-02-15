import {defineConfig} from 'vitest/config'

export default defineConfig({
    test: {
        root: __dirname,
        include: ['src/**/*.test.tsx', 'src/**/*.test.ts'],
        globals: true,
        environment: 'jsdom'
    },
})