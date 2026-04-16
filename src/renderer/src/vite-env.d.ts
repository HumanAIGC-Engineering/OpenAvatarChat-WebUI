/// <reference types="vite/client" />

interface Window {
  electronInfo: {
    version: string
    platform: string
  }
}

interface ViteTypeOptions {
  // 添加这行代码，你就可以将 ImportMetaEnv 的类型设为严格模式，
  // 这样就不允许有未知的键值了。
  // strictImportMetaEnv: unknown
}

interface ImportMetaEnv {
  readonly SERVER_IP: string
  readonly SERVER_PORT: string
  readonly USE_SSL: boolean
  // 更多环境变量...
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
