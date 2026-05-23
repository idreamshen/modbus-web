import { ref } from 'vue'
import { buildRtuAdu } from '../modbus/master-codec'
import { parseRtuResponse } from '../modbus/response-parser'
import { FunctionCode, toHexString, type ModbusMasterResult } from '../modbus/types'
import { addLogEntry } from '../store/registers'
import type { SerialConfig } from '../serial/serial-port'
import type { MasterRequest, MasterResponse } from './types'

const FRAME_TIMEOUT_MS = 20

const isRtuMasterOpen = ref(false)
const isRtuMasterSupported = ref(typeof navigator !== 'undefined' && 'serial' in navigator)

let port: SerialPort | null = null
let reader: ReadableStreamDefaultReader<Uint8Array> | null = null
let pending:
  | {
      buffer: Uint8Array
      timer: ReturnType<typeof setTimeout> | null
      timeout: ReturnType<typeof setTimeout>
      resolve: (frame: Uint8Array) => void
      reject: (reason: Error) => void
    }
  | null = null

export function isRtuMasterSupportedApi(): boolean {
  return isRtuMasterSupported.value
}

export async function openRtuMasterPort(config: SerialConfig): Promise<void> {
  if (!navigator.serial) throw new Error('Web Serial API is not supported in this browser')
  if (isRtuMasterOpen.value) return

  port = await navigator.serial.requestPort()
  await port.open({
    baudRate: config.baudRate,
    dataBits: config.dataBits,
    stopBits: config.stopBits,
    parity: config.parity,
  })

  isRtuMasterOpen.value = true
  startReadLoop()
}

export async function closeRtuMasterPort(): Promise<void> {
  const currentReader = reader
  const currentPort = port

  rejectPending(new Error('RTU master port closed'))
  isRtuMasterOpen.value = false
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
    try {
      await currentPort.close()
    } catch {
      // Ignore close errors
    }
  }
}

export async function sendRtuMasterRequest(request: MasterRequest): Promise<MasterResponse> {
  if (!port?.writable || !isRtuMasterOpen.value) throw new Error('RTU master port is not connected')
  if (pending) throw new Error('Another RTU request is still pending')

  const started = performance.now()
  const requestFrame = buildRtuAdu({
    slaveId: request.unitId,
    functionCode: request.functionCode,
    startAddress: request.startAddress,
    quantity: request.quantity,
    value: request.value,
    values: request.values,
  })

  addLogEntry({
    timestamp: new Date(),
    direction: 'TX',
    rawHex: toHexString(requestFrame),
    summary: describeMasterRequest(request),
    role: 'master',
    protocol: 'rtu',
  })

  const writer = port.writable.getWriter()
  try {
    await writer.write(requestFrame)
  } finally {
    writer.releaseLock()
  }

  try {
    const responseFrame = await waitForFrame(request.timeoutMs)
    const result = parseRtuResponse(responseFrame, request.unitId)

    addLogEntry({
      timestamp: new Date(),
      direction: 'RX',
      rawHex: toHexString(responseFrame),
      summary: describeMasterResult(result),
      role: 'master',
      protocol: 'rtu',
    })

    return {
      ok: result.ok,
      requestHex: toHexString(requestFrame),
      responseHex: toHexString(responseFrame),
      elapsedMs: Math.round(performance.now() - started),
      result,
      error: result.error,
    }
  } catch (err: any) {
    const error = err?.message ?? 'RTU request failed'
    return {
      ok: false,
      requestHex: toHexString(requestFrame),
      elapsedMs: Math.round(performance.now() - started),
      error,
      result: { ok: false, error },
    }
  }
}

function startReadLoop(): void {
  const currentPort = port
  if (!currentPort?.readable) return

  ;(async () => {
    let activeReader: ReadableStreamDefaultReader<Uint8Array> | null = null
    const readable = currentPort.readable
    if (!readable) return

    try {
      reader = readable.getReader()
      activeReader = reader

      while (port === currentPort && isRtuMasterOpen.value) {
        const { value, done } = await activeReader.read()
        if (done) break
        if (value?.length) appendIncoming(value)
      }
    } catch (err) {
      if (port === currentPort && isRtuMasterOpen.value) {
        rejectPending(err instanceof Error ? err : new Error('Serial read failed'))
        await closeRtuMasterPort()
      }
    } finally {
      if (activeReader) {
        try {
          activeReader.releaseLock()
        } catch {
          // Ignore release errors
        }
        if (reader === activeReader) reader = null
      }
    }
  })()
}

function appendIncoming(chunk: Uint8Array): void {
  if (!pending) return

  const next = new Uint8Array(pending.buffer.length + chunk.length)
  next.set(pending.buffer)
  next.set(chunk, pending.buffer.length)
  pending.buffer = next

  if (pending.timer) clearTimeout(pending.timer)
  pending.timer = setTimeout(resolvePendingFrame, FRAME_TIMEOUT_MS)
}

function waitForFrame(timeoutMs: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    pending = {
      buffer: new Uint8Array(0),
      timer: null,
      timeout: setTimeout(() => {
        rejectPending(new Error(`Response timeout after ${timeoutMs} ms`))
      }, timeoutMs),
      resolve,
      reject,
    }
  })
}

function resolvePendingFrame(): void {
  if (!pending) return
  const current = pending
  pending = null
  if (current.timer) clearTimeout(current.timer)
  clearTimeout(current.timeout)
  current.resolve(current.buffer)
}

function rejectPending(error: Error): void {
  if (!pending) return
  const current = pending
  pending = null
  if (current.timer) clearTimeout(current.timer)
  clearTimeout(current.timeout)
  current.reject(error)
}

function describeMasterRequest(request: MasterRequest): string {
  const fcName = FunctionCode[request.functionCode] ?? `FC=${request.functionCode}`
  switch (request.functionCode) {
    case FunctionCode.ReadHoldingRegisters:
    case FunctionCode.ReadInputRegisters:
      return `Master RTU Slave=${request.unitId} ${fcName} Start=${request.startAddress} Qty=${request.quantity}`
    case FunctionCode.WriteSingleRegister:
      return `Master RTU Slave=${request.unitId} ${fcName} Reg=${request.startAddress} Value=${request.value}`
    case FunctionCode.WriteMultipleRegisters:
      return `Master RTU Slave=${request.unitId} ${fcName} Start=${request.startAddress} Qty=${request.values?.length ?? 0}`
    default:
      return `Master RTU Slave=${request.unitId} ${fcName}`
  }
}

function describeMasterResult(result: ModbusMasterResult): string {
  if (!result.ok) {
    if (result.exceptionCode !== undefined) return `Exception ${result.exceptionName} (${result.exceptionCode})`
    return result.error ?? 'Request failed'
  }
  if (result.values) return `Response OK Values=[${result.values.join(', ')}]`
  if (result.address !== undefined && result.value !== undefined) return `Write OK Reg=${result.address} Value=${result.value}`
  if (result.address !== undefined && result.quantity !== undefined) return `Write OK Start=${result.address} Qty=${result.quantity}`
  return 'Response OK'
}

export { isRtuMasterOpen }
