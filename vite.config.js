import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

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
    exclude: ['@skalenetwork/bite'],
    include: ['@skalenetwork/t-encrypt'] // Force pre-bundling
  },
  // Add this to handle CommonJS modules
  build: {
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true
    }
  },
  // Handle ESM/CommonJS interop
  ssr: {
    noExternal: ['@skalenetwork/bite', '@skalenetwork/t-encrypt']
  }
})