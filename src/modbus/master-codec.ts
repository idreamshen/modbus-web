import { appendCrc } from './crc16'
import { buildPdu, type MasterPduRequest } from './pdu'

export interface RtuMasterRequest extends MasterPduRequest {
  slaveId: number
}

function ensureUnitId(unitId: number, name = 'Slave ID'): number {
  if (!Number.isInteger(unitId) || unitId < 1 || unitId > 247) {
    throw new Error(`${name} must be an integer between 1 and 247`)
  }
  return unitId & 0xFF
}

/** Build a complete Modbus RTU ADU: [slaveId, pdu..., crcLo, crcHi] */
export function buildRtuAdu(request: RtuMasterRequest): Uint8Array {
  const slaveId = ensureUnitId(request.slaveId)
  const pdu = buildPdu(request)
  const aduWithoutCrc = new Uint8Array(1 + pdu.length)
  aduWithoutCrc[0] = slaveId
  aduWithoutCrc.set(pdu, 1)
  return appendCrc(aduWithoutCrc)
}
