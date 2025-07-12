import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  
  // Build configuration
  build: {
    outDir: 'build',
    sourcemap: true,
    rollupOptions: {
      external: ['fs', 'path', 'os'], // Externalize Node.js modules
    },
  },
  
  // Development server
  server: {
    open: true,
    port: 3000,
    host: true,
  },
  
  // Path aliases
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@components': resolve(__dirname, 'src/components'),
      // Node.js polyfills
      buffer: 'buffer',
      process: 'process/browser',
      stream: 'stream-browserify',
      util: 'util',
      crypto: 'crypto-browserify',
      fs: 'path-browserify', // Mock fs with path
      path: 'path-browserify',
      os: 'os-browserify',
    },
  },
  
  // Global definitions
  define: {
    global: 'globalThis',
    'process.env': {},
    'process.version': '"v18.0.0"',
    'process.platform': '"browser"',
  },
  
  // Environment variables prefix
  envPrefix: 'VITE_',
  
  // Optimize dependencies - exclude problematic ones
  optimizeDeps: {
    include: [
      'buffer',
      'process',
      'stream-browserify',
      'util',
      'crypto-browserify',
      'path-browserify',
      'os-browserify',
    ],
    exclude: [
      '@skalenetwork/bite',
      '@skalenetwork/t-encrypt',
      'fs',
    ],
  },
})