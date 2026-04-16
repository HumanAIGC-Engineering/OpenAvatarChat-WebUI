import { WS } from '@/helpers/ws'
import { fetch, serverHost, serverOrigin, useSSL } from './base'

export { fetch }

export function initConfig(): Promise<Response> {
  return fetch('/openavatarchat/initconfig')
}

export function webrtcOffer(body: Record<string, unknown>): Promise<Response> {
  return fetch('/webrtc/offer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function createWS(ws_route: string, webRTCId: string): WS {
  const token = localStorage.getItem('auth_openavatarchat')
  let url = `${useSSL ? 'wss' : 'ws'}://${serverHost}${ws_route}/${webRTCId}`
  if (token) {
    // 浏览器 WebSocket API 不支持自定义 headers，通过 URL 查询参数传递 token
    if (token) {
      url += `?token=${encodeURIComponent(token)}`
    }
  }
  const ws = new WS(url)

  return ws
}
export function createDataToolWS(): WS {
  const token = localStorage.getItem('auth_openavatarchat')
  let url = `${useSSL ? 'wss' : 'ws'}://${serverHost}/ws/manager/data_tool`
  if (token) {
    url += `?token=${encodeURIComponent(token)}`
  }
  return new WS(url)
}

export function makeURL(path: string): string {
  if (path.startsWith('http')) {
    return path
  }
  return `${serverOrigin}${path}`
}

export function makeDataToolFileURL(filePath: string): string {
  return `${useSSL ? 'https' : 'http'}://${serverHost}/download/manager/data_tool/file?file_path=${encodeURIComponent(filePath)}`
}
