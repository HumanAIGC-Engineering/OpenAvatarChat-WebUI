// import legacyPlugin from '@vitejs/plugin-legacy'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import mkcert from 'vite-plugin-mkcert'

import { join } from 'path'
import 'dotenv/config'

// server of your OpenAvatarChat
// if you are not use localhost, you need to start https
const SERVER_IP = process.env.VITE_SERVER_IP || ''
const SERVER_PORT = process.env.VITE_SERVER_PORT || ''
const USE_SSL =
  process.env.VITE_USE_SSL === undefined ? undefined : process.env.VITE_USE_SSL === 'true'

// Only create proxy config when SERVER_IP and SERVER_PORT are defined
const hasServerConfig = SERVER_IP && SERVER_PORT
const proxyTarget = hasServerConfig
  ? `${USE_SSL ? 'https' : 'http'}://${SERVER_IP}:${SERVER_PORT}`
  : undefined
const wsProxyTarget = hasServerConfig
  ? `${USE_SSL ? 'wss' : 'ws'}://${SERVER_IP}:${SERVER_PORT}`
  : undefined

// https://vitejs.dev/config/
export default defineConfig({
  root: join(__dirname, 'src', 'renderer'),
  base: './',
  build: {
    outDir: join(__dirname, 'dist'),
    rollupOptions: {
      input: {
        main: join(__dirname, 'src', 'renderer', 'index.html'),
        manager: join(__dirname, 'src', 'renderer', 'manager.html'),
      },
      output: {
        entryFileNames: `assets/[name].[hash].js`,
        chunkFileNames: `assets/[name].[hash].js`,
        assetFileNames: `assets/[name].[hash].[ext]`,
      },
    },
  },
  define: {
    'import.meta.env.SERVER_IP': JSON.stringify(SERVER_IP),
    'import.meta.env.SERVER_PORT': JSON.stringify(SERVER_PORT),
    'import.meta.env.USE_SSL': JSON.stringify(USE_SSL),
  },
  server: {
    // host: '0.0.0.0',
    // https: USE_SSL,
    // port: 443,
    proxy: hasServerConfig
      ? {
          '/download': {
            target: proxyTarget,
            changeOrigin: true,
            secure: false,
          },
          '/openavatarchat': {
            target: proxyTarget,
            changeOrigin: true,
            secure: false,
          },
          '/webrtc/offer': {
            target: proxyTarget,
            changeOrigin: true,
            secure: false,
          },
          '/ws': {
            target: wsProxyTarget,
            ws: true,
            rewriteWsOrigin: true,
            secure: false,
          },
        }
      : undefined,
  },
  plugins: [
    vue(),
    // 本地开发如果需要https才能走通接口的话，则需要开启mkcert,并且开启mkcert需要sudo权限
    // mkcert({
    //   source: 'coding',
    // }),
    // legacyPlugin({
    //   modernPolyfills: true,
    // }),
  ],
  resolve: {
    alias: {
      '@': join(__dirname, 'src/renderer/src'),
      '@renderer': join(__dirname, 'src/renderer/src'),
    },
  },
})
