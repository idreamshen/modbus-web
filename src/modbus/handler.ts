import { appendCrc } from './crc16'
import { ExceptionCode, FunctionCode, type ModbusRequest } from './types'
import {
  getHoldingRegisters,
  getInputRegisters,
  setHoldingRegister,
  setHoldingRegisters,
  hasHoldingRegisterRange,
  hasInputRegisterRange,
} from '../store/registers'

/**
 * Build a Modbus exception response frame
 */
function buildExceptionResponse(
  slaveAddress: number,
  functionCode: number,
  exceptionCode: ExceptionCode
): Uint8Array {
  const pdu = new Uint8Array([
    slaveAddress,
    functionCode | 0x80,  // Set error bit
    exceptionCode,
  ])
  return appendCrc(pdu)
}

/**
 * Handle a parsed Modbus request and return the response frame (with CRC).
 */
export function handleRequest(request: ModbusRequest): Uint8Array {
  switch (request.functionCode) {
    case FunctionCode.ReadHoldingRegisters:
      return handleReadHoldingRegisters(request)
    case FunctionCode.ReadInputRegisters:
      return handleReadInputRegisters(request)
    case FunctionCode.WriteSingleRegister:
      return handleWriteSingleRegister(request)
    case FunctionCode.WriteMultipleRegisters:
      return handleWriteMultipleRegisters(request)
    default:
      return buildExceptionResponse(
        request.slaveAddress,
        request.functionCode,
        ExceptionCode.IllegalFunction
      )
  }
}

/**
 * FC 0x03: Read Holding Registers
 * Response: [slave, fc, byteCount, reg1Hi, reg1Lo, ..., crcLo, crcHi]
 */
function handleReadHoldingRegisters(request: ModbusRequest): Uint8Array {
  const { slaveAddress, startAddress, quantity } = request
  const count = quantity ?? 1

  if (!hasHoldingRegisterRange(startAddress, count)) {
    return buildExceptionResponse(slaveAddress, FunctionCode.ReadHoldingRegisters, ExceptionCode.IllegalDataAddress)
  }

  const values = getHoldingRegisters(startAddress, count)
  const byteCount = count * 2
  const pdu = new Uint8Array(3 + byteCount)
  pdu[0] = slaveAddress
  pdu[1] = FunctionCode.ReadHoldingRegisters
  pdu[2] = byteCount

  for (let i = 0; i < count; i++) {
    pdu[3 + i * 2] = (values[i] >> 8) & 0xFF
    pdu[3 + i * 2 + 1] = values[i] & 0xFF
  }

  return appendCrc(pdu)
}

/**
 * FC 0x04: Read Input Registers
 * Response: [slave, fc, byteCount, reg1Hi, reg1Lo, ..., crcLo, crcHi]
 */
function handleReadInputRegisters(request: ModbusRequest): Uint8Array {
  const { slaveAddress, startAddress, quantity } = request
  const count = quantity ?? 1

  if (!hasInputRegisterRange(startAddress, count)) {
    return buildExceptionResponse(slaveAddress, FunctionCode.ReadInputRegisters, ExceptionCode.IllegalDataAddress)
  }

  const values = getInputRegisters(startAddress, count)
  const byteCount = count * 2
  const pdu = new Uint8Array(3 + byteCount)
  pdu[0] = slaveAddress
  pdu[1] = FunctionCode.ReadInputRegisters
  pdu[2] = byteCount

  for (let i = 0; i < count; i++) {
    pdu[3 + i * 2] = (values[i] >> 8) & 0xFF
    pdu[3 + i * 2 + 1] = values[i] & 0xFF
  }

  return appendCrc(pdu)
}

/**
 * FC 0x06: Write Single Register
 * Response: echo of request (slave, fc, regHi, regLo, valHi, valLo, crcLo, crcHi)
 */
function handleWriteSingleRegister(request: ModbusRequest): Uint8Array {
  const { slaveAddress, startAddress, value } = request
  const writeValue = value ?? 0

  if (!hasHoldingRegisterRange(startAddress, 1)) {
    return buildExceptionResponse(slaveAddress, FunctionCode.WriteSingleRegister, ExceptionCode.IllegalDataAddress)
  }

  setHoldingRegister(startAddress, writeValue)

  const pdu = new Uint8Array([
    slaveAddress,
    FunctionCode.WriteSingleRegister,
    (startAddress >> 8) & 0xFF,
    startAddress & 0xFF,
    (writeValue >> 8) & 0xFF,
    writeValue & 0xFF,
  ])
  return appendCrc(pdu)
}

/**
 * FC 0x10: Write Multiple Registers
 * Response: [slave, fc, startHi, startLo, quantityHi, quantityLo, crcLo, crcHi]
 */
function handleWriteMultipleRegisters(request: ModbusRequest): Uint8Array {
  const { slaveAddress, startAddress, quantity, values } = request
  const count = quantity ?? 0
  const writeValues = values ?? []

  if (!hasHoldingRegisterRange(startAddress, count)) {
    return buildExceptionResponse(slaveAddress, FunctionCode.WriteMultipleRegisters, ExceptionCode.IllegalDataAddress)
  }

  if (writeValues.length !== count) {
    return buildExceptionResponse(slaveAddress, FunctionCode.WriteMultipleRegisters, ExceptionCode.IllegalDataValue)
  }

  setHoldingRegisters(startAddress, writeValues)

  const pdu = new Uint8Array([
    slaveAddress,
    FunctionCode.WriteMultipleRegisters,
    (startAddress >> 8) & 0xFF,
    startAddress & 0xFF,
    (count >> 8) & 0xFF,
    count & 0xFF,
  ])
  return appendCrc(pdu)
}
