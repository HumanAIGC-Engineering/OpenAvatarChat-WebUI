import { app, shell, BrowserWindow, ipcMain, session, globalShortcut, PopupOptions } from 'electron'

import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.jpeg?asset'
import { createContextMenu } from './features/contextMenu'
import appState, { WindowSize } from './features/appState'

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: WindowSize.width,
    height: WindowSize.height,
    show: false,
    resizable: true,
    frame: false,
    transparent: true,
    hasShadow: false,
    autoHideMenuBar: false,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      webSecurity: false,
    },
  })
  ipcMain.on('app-ready', () => {
    // 同步初始状态
    for (const key in appState.state) {
      mainWindow.webContents.send('state-changed', { key, value: appState.state[key] })
    }
    appState.updateWindowWidth()
  })
  ipcMain.on('state-changed', (event, data) => {
    console.log('🚀 ~ createWindow ~ data:', data)
    appState.setState(data.key, data.value)
  })
  // 监听显示右键菜单请求
  ipcMain.on('show-context-menu', (event) => {
    const menu = createContextMenu()
    menu.popup(BrowserWindow.fromWebContents(event.sender) as PopupOptions)
  })

  mainWindow.webContents.openDevTools()

  // session.defaultSession.setCertificateVerifyProc((request, callback) => {
  //   callback(0) // 0 表示信任
  // })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.commandLine.appendSwitch('ignore-certificate-errors')
// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
