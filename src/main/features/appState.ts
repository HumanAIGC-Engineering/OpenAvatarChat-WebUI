import { BrowserWindow, ipcMain } from 'electron'
import Store from 'electron-store'
const store = new Store()

interface IAppState {
  toolsVisible: boolean
  inputVisible: boolean
  showChatRecords: boolean
}

export const WindowSize = {
  width: 900,
  height: 670,
}

class AppState {
  state: IAppState
  constructor() {
    this.state = store.get('appState', {
      toolsVisible: true,
      inputVisible: true,
      showChatRecords: true,
    }) as IAppState

    // 每次启动强制重置 inputVisible，避免记忆为 hidden 时导致无法进行连接
    this.state.inputVisible = true
    store.set('appState', this.state)

    store.onDidChange('appState.showChatRecords', (newValue, oldValue) => {
      this.updateWindowWidth()
    })
  }

  setState(key: keyof IAppState, value: IAppState[keyof IAppState]) {
    if (this.state[key] === value) return
    this.state[key] = value

    // 保存到本地
    store.set('appState', this.state)

    this.notifyRenderers(key, value)
  }
  getState(key) {
    return this.state[key]
  }

  getAllState() {
    return { ...this.state }
  }
  notifyRenderers(key, value) {
    // 通知所有窗口状态变化
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('state-changed', { key, value })
    })
  }
  updateWindowWidth() {
    BrowserWindow.getAllWindows().forEach((win) => {
      const [_, height] = win.getSize()
      win.setSize(this.state.showChatRecords ? WindowSize.width : WindowSize.width / 2, height)
    })
  }
}

const appState = new AppState()
// IPC 处理
ipcMain.on('set-state', (event, { key, value }) => {
  appState.setState(key, value)
})

ipcMain.handle('get-state', (event, key) => {
  return key ? appState.getState(key) : appState.getAllState()
})

export default appState
