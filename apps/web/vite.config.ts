import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    // These are only reachable through lazily imported pages, so Vite's initial
    // scan misses them and discovers them mid-session — which re-optimizes the
    // dep bundle, changes its hash, and makes the in-flight dynamic import fail
    // with "Failed to fetch dynamically imported module". Pre-bundling them at
    // startup keeps the first visit to those pages stable.
    include: ['sonner', 'cmdk', 'react-day-picker'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          router: ['react-router-dom'],
          charts: ['recharts'],
          tiptap: [
            '@tiptap/react',
            '@tiptap/starter-kit',
            '@tiptap/extension-placeholder',
            '@tiptap/extension-underline',
            '@tiptap/extension-link',
          ],
          'ui-vendor': ['@headlessui/react', 'lucide-react'],
          'core-vendor': ['axios', 'clsx', 'tailwind-merge'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
});
