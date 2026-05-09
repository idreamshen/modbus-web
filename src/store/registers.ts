import { reactive, ref } from 'vue'
import type { RegisterDefinition, CommLogEntry } from '../modbus/types'

export interface RegisterStore {
  slaveAddress: number
  holdingRegisters: RegisterDefinition[]
  inputRegisters: RegisterDefinition[]
  commLog: CommLogEntry[]
}

const store = reactive<RegisterStore>({
  slaveAddress: 1,
  holdingRegisters: [],
  inputRegisters: [],
  commLog: [],
})

/** Maximum number of log entries to keep */
const MAX_LOG_ENTRIES = 200

// --- Holding Registers ---

export function getHoldingRegisters(start: number, count: number): number[] {
  const result: number[] = []
  for (let i = 0; i < count; i++) {
    const reg = store.holdingRegisters.find(r => r.address === start + i)
    result.push(reg ? reg.value : 0)
  }
  return result
}

export function setHoldingRegister(address: number, value: number): void {
  const reg = store.holdingRegisters.find(r => r.address === address)
  if (reg) {
    reg.value = value & 0xFFFF
  }
}

export function setHoldingRegisters(start: number, values: number[]): void {
  for (let i = 0; i < values.length; i++) {
    setHoldingRegister(start + i, values[i])
  }
}

export function hasHoldingRegisterRange(start: number, count: number): boolean {
  for (let i = 0; i < count; i++) {
    if (!store.holdingRegisters.find(r => r.address === start + i)) {
      return false
    }
  }
  return true
}

export function addHoldingRegister(reg: RegisterDefinition): void {
  const existing = store.holdingRegisters.find(r => r.address === reg.address)
  if (existing) {
    existing.name = reg.name
    existing.value = reg.value & 0xFFFF
    existing.unit = reg.unit
  } else {
    store.holdingRegisters.push({ ...reg, value: reg.value & 0xFFFF })
    store.holdingRegisters.sort((a, b) => a.address - b.address)
  }
}

export function removeHoldingRegister(address: number): void {
  const idx = store.holdingRegisters.findIndex(r => r.address === address)
  if (idx >= 0) store.holdingRegisters.splice(idx, 1)
}

// --- Input Registers ---

export function getInputRegisters(start: number, count: number): number[] {
  const result: number[] = []
  for (let i = 0; i < count; i++) {
    const reg = store.inputRegisters.find(r => r.address === start + i)
    result.push(reg ? reg.value : 0)
  }
  return result
}

export function setInputRegister(address: number, value: number): void {
  const reg = store.inputRegisters.find(r => r.address === address)
  if (reg) {
    reg.value = value & 0xFFFF
  }
}

export function hasInputRegisterRange(start: number, count: number): boolean {
  for (let i = 0; i < count; i++) {
    if (!store.inputRegisters.find(r => r.address === start + i)) {
      return false
    }
  }
  return true
}

export function addInputRegister(reg: RegisterDefinition): void {
  const existing = store.inputRegisters.find(r => r.address === reg.address)
  if (existing) {
    existing.name = reg.name
    existing.value = reg.value & 0xFFFF
    existing.unit = reg.unit
  } else {
    store.inputRegisters.push({ ...reg, value: reg.value & 0xFFFF })
    store.inputRegisters.sort((a, b) => a.address - b.address)
  }
}

export function removeInputRegister(address: number): void {
  const idx = store.inputRegisters.findIndex(r => r.address === address)
  if (idx >= 0) store.inputRegisters.splice(idx, 1)
}

// --- Communication Log ---

export function addLogEntry(entry: CommLogEntry): void {
  store.commLog.push(entry)
  if (store.commLog.length > MAX_LOG_ENTRIES) {
    store.commLog.splice(0, store.commLog.length - MAX_LOG_ENTRIES)
  }
}

export function clearLog(): void {
  store.commLog.splice(0, store.commLog.length)
}

// --- Bulk Operations ---

export function clearAllRegisters(): void {
  store.holdingRegisters.splice(0, store.holdingRegisters.length)
  store.inputRegisters.splice(0, store.inputRegisters.length)
}

export function initDefaultRegisters(): void {
  clearAllRegisters()
  for (let i = 0; i < 10; i++) {
    addHoldingRegister({ address: i, name: `Holding ${i}`, value: 0, unit: '' })
    addInputRegister({ address: i, name: `Input ${i}`, value: 0, unit: '' })
  }
}

export { store }
