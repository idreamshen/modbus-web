import type { FunctionCode, MasterProtocol, ModbusMasterResult } from '../modbus/types'
import type { SerialConfig } from '../serial/serial-port'

export interface MasterRequest {
  protocol: MasterProtocol
  unitId: number
  functionCode: FunctionCode
  startAddress: number
  quantity?: number
  value?: number
  values?: number[]
  timeoutMs: number
}

export interface TcpConfig {
  host: string
  port: number
}

export type RtuMasterConfig = SerialConfig

export interface MasterResponse {
  ok: boolean
  requestHex: string
  responseHex?: string
  elapsedMs: number
  result?: ModbusMasterResult
  error?: string
}
