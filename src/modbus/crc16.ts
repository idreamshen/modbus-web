/**
 * Modbus CRC16 calculation (polynomial 0xA001, initial value 0xFFFF)
 */

export function crc16(buffer: Uint8Array): number {
  let crc = 0xFFFF

  for (let i = 0; i < buffer.length; i++) {
    crc ^= buffer[i]
    for (let j = 0; j < 8; j++) {
      if (crc & 0x0001) {
        crc = (crc >> 1) ^ 0xA001
      } else {
        crc = crc >> 1
      }
    }
  }

  return crc & 0xFFFF
}

/** Append CRC16 (low byte first, then high byte) to a buffer */
export function appendCrc(buffer: Uint8Array): Uint8Array {
  const crc = crc16(buffer)
  const result = new Uint8Array(buffer.length + 2)
  result.set(buffer)
  result[buffer.length] = crc & 0xFF       // CRC low byte
  result[buffer.length + 1] = (crc >> 8) & 0xFF  // CRC high byte
  return result
}

/** Verify CRC16 of a complete Modbus RTU frame (last 2 bytes are CRC) */
export function verifyCrc(frame: Uint8Array): boolean {
  if (frame.length < 4) return false
  const data = frame.slice(0, frame.length - 2)
  const receivedCrc = frame[frame.length - 2] | (frame[frame.length - 1] << 8)
  return crc16(data) === receivedCrc
}
