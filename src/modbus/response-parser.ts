import { verifyCrc } from './crc16'
import { getTcpPdu } from './tcp-codec'
import { ExceptionCode, FunctionCode, type ModbusMasterResult } from './types'

export function getExceptionName(code: number): string {
  switch (code) {
    case ExceptionCode.IllegalFunction:
      return 'Illegal Function'
    case ExceptionCode.IllegalDataAddress:
      return 'Illegal Data Address'
    case ExceptionCode.IllegalDataValue:
      return 'Illegal Data Value'
    case ExceptionCode.SlaveDeviceFailure:
      return 'Slave Device Failure'
    default:
      return `Exception ${code}`
  }
}

export function parseRtuResponse(frame: Uint8Array, expectedSlaveId?: number): ModbusMasterResult {
  if (frame.length < 5) return { ok: false, error: 'Response frame is too short' }
  if (!verifyCrc(frame)) return { ok: false, error: 'Invalid CRC' }

  const slaveId = frame[0]
  if (expectedSlaveId !== undefined && slaveId !== expectedSlaveId) {
    return { ok: false, slaveId, error: `Unexpected slave id ${slaveId}` }
  }

  const pdu = frame.slice(1, frame.length - 2)
  return parseResponsePdu(pdu, slaveId)
}

export function parseTcpResponse(adu: Uint8Array, expectedUnitId?: number, expectedTransactionId?: number): ModbusMasterResult {
  if (adu.length < 9) return { ok: false, error: 'TCP response is too short' }

  const transactionId = (adu[0] << 8) | adu[1]
  const protocolId = (adu[2] << 8) | adu[3]
  const length = (adu[4] << 8) | adu[5]
  const unitId = adu[6]

  if (expectedTransactionId !== undefined && transactionId !== expectedTransactionId) {
    return { ok: false, unitId, transactionId, error: `Unexpected transaction id ${transactionId}` }
  }
  if (protocolId !== 0) return { ok: false, unitId, transactionId, error: `Invalid protocol id ${protocolId}` }
  if (length < 2 || adu.length < 6 + length) {
    return { ok: false, unitId, transactionId, error: 'Invalid MBAP length' }
  }
  if (expectedUnitId !== undefined && unitId !== expectedUnitId) {
    return { ok: false, unitId, transactionId, error: `Unexpected unit id ${unitId}` }
  }

  const pdu = getTcpPdu(adu)
  if (!pdu) return { ok: false, unitId, transactionId, error: 'Invalid TCP PDU' }

  return { ...parseResponsePdu(pdu, unitId), transactionId }
}

export function parseResponsePdu(pdu: Uint8Array, unitId?: number): ModbusMasterResult {
  if (pdu.length < 2) return { ok: false, unitId, error: 'PDU is too short' }

  const functionCode = pdu[0]

  if (functionCode & 0x80) {
    const originalFunctionCode = functionCode & 0x7F
    const exceptionCode = pdu[1]
    return {
      ok: false,
      unitId,
      functionCode: originalFunctionCode,
      exceptionCode,
      exceptionName: getExceptionName(exceptionCode),
    }
  }

  switch (functionCode) {
    case FunctionCode.ReadHoldingRegisters:
    case FunctionCode.ReadInputRegisters:
      return parseReadRegistersResponse(pdu, unitId, functionCode)
    case FunctionCode.WriteSingleRegister:
      return parseWriteSingleRegisterResponse(pdu, unitId)
    case FunctionCode.WriteMultipleRegisters:
      return parseWriteMultipleRegistersResponse(pdu, unitId)
    default:
      return { ok: false, unitId, functionCode, error: `Unsupported response function code ${functionCode}` }
  }
}

function parseReadRegistersResponse(pdu: Uint8Array, unitId: number | undefined, functionCode: FunctionCode): ModbusMasterResult {
  if (pdu.length < 3) return { ok: false, unitId, functionCode, error: 'Read response is too short' }
  const byteCount = pdu[1]
  if (byteCount % 2 !== 0) return { ok: false, unitId, functionCode, error: 'Byte count is not even' }
  if (pdu.length !== 2 + byteCount) {
    return { ok: false, unitId, functionCode, error: 'Read response length does not match byte count' }
  }

  const values: number[] = []
  for (let i = 0; i < byteCount / 2; i++) {
    const offset = 2 + i * 2
    values.push((pdu[offset] << 8) | pdu[offset + 1])
  }

  return { ok: true, unitId, functionCode, values }
}

function parseWriteSingleRegisterResponse(pdu: Uint8Array, unitId?: number): ModbusMasterResult {
  if (pdu.length !== 5) {
    return { ok: false, unitId, functionCode: FunctionCode.WriteSingleRegister, error: 'Write single response length is invalid' }
  }

  return {
    ok: true,
    unitId,
    functionCode: FunctionCode.WriteSingleRegister,
    address: (pdu[1] << 8) | pdu[2],
    value: (pdu[3] << 8) | pdu[4],
  }
}

function parseWriteMultipleRegistersResponse(pdu: Uint8Array, unitId?: number): ModbusMasterResult {
  if (pdu.length !== 5) {
    return { ok: false, unitId, functionCode: FunctionCode.WriteMultipleRegisters, error: 'Write multiple response length is invalid' }
  }

  return {
    ok: true,
    unitId,
    functionCode: FunctionCode.WriteMultipleRegisters,
    address: (pdu[1] << 8) | pdu[2],
    quantity: (pdu[3] << 8) | pdu[4],
  }
}
