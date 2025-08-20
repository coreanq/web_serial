import { defineConfig } from 'vite';
import { resolve } from 'path';
import fs from 'fs';

export default defineConfig({
  // Build configuration for Chrome extension
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, '../src/popup.ts'),
        background: resolve(__dirname, '../src/background.ts'),
        options: resolve(__dirname, '../src/options.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
        manualChunks: undefined,
      },
    },
    minify: process.env.NODE_ENV === 'production',
    sourcemap: process.env.NODE_ENV === 'development',
    cssCodeSplit: false,
  },
  
  resolve: {
    alias: {
      '@': resolve(__dirname, '../src'),
    },
  },
  
  // Plugin configuration
  plugins: [
    // Custom plugin to handle HTML files and copy static assets
    {
      name: 'chrome-extension-plugin',
      generateBundle() {
        // Copy manifest.json
        this.emitFile({
          type: 'asset',
          fileName: 'manifest.json',
          source: fs.readFileSync(resolve(__dirname, 'manifest.json'), 'utf-8'),
        });
        
        // Copy HTML templates
        const popupHtml = fs.readFileSync(resolve(__dirname, 'templates/popup.html'), 'utf-8');
        this.emitFile({
          type: 'asset',
          fileName: 'popup.html',
          source: popupHtml.replace(
            '</body>',
            '  <script src="popup.js"></script>\n</body>'
          ),
        });
        
        const optionsHtml = fs.readFileSync(resolve(__dirname, 'templates/options.html'), 'utf-8');
        this.emitFile({
          type: 'asset',
          fileName: 'options.html',
          source: optionsHtml.replace(
            '</body>',
            '  <script src="options.js"></script>\n</body>'
          ),
        });
        
        // Copy icons
        const iconsDir = resolve(__dirname, 'icons');
        if (fs.existsSync(iconsDir)) {
          const iconFiles = fs.readdirSync(iconsDir);
          iconFiles.forEach((file: string) => {
            if (file.endsWith('.png')) {
              this.emitFile({
                type: 'asset',
                fileName: `icons/${file}`,
                source: fs.readFileSync(resolve(iconsDir, file)),
              });
            }
          });
        }
      },
    },
  ].filter(Boolean), // Filter out false values from conditional plugins
  
  // CSS processing
  css: {
    postcss: './postcss.config.js',
  },
  
  // Development server (not needed for extension but useful for testing)
  server: {
    port: 3000,
  },
});