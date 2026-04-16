import { Menu, MenuItemConstructorOptions } from 'electron'
import appState from './appState'

export const createContextMenu = () => {
  const toolsVisible = appState.getState('toolsVisible')
  const inputVisible = appState.getState('inputVisible')
  const showChatRecords = appState.getState('showChatRecords')

  const template = [
    // ... 其他菜单项
    {
      label: '工具栏',
      type: 'checkbox',
      checked: toolsVisible,
      click: (menuItem) => {
        appState.setState('toolsVisible', menuItem.checked)
      },
    },
    {
      label: '输入框',
      type: 'checkbox',
      checked: inputVisible,
      click: (menuItem) => {
        appState.setState('inputVisible', menuItem.checked)
      },
    },
    {
      label: '对话记录',
      type: 'checkbox',
      checked: showChatRecords,
      click: (menuItem) => {
        appState.setState('showChatRecords', menuItem.checked)
      },
    },
  ]

  return Menu.buildFromTemplate(template as MenuItemConstructorOptions[])
}
