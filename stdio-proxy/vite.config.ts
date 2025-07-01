import { defineConfig } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  // Build configuration for Node.js application
  build: {
    target: 'node22',
    outDir: 'dist',
    emptyOutDir: true,
    lib: {
      entry: resolve(__dirname, 'proxy.js'),
      formats: ['cjs'],
      fileName: () => 'proxy.js',
    },
    rollupOptions: {
      external: [
        // Node.js built-in modules
        'net',
        'fs',
        'path',
        'os',
        'child_process',
        'events',
        'stream',
        'util',
        'buffer',
        'crypto',
        'process'
      ],
      output: {
        format: 'cjs',
        entryFileNames: '[name].js',
      },
    },
    minify: false, // Keep readable for debugging
    sourcemap: true,
  },

  // Plugin configuration
  plugins: [
    // Custom plugin to copy manifest.json and other assets
    {
      name: 'copy-assets',
      generateBundle() {
        // Copy install scripts
        const installScripts = [
          'install-windows.bat',
          'install-linux.sh', 
          'install-macos.sh'
        ];

        installScripts.forEach(script => {
          if (fs.existsSync(resolve(__dirname, script))) {
            this.emitFile({
              type: 'asset',
              fileName: script,
              source: fs.readFileSync(resolve(__dirname, script), 'utf-8'),
            });
          }
        });
      },
    },
  ],

  // Define configuration for Node.js environment
  define: {
    global: 'globalThis',
  },

  // Resolve configuration
  resolve: {
    alias: {
      '@': resolve(__dirname, './'),
    },
  },
});