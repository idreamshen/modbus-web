import { buildPdu, type MasterPduRequest } from './pdu'

export interface TcpMasterRequest extends MasterPduRequest {
  unitId: number
  transactionId?: number
}

function ensureUnitId(unitId: number): number {
  if (!Number.isInteger(unitId) || unitId < 0 || unitId > 247) {
    throw new Error('Unit ID must be an integer between 0 and 247')
  }
  return unitId & 0xFF
}

/** Build a Modbus TCP ADU: MBAP(7 bytes) + PDU */
export function buildTcpAdu(request: TcpMasterRequest): Uint8Array {
  const pdu = buildPdu(request)
  const transactionId = request.transactionId ?? Math.floor(Math.random() * 0x10000)
  const unitId = ensureUnitId(request.unitId)
  const length = 1 + pdu.length // Unit ID + PDU
  const adu = new Uint8Array(7 + pdu.length)

  adu[0] = (transactionId >> 8) & 0xFF
  adu[1] = transactionId & 0xFF
  adu[2] = 0
  adu[3] = 0
  adu[4] = (length >> 8) & 0xFF
  adu[5] = length & 0xFF
  adu[6] = unitId
  adu.set(pdu, 7)

  return adu
}

export function getTcpTransactionId(adu: Uint8Array): number {
  if (adu.length < 2) return 0
  return (adu[0] << 8) | adu[1]
}

export function getTcpPdu(adu: Uint8Array): Uint8Array | null {
  if (adu.length < 8) return null
  const protocolId = (adu[2] << 8) | adu[3]
  const length = (adu[4] << 8) | adu[5]
  if (protocolId !== 0) return null
  if (length < 2) return null
  if (adu.length < 6 + length) return null
  return adu.slice(7, 6 + length)
}
