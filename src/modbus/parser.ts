import { verifyCrc } from './crc16'
import { FunctionCode, type ModbusRequest } from './types'

const VALID_FUNCTION_CODES = new Set<number>([
  FunctionCode.ReadHoldingRegisters,
  FunctionCode.ReadInputRegisters,
  FunctionCode.WriteSingleRegister,
  FunctionCode.WriteMultipleRegisters,
])

/**
 * Parse a complete Modbus RTU frame into a ModbusRequest.
 * Returns null if the frame is invalid (bad CRC, too short, etc.)
 */
export function parseRequest(frame: Uint8Array): ModbusRequest | null {
  // Minimum frame: slave(1) + fc(1) + data(2+) + crc(2) = 6 bytes
  if (frame.length < 6) return null

  if (!verifyCrc(frame)) return null

  const slaveAddress = frame[0]
  const functionCode = frame[1]

  if (!VALID_FUNCTION_CODES.has(functionCode)) return null

  switch (functionCode) {
    case FunctionCode.ReadHoldingRegisters:
    case FunctionCode.ReadInputRegisters:
      return parseReadRequest(frame, slaveAddress, functionCode)

    case FunctionCode.WriteSingleRegister:
      return parseWriteSingleRequest(frame, slaveAddress)

    case FunctionCode.WriteMultipleRegisters:
      return parseWriteMultipleRequest(frame, slaveAddress)

    default:
      return null
  }
}

/**
 * Parse Read Holding/Input Registers request
 * Frame: [slave, fc, startHi, startLo, quantityHi, quantityLo, crcLo, crcHi]
 */
function parseReadRequest(
  frame: Uint8Array,
  slaveAddress: number,
  functionCode: FunctionCode
): ModbusRequest | null {
  if (frame.length !== 8) return null

  const startAddress = (frame[2] << 8) | frame[3]
  const quantity = (frame[4] << 8) | frame[5]

  if (quantity < 1 || quantity > 125) return null

  return { slaveAddress, functionCode, startAddress, quantity }
}

/**
 * Parse Write Single Register request
 * Frame: [slave, fc, regHi, regLo, valueHi, valueLo, crcLo, crcHi]
 */
function parseWriteSingleRequest(
  frame: Uint8Array,
  slaveAddress: number
): ModbusRequest | null {
  if (frame.length !== 8) return null

  const startAddress = (frame[2] << 8) | frame[3]
  const value = (frame[4] << 8) | frame[5]

  return {
    slaveAddress,
    functionCode: FunctionCode.WriteSingleRegister,
    startAddress,
    value,
  }
}

/**
 * Parse Write Multiple Registers request
 * Frame: [slave, fc, startHi, startLo, quantityHi, quantityLo, byteCount, val1Hi, val1Lo, ..., crcLo, crcHi]
 */
function parseWriteMultipleRequest(
  frame: Uint8Array,
  slaveAddress: number
): ModbusRequest | null {
  if (frame.length < 11) return null

  const startAddress = (frame[2] << 8) | frame[3]
  const quantity = (frame[4] << 8) | frame[5]
  const byteCount = frame[6]

  if (quantity < 1 || quantity > 123) return null
  if (byteCount !== quantity * 2) return null
  if (frame.length !== 7 + byteCount + 2) return null

  const values: number[] = []
  for (let i = 0; i < quantity; i++) {
    const offset = 7 + i * 2
    values.push((frame[offset] << 8) | frame[offset + 1])
  }

  return {
    slaveAddress,
    functionCode: FunctionCode.WriteMultipleRegisters,
    startAddress,
    quantity,
    values,
  }
}
