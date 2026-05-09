import type { RegisterDefinition } from '../modbus/types'
import {
  store,
  clearAllRegisters,
  addHoldingRegister,
  addInputRegister,
} from '../store/registers'

export interface DeviceTemplate {
  id: string
  name: string
  description: string
  slaveAddress: number
  holdingRegisters: RegisterDefinition[]
  inputRegisters: RegisterDefinition[]
}

export const deviceTemplates: DeviceTemplate[] = [
  {
    id: 'temp-humidity',
    name: 'Temperature & Humidity Sensor',
    description: 'Simulates a temp/humidity sensor. Input register 0 = temperature (x10, e.g. 250 = 25.0°C), register 1 = humidity (x10, e.g. 650 = 65.0%RH). Holding register 0 = slave address, register 1 = baud rate code.',
    slaveAddress: 1,
    holdingRegisters: [
      { address: 0, name: 'Slave Address', value: 1, unit: '' },
      { address: 1, name: 'Baud Rate Code', value: 3, unit: '' },
    ],
    inputRegisters: [
      { address: 0, name: 'Temperature', value: 250, unit: '×0.1 °C' },
      { address: 1, name: 'Humidity', value: 650, unit: '×0.1 %RH' },
    ],
  },
  {
    id: 'power-meter',
    name: 'Power Meter',
    description: 'Simulates a simple power meter. Input registers: voltage (×10), current (×100), active power, energy counter. Holding registers for configuration.',
    slaveAddress: 1,
    holdingRegisters: [
      { address: 0, name: 'Slave Address', value: 1, unit: '' },
      { address: 1, name: 'CT Ratio', value: 100, unit: '' },
    ],
    inputRegisters: [
      { address: 0, name: 'Voltage', value: 2200, unit: '×0.1 V' },
      { address: 1, name: 'Current', value: 500, unit: '×0.01 A' },
      { address: 2, name: 'Active Power', value: 1100, unit: 'W' },
      { address: 3, name: 'Energy (Low)', value: 0, unit: 'Wh' },
      { address: 4, name: 'Energy (High)', value: 0, unit: 'Wh' },
    ],
  },
  {
    id: 'generic-10',
    name: 'Generic 10-Register Device',
    description: '10 holding registers and 10 input registers, all initialized to 0. Use as a blank canvas.',
    slaveAddress: 1,
    holdingRegisters: Array.from({ length: 10 }, (_, i) => ({
      address: i,
      name: `Holding ${i}`,
      value: 0,
      unit: '',
    })),
    inputRegisters: Array.from({ length: 10 }, (_, i) => ({
      address: i,
      name: `Input ${i}`,
      value: 0,
      unit: '',
    })),
  },
]

/**
 * Apply a device template to the register store.
 * Clears all existing registers and replaces them with the template's registers.
 */
export function applyTemplate(template: DeviceTemplate): void {
  clearAllRegisters()
  store.slaveAddress = template.slaveAddress

  for (const reg of template.holdingRegisters) {
    addHoldingRegister({ ...reg })
  }
  for (const reg of template.inputRegisters) {
    addInputRegister({ ...reg })
  }
}
