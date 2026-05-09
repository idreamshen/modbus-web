/** Supported Modbus function codes */
export enum FunctionCode {
  ReadHoldingRegisters = 0x03,
  ReadInputRegisters = 0x04,
  WriteSingleRegister = 0x06,
  WriteMultipleRegisters = 0x10,
}

/** Parsed Modbus RTU request */
export interface ModbusRequest {
  slaveAddress: number
  functionCode: FunctionCode
  startAddress: number
  quantity?: number       // for read / write-multiple
  value?: number          // for write-single (0x06)
  values?: number[]       // for write-multiple (0x10)
}

/** Communication log entry */
export interface CommLogEntry {
  timestamp: Date
  direction: 'RX' | 'TX'
  rawHex: string
  summary: string
}

/** Register definition with metadata (for UI display) */
export interface RegisterDefinition {
  address: number
  name: string
  value: number
  unit: string
}

/** Modbus exception codes */
export enum ExceptionCode {
  IllegalFunction = 0x01,
  IllegalDataAddress = 0x02,
  IllegalDataValue = 0x03,
  SlaveDeviceFailure = 0x04,
}

/** Convert a Uint8Array to a hex string for display */
export function toHexString(data: Uint8Array): string {
  return Array.from(data)
    .map(b => b.toString(16).toUpperCase().padStart(2, '0'))
    .join(' ')
}
