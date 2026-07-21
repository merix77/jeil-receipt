import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  plugins: [
    react(),
    // getUserMedia (후면 카메라 직접 제어) requires a secure context,
    // so the dev server must run over HTTPS even on the local network.
    basicSsl(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: '제일축산 PREMIUM 거래내역서',
        short_name: '거래내역서',
        start_url: '/',
        display: 'standalone',
        background_color: '#FAF7F1',
        theme_color: '#AF3226',
        icons: [],
      },
    }),
  ],
  server: {
    host: true,
    // HTTPS page can't call the HTTP backend directly (mixed content),
    // so proxy API paths through the dev server instead.
    proxy: {
      '/receipts': 'http://localhost:3000',
      '/hygiene': 'http://localhost:3000',
    },
  },
});
