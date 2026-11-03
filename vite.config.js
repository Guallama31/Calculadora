import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { cpSync, existsSync, readFileSync } from 'node:fs';

export default defineConfig({
  // plugin-react solo sobre JSX/TSX: el catálogo de 5 MB no debe pasar por Babel
  // (su sourcemap inline inflaba la respuesta de desarrollo a ~28 MB).
  plugins: [
    react({ include: /\.(jsx|tsx)$/ }),
    tailwindcss(),
    {
      // El catálogo es ESM puro (un array gigante). Servirlo sin transformar
      // evita que Vite le inyecte un sourcemap inline de ~23 MB en desarrollo.
      name: 'catalog-static',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url?.split('?')[0] !== '/data/catalog.js') return next();
          res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
          res.setHeader('Cache-Control', 'no-cache');
          res.end(readFileSync(new URL('./data/catalog.js', import.meta.url)));
        });
      },
    },
    {
      // Los enlaces de «Soporte» del menú apuntan a /docs/*.md: hay que copiar
      // la carpeta al build o quedan en 404 en producción.
      name: 'copy-docs',
      apply: 'build',
      closeBundle() {
        const from = new URL('./docs', import.meta.url);
        if (existsSync(from)) cpSync(from, new URL('./dist/docs', import.meta.url), { recursive: true });
      },
    },
  ],
  // El catálogo es un módulo de ~5 MB: sin sourcemap inline la respuesta de
  // desarrollo pasa de ~28 MB a ~5 MB.
  esbuild: { sourcemap: false },
  server: {
    host: '0.0.0.0',
    port: 8000,
    strictPort: true,
    allowedHosts: true,
    // `coverage/` cambia en cada corrida y no debe recargar la app.
    watch: { ignored: ['**/coverage/**', '**/dist/**'] },
  },
  preview: { host: '0.0.0.0', port: 8000, allowedHosts: true },
  build: {
    chunkSizeWarningLimit: 6000,
    rollupOptions: {
      output: {
        // El catálogo va en su propio chunk (se carga con import() dinámico):
        // así un cambio de la app no invalida esos ~5 MB en la caché del navegador.
        manualChunks: id => (id.includes('/data/catalog.js') ? 'catalog' : undefined),
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.{js,jsx}'],
    setupFiles: ['./tests/setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/components/ui/**', 'src/main.jsx'],
    },
  },
});
