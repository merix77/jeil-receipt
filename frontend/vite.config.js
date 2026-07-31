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
      // prompt: 새 버전을 자동 적용하지 않고 UpdatePrompt 배너로 사용자가 새로고침하게 함
      registerType: 'prompt',
      // public/ 아이콘을 프리캐시에 포함시켜 오프라인에서도 아이콘이 뜨게 함
      includeAssets: ['icon-192.png', 'icon-512.png', 'icon-512-maskable.png'],
      manifest: {
        name: '제일축산 PREMIUM 거래내역서',
        short_name: '거래내역서',
        start_url: '/',
        display: 'standalone',
        background_color: '#BFE4D0',
        theme_color: '#1E6A50',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
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
      '/yields': 'http://localhost:3000',
    },
  },
});
