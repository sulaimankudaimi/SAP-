import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

export const injectCspPlugin: Plugin = {
  name: 'inject-csp',
  apply: 'build',
  transformIndexHtml(html: string) {
    const cspContent =
      "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'";
    const metaTag = `<meta http-equiv="Content-Security-Policy" content="${cspContent}" />`;
    return html.replace(/<head>/i, `<head>\n    ${metaTag}`);
  },
};

export default defineConfig(() => {
  return {
    base: './',
    plugins: [react(), tailwindcss(), injectCspPlugin],
    resolve: {
      alias: {
        '@': path.resolve(fileURLToPath(new URL('.', import.meta.url)), '.'),
      },
    },
    build: {
      outDir: 'dist',
      assetsInlineLimit: 4096,
      emptyOutDir: true,
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true as const,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
