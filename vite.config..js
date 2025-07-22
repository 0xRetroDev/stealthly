import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import { viteStaticCopy } from 'vite-plugin-static-copy';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      protocolImports: true,
    }),
            viteStaticCopy({
            targets: [
                {
                    // Copy encrypt.wasm from the t-encrypt into dist
                    src: '../../node_modules/@skalenetwork/t-encrypt/encrypt.wasm',
                    dest: '',
                },
            ],
        }),
  ],
  define: {
    global: 'globalThis',
  },
  resolve: {
    alias: {
      "path": "path-browserify",
      "crypto": "crypto-browserify",
      "fs": "browserify-fs"
    }
  },
  server: {
    fs: {
      allow: ['..']
    },
    port: 3000,
  },
  assetsInclude: ['**/*.wasm'],
  optimizeDeps: {
    exclude: ['@skalenetwork/bite']
  }
})