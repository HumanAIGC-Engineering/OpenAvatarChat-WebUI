export function click_outside(node: Node, cb: any): any {
  const handle_click = (event: MouseEvent): void => {
    if (
      node &&
      !node.contains(event.target as Node) &&
      !event.defaultPrevented
    ) {
      cb(event)
    }
  }

  document.addEventListener('click', handle_click, true)

  return {
    destroy() {
      document.removeEventListener('click', handle_click, true)
    },
  }
}

export function insertStringAt(
  rawStr: string,
  insertString: string,
  index: number,
) {
  if (index < 0 || index > rawStr.length) {
    console.error('索引超出范围')
    return rawStr
  }

  return rawStr.substring(0, index) + insertString + rawStr.substring(index)
}
