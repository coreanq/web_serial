import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // Root directory for the project
  root: '.',
  
  // Build configuration
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
    },
    minify: 'esbuild',
    sourcemap: true,
  },
  
  // Resolve configuration
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  
  // CSS processing
  css: {
    postcss: {
      plugins: [
        require('tailwindcss'),
        require('autoprefixer'),
      ],
    },
  },
  
  // Development server
  server: {
    port: 3000,
    open: true,
    host: true,
  },
  
  // Preview server
  preview: {
    port: 4173,
    open: true,
  },
  
  // Plugins
  plugins: [],
  
  // Optimizations
  optimizeDeps: {
    include: ['ws'],
  },
});