import isElectron from '@renderer/utils/isElectron'

const isDEV = import.meta.env.DEV

if (import.meta.env.USE_SSL === false && !['127.0.0.1', 'localhost'].includes(location.hostname)) {
  console.warn('USE_SSL为false时hostname必须为127.0.0.1或localhost')
}
export const useSSL = isDEV
  ? location.protocol === 'https:'
  : typeof import.meta.env.USE_SSL === 'undefined'
    ? location.protocol === 'https:'
    : import.meta.env.USE_SSL
console.log(useSSL, import.meta.env.USE_SSL, import.meta.env.DEV)
export const serverIP = import.meta.env.SERVER_IP || location.hostname
export const serverPort = import.meta.env.SERVER_PORT || location.port
export const serverHost = isDEV ? location.host : `${serverIP}:${serverPort}`
export const serverProtocol = useSSL === undefined ? location.protocol : useSSL ? 'https' : 'http'
export const serverOrigin = `${serverProtocol}://${serverHost}`
export function fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const token = localStorage.getItem('auth_openavatarchat')
  const headers = new Headers(init?.headers || {})
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  const nextInit: RequestInit = { ...init, headers }
  return window.fetch(`${serverOrigin}${input}`, nextInit)
}
