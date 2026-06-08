import { resolve, join } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import viteConfigFn from './vite.config'
import { existsSync } from 'fs'
import { loadEnv, UserConfig } from 'vite'

const envPath = resolve(__dirname, '.env')
if (!existsSync(envPath)) {
  throw new Error('缺少 .env 配置文件，构建已中止。')
}

// Electron 生产构建：仅读取 .env / .env.local，不使用 .env.production
// （.env.production 会清空 VITE_SERVER_*，只适合同源 Web 部署）
const electronEnv = loadEnv('', __dirname, '')
const electronUseSSL =
  electronEnv.VITE_USE_SSL === undefined || electronEnv.VITE_USE_SSL === ''
    ? undefined
    : electronEnv.VITE_USE_SSL === 'true'

// vite.config.ts 的默认导出可能是函数（defineConfig((env) => ...)）或对象
const viteConfig = (
  typeof viteConfigFn === 'function'
    ? (viteConfigFn as (env: { mode: string; command: string }) => UserConfig)({
        mode: 'production',
        command: 'build',
      })
    : viteConfigFn
) as UserConfig

// 覆盖 renderer 的 SERVER_*，确保 IP/端口写入安装包
const rendererDefine: Record<string, unknown> = {
  ...(viteConfig.define as Record<string, unknown> | undefined),
  'import.meta.env.SERVER_IP': JSON.stringify(electronEnv.VITE_SERVER_IP || ''),
  'import.meta.env.SERVER_PORT': JSON.stringify(electronEnv.VITE_SERVER_PORT || ''),
  'import.meta.env.USE_SSL': JSON.stringify(electronUseSSL),
}

const baseOutDir = join(__dirname, 'dist-electron/out')
export default defineConfig({
  main: {
    build: {
      outDir: join(baseOutDir, 'main'),
    },
    plugins: [externalizeDepsPlugin()],
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: join(baseOutDir, 'preload'),
      rollupOptions: {
        output: {
          format: 'es',
        },
      },
    },
  },
  renderer: {
    root: viteConfig.root,
    envDir: viteConfig.envDir,
    build: {
      outDir: join(baseOutDir, 'renderer'),
    },
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@': resolve('src/renderer/src'),
        ...((viteConfig.resolve?.alias as Record<string, string> | undefined) || {}),
      },
    },
    define: rendererDefine,
    plugins: viteConfig.plugins,
    server: viteConfig.server,
  },
})
