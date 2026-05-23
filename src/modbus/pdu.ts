import { FunctionCode } from './types'

export interface MasterPduRequest {
  functionCode: FunctionCode
  startAddress: number
  quantity?: number
  value?: number
  values?: number[]
}

function ensureUInt16(value: number, name: string): number {
  if (!Number.isInteger(value) || value < 0 || value > 0xFFFF) {
    throw new Error(`${name} must be an integer between 0 and 65535`)
  }
  return value & 0xFFFF
}

function ensureQuantity(value: number | undefined, max: number, name = 'Quantity'): number {
  if (!Number.isInteger(value) || (value ?? 0) < 1 || (value ?? 0) > max) {
    throw new Error(`${name} must be an integer between 1 and ${max}`)
  }
  return value as number
}

/** Build a Modbus PDU: [functionCode, data...] */
export function buildPdu(request: MasterPduRequest): Uint8Array {
  switch (request.functionCode) {
    case FunctionCode.ReadHoldingRegisters:
    case FunctionCode.ReadInputRegisters:
      return buildReadRegistersPdu(
        request.functionCode,
        request.startAddress,
        ensureQuantity(request.quantity, 125)
      )
    case FunctionCode.WriteSingleRegister:
      if (request.value === undefined) throw new Error('Value is required')
      return buildWriteSingleRegisterPdu(request.startAddress, request.value)
    case FunctionCode.WriteMultipleRegisters:
      if (!request.values?.length) throw new Error('Values are required')
      return buildWriteMultipleRegistersPdu(request.startAddress, request.values)
    default:
      throw new Error(`Unsupported function code: ${request.functionCode}`)
  }
}

export function buildReadRegistersPdu(
  functionCode: FunctionCode.ReadHoldingRegisters | FunctionCode.ReadInputRegisters,
  startAddress: number,
  quantity: number
): Uint8Array {
  ensureUInt16(startAddress, 'Start address')
  ensureQuantity(quantity, 125)

  return new Uint8Array([
    functionCode,
    (startAddress >> 8) & 0xFF,
    startAddress & 0xFF,
    (quantity >> 8) & 0xFF,
    quantity & 0xFF,
  ])
}

export function buildWriteSingleRegisterPdu(startAddress: number, value: number): Uint8Array {
  ensureUInt16(startAddress, 'Start address')
  ensureUInt16(value, 'Value')

  return new Uint8Array([
    FunctionCode.WriteSingleRegister,
    (startAddress >> 8) & 0xFF,
    startAddress & 0xFF,
    (value >> 8) & 0xFF,
    value & 0xFF,
  ])
}

export function buildWriteMultipleRegistersPdu(startAddress: number, values: number[]): Uint8Array {
  ensureUInt16(startAddress, 'Start address')
  ensureQuantity(values.length, 123, 'Value count')

  const byteCount = values.length * 2
  const pdu = new Uint8Array(6 + byteCount)
  pdu[0] = FunctionCode.WriteMultipleRegisters
  pdu[1] = (startAddress >> 8) & 0xFF
  pdu[2] = startAddress & 0xFF
  pdu[3] = (values.length >> 8) & 0xFF
  pdu[4] = values.length & 0xFF
  pdu[5] = byteCount

  values.forEach((rawValue, index) => {
    const value = ensureUInt16(rawValue, `Value ${index + 1}`)
    const offset = 6 + index * 2
    pdu[offset] = (value >> 8) & 0xFF
    pdu[offset + 1] = value & 0xFF
  })

  return pdu
}
