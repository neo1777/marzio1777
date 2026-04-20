import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    // base: '/marzio1777/', // IMPORTANT: Rimuovi il commento se ospiti il sito su https://tuonome.github.io/marzio1777/
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        manifest: {
          name: 'marzio1777',
          short_name: 'marzio1777',
          description: 'La Macchina del Tempo Digitale per i Ricordi di Montagna',
          theme_color: '#2D5A27',
          background_color: '#F7F5F0',
          display: 'standalone',
          orientation: 'portrait',
          icons: [
            {
              src: 'https://api.dicebear.com/7.x/identicon/svg?seed=marzio1777',
              sizes: '192x192',
              type: 'image/svg+xml'
            },
               {
              src: 'https://api.dicebear.com/7.x/identicon/svg?seed=marzio1777',
              sizes: '512x512',
              type: 'image/svg+xml'
            }
          ]
        }
      })
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
