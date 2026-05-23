import { addLogEntry } from '../store/registers'
import { toHexString, type ModbusMasterResult } from '../modbus/types'
import type { MasterRequest, MasterResponse, TcpConfig } from './types'

interface TcpProxyResponse {
  ok: boolean
  requestHex: string
  responseHex?: string
  elapsedMs: number
  result?: ModbusMasterResult
  error?: string
}

export async function sendTcpMasterRequest(config: TcpConfig, request: MasterRequest): Promise<MasterResponse> {
  const response = await fetch('/api/modbus-tcp/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...config, ...request }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `TCP proxy request failed: HTTP ${response.status}`)
  }

  const data = (await response.json()) as TcpProxyResponse

  addLogEntry({
    timestamp: new Date(),
    direction: 'TX',
    rawHex: data.requestHex,
    summary: `Master TCP ${config.host}:${config.port} Unit=${request.unitId}`,
    role: 'master',
    protocol: 'tcp',
  })

  if (data.responseHex) {
    addLogEntry({
      timestamp: new Date(),
      direction: 'RX',
      rawHex: data.responseHex,
      summary: describeTcpResult(data.result),
      role: 'master',
      protocol: 'tcp',
    })
  }

  return data
}

function describeTcpResult(result?: ModbusMasterResult): string {
  if (!result) return 'No response'
  if (!result.ok) {
    if (result.exceptionCode !== undefined) return `Exception ${result.exceptionName} (${result.exceptionCode})`
    return result.error ?? 'Request failed'
  }
  if (result.values) return `Response OK Values=[${result.values.join(', ')}]`
  if (result.address !== undefined && result.value !== undefined) return `Write OK Reg=${result.address} Value=${result.value}`
  if (result.address !== undefined && result.quantity !== undefined) return `Write OK Start=${result.address} Qty=${result.quantity}`
  return 'Response OK'
}

export function hexToBytes(hex: string): Uint8Array {
  const cleaned = hex.replace(/[^0-9a-fA-F]/g, '')
  const bytes = new Uint8Array(Math.floor(cleaned.length / 2))
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(cleaned.slice(i * 2, i * 2 + 2), 16)
  return bytes
}

export function bytesToHex(data: Uint8Array): string {
  return toHexString(data)
}
