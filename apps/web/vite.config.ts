import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  base: process.env.GITHUB_ACTIONS === 'true'
    ? process.env.GITHUB_REPOSITORY?.split('/')[1]?.endsWith('.github.io')
      ? '/'
      : `/${process.env.GITHUB_REPOSITORY?.split('/')[1] ?? ''}/`
    : '/',
  plugins: [
    react(),
    // Mengaktifkan HTTPS lokal otomatis agar browser HP (Android Chrome / iPhone Safari)
    // langsung mengizinkan akses kamera pemindai barcode / QR code
    process.env.USE_SSL === 'false' ? null : basicSsl()
  ].filter(Boolean),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@machine-tracking/shared': path.resolve(__dirname, '../../packages/shared/src')
    }
  },
  server: {
    host: true, // Mendengarkan di 0.0.0.0 agar bisa diakses oleh HP dalam jaringan Wi-Fi/Hotspot yang sama
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false
      }
    }
  }
});
