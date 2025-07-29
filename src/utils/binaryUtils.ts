import base64js from 'base64-js'
import { Buffer } from 'buffer'
import PythonStruct from 'python-struct'

export const unpack = async function (blob: Blob, str = '<II') {
  const unpackBuffer = await blob.slice(4, 12).arrayBuffer()
  const [jsonSize, binSize] = PythonStruct.unpack(
    str,
    Buffer.from(unpackBuffer),
  ) as number[]
  const jsonBlob = await blob.slice(12, 12 + jsonSize).text()
  const parsedData = JSON.parse(jsonBlob)
  return {
    parsedData,
    jsonSize,
    binSize,
  }
}
export const mergeBlob = (strArray: string[], target: Uint8Array) => {
  let offset = 0
  strArray.forEach((str) => {
    const byteArray = base64js.toByteArray(str)
    target.set(byteArray, offset)
    offset += byteArray.byteLength
  })
  const blob = new Blob([target])
  return blob
}
