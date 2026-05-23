import net from 'node:net'

const FunctionCode = {
  ReadHoldingRegisters: 0x03,
  ReadInputRegisters: 0x04,
  WriteSingleRegister: 0x06,
  WriteMultipleRegisters: 0x10,
}

const ExceptionName = {
  1: 'Illegal Function',
  2: 'Illegal Data Address',
  3: 'Illegal Data Value',
  4: 'Slave Device Failure',
}

let nextTransactionId = 1

export async function sendModbusTcpRequest(payload) {
  const started = performance.now()
  const host = String(payload.host ?? '').trim()
  const port = ensureInt(payload.port ?? 502, 'Port', 1, 65535)
  const unitId = ensureInt(payload.unitId, 'Unit ID', 0, 247)
  const timeoutMs = ensureInt(payload.timeoutMs ?? 3000, 'Timeout', 100, 120000)
  const transactionId = nextTransactionId++ & 0xFFFF
  const adu = buildTcpAdu({ ...payload, unitId, transactionId })

  if (!host) throw new Error('Host is required')

  const response = await sendTcpFrame(host, port, adu, timeoutMs, transactionId)
  const result = parseTcpResponse(response, unitId, transactionId)

  return {
    ok: result.ok,
    requestHex: toHexString(adu),
    responseHex: toHexString(response),
    elapsedMs: Math.round(performance.now() - started),
    result,
    error: result.error,
  }
}

function buildTcpAdu(request) {
  const pdu = buildPdu(request)
  const length = 1 + pdu.length
  const adu = Buffer.alloc(7 + pdu.length)
  adu[0] = (request.transactionId >> 8) & 0xFF
  adu[1] = request.transactionId & 0xFF
  adu[2] = 0
  adu[3] = 0
  adu[4] = (length >> 8) & 0xFF
  adu[5] = length & 0xFF
  adu[6] = request.unitId & 0xFF
  Buffer.from(pdu).copy(adu, 7)
  return adu
}

function buildPdu(request) {
  const functionCode = ensureInt(request.functionCode, 'Function code', 1, 127)
  const startAddress = ensureInt(request.startAddress, 'Start address', 0, 0xFFFF)

  switch (functionCode) {
    case FunctionCode.ReadHoldingRegisters:
    case FunctionCode.ReadInputRegisters: {
      const quantity = ensureInt(request.quantity, 'Quantity', 1, 125)
      return Buffer.from([
        functionCode,
        (startAddress >> 8) & 0xFF,
        startAddress & 0xFF,
        (quantity >> 8) & 0xFF,
        quantity & 0xFF,
      ])
    }
    case FunctionCode.WriteSingleRegister: {
      const value = ensureInt(request.value, 'Value', 0, 0xFFFF)
      return Buffer.from([
        functionCode,
        (startAddress >> 8) & 0xFF,
        startAddress & 0xFF,
        (value >> 8) & 0xFF,
        value & 0xFF,
      ])
    }
    case FunctionCode.WriteMultipleRegisters: {
      const values = Array.isArray(request.values) ? request.values : []
      ensureInt(values.length, 'Value count', 1, 123)
      const pdu = Buffer.alloc(6 + values.length * 2)
      pdu[0] = functionCode
      pdu[1] = (startAddress >> 8) & 0xFF
      pdu[2] = startAddress & 0xFF
      pdu[3] = (values.length >> 8) & 0xFF
      pdu[4] = values.length & 0xFF
      pdu[5] = values.length * 2
      values.forEach((rawValue, index) => {
        const value = ensureInt(rawValue, `Value ${index + 1}`, 0, 0xFFFF)
        const offset = 6 + index * 2
        pdu[offset] = (value >> 8) & 0xFF
        pdu[offset + 1] = value & 0xFF
      })
      return pdu
    }
    default:
      throw new Error(`Unsupported function code: ${functionCode}`)
  }
}

function sendTcpFrame(host, port, request, timeoutMs, transactionId) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket()
    let buffer = Buffer.alloc(0)
    let settled = false

    const finish = (err, data) => {
      if (settled) return
      settled = true
      socket.destroy()
      if (err) reject(err)
      else resolve(data)
    }

    const timeout = setTimeout(() => {
      finish(new Error(`Response timeout after ${timeoutMs} ms`))
    }, timeoutMs)

    socket.once('error', (err) => {
      clearTimeout(timeout)
      finish(err)
    })

    socket.connect(port, host, () => {
      socket.write(request)
    })

    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk])
      const frame = extractTcpFrame(buffer, transactionId)
      if (frame) {
        clearTimeout(timeout)
        finish(null, frame)
      }
    })

    socket.once('close', () => {
      clearTimeout(timeout)
      if (!settled) finish(new Error('TCP connection closed before a complete response was received'))
    })
  })
}

function extractTcpFrame(buffer, expectedTransactionId) {
  if (buffer.length < 7) return null

  for (let offset = 0; offset <= buffer.length - 7; offset++) {
    const transactionId = (buffer[offset] << 8) | buffer[offset + 1]
    const protocolId = (buffer[offset + 2] << 8) | buffer[offset + 3]
    const length = (buffer[offset + 4] << 8) | buffer[offset + 5]
    const totalLength = 6 + length

    if (transactionId !== expectedTransactionId || protocolId !== 0 || length < 2) continue
    if (buffer.length - offset < totalLength) return null
    return buffer.subarray(offset, offset + totalLength)
  }

  return null
}

function parseTcpResponse(adu, expectedUnitId, expectedTransactionId) {
  if (adu.length < 9) return { ok: false, error: 'TCP response is too short' }

  const transactionId = (adu[0] << 8) | adu[1]
  const protocolId = (adu[2] << 8) | adu[3]
  const length = (adu[4] << 8) | adu[5]
  const unitId = adu[6]

  if (transactionId !== expectedTransactionId) return { ok: false, transactionId, unitId, error: `Unexpected transaction id ${transactionId}` }
  if (protocolId !== 0) return { ok: false, transactionId, unitId, error: `Invalid protocol id ${protocolId}` }
  if (length < 2 || adu.length < 6 + length) return { ok: false, transactionId, unitId, error: 'Invalid MBAP length' }
  if (unitId !== expectedUnitId) return { ok: false, transactionId, unitId, error: `Unexpected unit id ${unitId}` }

  const pdu = adu.subarray(7, 6 + length)
  const functionCode = pdu[0]

  if (functionCode & 0x80) {
    const exceptionCode = pdu[1]
    return {
      ok: false,
      unitId,
      transactionId,
      functionCode: functionCode & 0x7F,
      exceptionCode,
      exceptionName: ExceptionName[exceptionCode] ?? `Exception ${exceptionCode}`,
    }
  }

  switch (functionCode) {
    case FunctionCode.ReadHoldingRegisters:
    case FunctionCode.ReadInputRegisters: {
      if (pdu.length < 3) return { ok: false, unitId, transactionId, functionCode, error: 'Read response is too short' }
      const byteCount = pdu[1]
      if (byteCount % 2 !== 0 || pdu.length !== 2 + byteCount) {
        return { ok: false, unitId, transactionId, functionCode, error: 'Invalid read response byte count' }
      }
      const values = []
      for (let i = 0; i < byteCount / 2; i++) {
        const offset = 2 + i * 2
        values.push((pdu[offset] << 8) | pdu[offset + 1])
      }
      return { ok: true, unitId, transactionId, functionCode, values }
    }
    case FunctionCode.WriteSingleRegister: {
      if (pdu.length !== 5) return { ok: false, unitId, transactionId, functionCode, error: 'Invalid write single response length' }
      return {
        ok: true,
        unitId,
        transactionId,
        functionCode,
        address: (pdu[1] << 8) | pdu[2],
        value: (pdu[3] << 8) | pdu[4],
      }
    }
    case FunctionCode.WriteMultipleRegisters: {
      if (pdu.length !== 5) return { ok: false, unitId, transactionId, functionCode, error: 'Invalid write multiple response length' }
      return {
        ok: true,
        unitId,
        transactionId,
        functionCode,
        address: (pdu[1] << 8) | pdu[2],
        quantity: (pdu[3] << 8) | pdu[4],
      }
    }
    default:
      return { ok: false, unitId, transactionId, functionCode, error: `Unsupported response function code ${functionCode}` }
  }
}

function ensureInt(value, name, min, max) {
  const numericValue = Number(value)
  if (!Number.isInteger(numericValue) || numericValue < min || numericValue > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`)
  }
  return numericValue
}

function toHexString(data) {
  return Array.from(data)
    .map((b) => b.toString(16).toUpperCase().padStart(2, '0'))
    .join(' ')
}
