import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

import react from '@vitejs/plugin-react-swc';
import visualizer from 'rollup-plugin-visualizer';
import {defineConfig, loadEnv, Plugin} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';
import tsconfigPaths from 'vite-tsconfig-paths';

// https://vitejs.dev/config/
export default defineConfig((_config) => ({
    base: '/gtove/',
    plugins: [
        react(),
        tsconfigPaths(),
        devServerPlugin(),
        importPrefixPlugin(),
        VitePWA({
            filename: 'service-worker.js', // Match exactly what CRA used
            registerType: 'prompt',
            injectRegister: 'auto',
            manifest: false,
            workbox: {
                cleanupOutdatedCaches: true,
                globPatterns: ['**/*.{js,css,html,ico,png}'],
                globIgnores: ['**/assets/Tower-*.png'],
                maximumFileSizeToCacheInBytes: 2097152, // 2 MB
                navigateFallback: '/gtove/index.html',
            }
        }),
        visualizer({
            open: false,
            filename: 'bundle-stats.html',
            gzipSize: true
        })
    ],
    build: {
        outDir: 'build',
        sourcemap: 'hidden',
        rollupOptions: {
            output: {
                manualChunks: (id) => {
                    if (id.includes('node_modules')) {
                        if (id.includes('pdfjs-dist')) return 'pdf-vendor';
                        if (id.includes('firebase')) return 'firebase-vendor';
                        if (id.includes('cannon')) return 'cannon-vendor';
                        if (id.includes('three')) return 'three-vendor';
                        if (id.includes('react-rte')) return 'rte-vendor';
                        if (id.includes('lodash')) return 'lodash-vendor';
                        return 'vendor'; // everything else in node_modules
                    }
                    return undefined;
                }
            }
        }
    }
}));

// Setup HOST, SSL, PORT
// Migration guide: Follow the guides below
// https://vitejs.dev/config/server-options.html#server-host
// https://vitejs.dev/config/server-options.html#server-https
// https://vitejs.dev/config/server-options.html#server-port
function devServerPlugin(): Plugin {
    return {
        name: 'dev-server-plugin',
        config(_, {mode}) {
            const {HOST, PORT, HTTPS, SSL_CRT_FILE, SSL_KEY_FILE} = loadEnv(
                mode,
                '.',
                ['HOST', 'PORT', 'HTTPS', 'SSL_CRT_FILE', 'SSL_KEY_FILE'],
            );
            const https = HTTPS === 'true';
            return {
                server: {
                    host: HOST || '0.0.0.0',
                    port: parseInt(PORT || '3000', 10),
                    open: true,
                    ...(https &&
                        SSL_CRT_FILE &&
                        SSL_KEY_FILE && {
                            https: {
                                cert: readFileSync(resolve(SSL_CRT_FILE)),
                                key: readFileSync(resolve(SSL_KEY_FILE)),
                            },
                        }),
                },
            };
        },
    };
}

// To resolve modules from node_modules, you can prefix paths with ~
// https://create-react-app.dev/docs/adding-a-sass-stylesheet
// Migration guide: Follow the guide below
// https://vitejs.dev/config/shared-options.html#resolve-alias
function importPrefixPlugin(): Plugin {
    return {
        name: 'import-prefix-plugin',
        config() {
            return {
                resolve: {
                    alias: [{find: /^~([^/])/, replacement: '$1'}],
                },
            };
        },
    };
}