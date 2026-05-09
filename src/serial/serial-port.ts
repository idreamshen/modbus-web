import { ref } from 'vue'
import { parseRequest } from '../modbus/parser'
import { handleRequest } from '../modbus/handler'
import { store, addLogEntry } from '../store/registers'
import { toHexString, FunctionCode } from '../modbus/types'
import { verifyCrc } from '../modbus/crc16'

export interface SerialConfig {
  baudRate: number
  dataBits: 7 | 8
  stopBits: 1 | 2
  parity: 'none' | 'even' | 'odd'
}

const isOpen = ref(false)
const isSupported = ref(typeof navigator !== 'undefined' && 'serial' in navigator)

let port: SerialPort | null = null
let reader: ReadableStreamDefaultReader<Uint8Array> | null = null
let abortController: AbortController | null = null

function handlePortDisconnect(event: Event): void {
  if ((event.target as SerialPort | null) === port) {
    void closePort()
  }
}

/** Inter-frame silence timeout in ms (Modbus RTU spec: 3.5 char times) */
const FRAME_TIMEOUT_MS = 20

/**
 * Check if the Web Serial API is available in this browser
 */
export function isSerialSupported(): boolean {
  return isSupported.value
}

/**
 * Open a serial port with the given configuration.
 * Triggers the browser's port selection dialog.
 */
export async function openPort(config: SerialConfig): Promise<void> {
  if (!navigator.serial) {
    throw new Error('Web Serial API is not supported in this browser')
  }

  port = await navigator.serial.requestPort()
  await port.open({
    baudRate: config.baudRate,
    dataBits: config.dataBits,
    stopBits: config.stopBits,
    parity: config.parity,
  })
  port.addEventListener('disconnect', handlePortDisconnect)

  isOpen.value = true
  abortController = new AbortController()
  startReadLoop()
}

/**
 * Close the serial port
 */
export async function closePort(): Promise<void> {
  const currentReader = reader
  const currentPort = port

  abortController?.abort()
  abortController = null
  isOpen.value = false
  reader = null
  port = null

  if (currentReader) {
    try {
      await currentReader.cancel()
    } catch {
      // Ignore cancel errors
    }

    try {
      currentReader.releaseLock()
    } catch {
      // Ignore release errors
    }
  }

  if (currentPort) {
    currentPort.removeEventListener('disconnect', handlePortDisconnect)

    try {
      await currentPort.close()
    } catch {
      // Ignore close errors
    }
  }
}

/**
 * Write data to the serial port
 */
async function writeToPort(data: Uint8Array): Promise<void> {
  if (!port?.writable) return

  const writer = port.writable.getWriter()
  try {
    await writer.write(data)
  } finally {
    writer.releaseLock()
  }
}

/**
 * Start the read loop that accumulates bytes and detects Modbus frames
 * using inter-frame silence (timeout-based frame detection).
 */
function startReadLoop(): void {
  const currentPort = port
  const currentAbortController = abortController

  if (!currentPort?.readable || !currentAbortController) return

  const readable = currentPort.readable

  ;(async () => {
    let activeReader: ReadableStreamDefaultReader<Uint8Array> | null = null
    let buffer = new Uint8Array(0)
    let frameTimer: ReturnType<typeof setTimeout> | null = null

    const closeAfterSerialError = async (err: unknown) => {
      if (currentAbortController.signal.aborted || port !== currentPort) return

      console.error('Serial port error:', err)
      await closePort()
    }

    const processFrame = async () => {
      if (buffer.length < 4) {
        buffer = new Uint8Array(0)
        return
      }

      const frame = buffer
      buffer = new Uint8Array(0)

      // Log RX
      const rxSummary = describeRequest(frame)
      addLogEntry({
        timestamp: new Date(),
        direction: 'RX',
        rawHex: toHexString(frame),
        summary: rxSummary,
      })

      // Parse and handle
      const request = parseRequest(frame)
      if (!request) return

      // Only respond if the request is addressed to us (or broadcast address 0)
      if (request.slaveAddress !== store.slaveAddress && request.slaveAddress !== 0) {
        return
      }

      // Don't respond to broadcast writes (address 0) — just process them silently
      const response = handleRequest(request)

      if (request.slaveAddress !== 0) {
        // Log TX
        addLogEntry({
          timestamp: new Date(),
          direction: 'TX',
          rawHex: toHexString(response),
          summary: describeResponse(request, response),
        })

        await writeToPort(response)
      }
    }

    try {
      reader = readable.getReader()
      activeReader = reader

      while (port === currentPort && isOpen.value) {
        const { value, done } = await activeReader.read()
        if (done) break

        if (value && value.length > 0) {
          // Append to buffer
          const newBuffer = new Uint8Array(buffer.length + value.length)
          newBuffer.set(buffer)
          newBuffer.set(value, buffer.length)
          buffer = newBuffer

          // Reset frame timer
          if (frameTimer) clearTimeout(frameTimer)
          frameTimer = setTimeout(() => {
            void processFrame().catch((err) => {
              void closeAfterSerialError(err)
            })
          }, FRAME_TIMEOUT_MS)
        }
      }

      if (!currentAbortController.signal.aborted && port === currentPort && isOpen.value) {
        await closePort()
      }
    } catch (err) {
      await closeAfterSerialError(err)
    } finally {
      if (frameTimer) clearTimeout(frameTimer)

      if (activeReader) {
        try {
          activeReader.releaseLock()
        } catch {
          // Ignore release errors
        }

        if (reader === activeReader) {
          reader = null
        }
      }
    }
  })()
}

/**
 * Generate a human-readable description of an incoming request frame
 */
function describeRequest(frame: Uint8Array): string {
  if (!verifyCrc(frame)) return 'Invalid CRC'
  if (frame.length < 4) return 'Frame too short'

  const slave = frame[0]
  const fc = frame[1]
  const fcName = FunctionCode[fc as FunctionCode] ?? `Unknown(0x${fc.toString(16).toUpperCase()})`

  switch (fc) {
    case FunctionCode.ReadHoldingRegisters:
    case FunctionCode.ReadInputRegisters: {
      const start = (frame[2] << 8) | frame[3]
      const qty = (frame[4] << 8) | frame[5]
      return `Slave=${slave} ${fcName} Start=${start} Qty=${qty}`
    }
    case FunctionCode.WriteSingleRegister: {
      const reg = (frame[2] << 8) | frame[3]
      const val = (frame[4] << 8) | frame[5]
      return `Slave=${slave} ${fcName} Reg=${reg} Value=${val}`
    }
    case FunctionCode.WriteMultipleRegisters: {
      const start = (frame[2] << 8) | frame[3]
      const qty = (frame[4] << 8) | frame[5]
      return `Slave=${slave} ${fcName} Start=${start} Qty=${qty}`
    }
    default:
      return `Slave=${slave} FC=0x${fc.toString(16).toUpperCase()}`
  }
}

/**
 * Generate a human-readable description of an outgoing response
 */
function describeResponse(request: { functionCode: number; slaveAddress: number }, response: Uint8Array): string {
  if (response[1] & 0x80) {
    const exCode = response[2]
    return `Exception FC=0x${(response[1] & 0x7F).toString(16).toUpperCase()} Code=${exCode}`
  }
  return `Response OK — ${FunctionCode[request.functionCode as FunctionCode] ?? 'Unknown'}`
}

export { isOpen }
