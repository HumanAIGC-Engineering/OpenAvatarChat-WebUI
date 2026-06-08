import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {}

function setupContextMenu(): void {
  document.addEventListener(
    'contextmenu',
    (event) => {
      event.preventDefault()
      ipcRenderer.send('show-context-menu', {
        x: event.clientX,
        y: event.clientY,
      })
    },
    true
  )
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
    contextBridge.exposeInMainWorld('electronInfo', {
      version: process.version,
      platform: process.platform,
    })
    contextBridge.exposeInMainWorld('safeApi', {
      fetch: (url: string, options?: RequestInit) => {
        console.log('🚀 ~ url, options:', url, options)
        return ipcRenderer.invoke('safe-fetch', { url, options })
      },
    })
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.electronInfo = {
    version: process.version,
    platform: process.platform,
  }
  // @ts-ignore (define in dts)
  window.api = api
}
console.log(window.electronInfo)
console.log(window.api)
console.log(window.electron)
console.log(process.contextIsolated)

document.addEventListener('DOMContentLoaded', () => {
  setupContextMenu()
})
