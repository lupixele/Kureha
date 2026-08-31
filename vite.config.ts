/// <reference types="vitest" />
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import { defineConfig } from 'vitest/config';
import viteReact from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [tanstackStart(), viteReact()],
  test: {
    exclude: ['**/node_modules/**', '**/.claude/**', '**/dist/**'],
  },
});
