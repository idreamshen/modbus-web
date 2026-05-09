/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

// Web Serial API type declarations
interface Serial {
  requestPort(options?: SerialPortRequestOptions): Promise<SerialPort>
  getPorts(): Promise<SerialPort[]>
  addEventListener(type: string, listener: EventListener): void
  removeEventListener(type: string, listener: EventListener): void
}

interface SerialPortRequestOptions {
  filters?: SerialPortFilter[]
}

interface SerialPortFilter {
  usbVendorId?: number
  usbProductId?: number
}

interface SerialPort {
  readonly readable: ReadableStream<Uint8Array> | null
  readonly writable: WritableStream<Uint8Array> | null
  open(options: SerialOptions): Promise<void>
  close(): Promise<void>
  getInfo(): SerialPortInfo
  addEventListener(type: string, listener: EventListener): void
  removeEventListener(type: string, listener: EventListener): void
}

interface SerialOptions {
  baudRate: number
  dataBits?: number
  stopBits?: number
  parity?: ParityType
  bufferSize?: number
  flowControl?: FlowControlType
}

type ParityType = 'none' | 'even' | 'odd'
type FlowControlType = 'none' | 'hardware'

interface SerialPortInfo {
  usbVendorId?: number
  usbProductId?: number
}

interface Navigator {
  readonly serial?: Serial
}
