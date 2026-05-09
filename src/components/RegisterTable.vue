<template>
  <v-card>
    <v-card-title class="d-flex align-center">
      <v-icon start>mdi-table</v-icon>
      Registers
    </v-card-title>

    <v-card-text>
      <v-tabs v-model="activeTab" density="compact">
        <v-tab value="holding">Holding Registers (FC 03/06/10)</v-tab>
        <v-tab value="input">Input Registers (FC 04)</v-tab>
      </v-tabs>

      <v-tabs-window v-model="activeTab">
        <!-- Holding Registers -->
        <v-tabs-window-item value="holding">
          <v-data-table
            :headers="headers"
            :items="holdingItems"
            density="compact"
            items-per-page="-1"
            class="mt-2"
          >
            <template #item.address="{ item }">
              {{ item.address }} (0x{{ item.address.toString(16).toUpperCase().padStart(4, '0') }})
            </template>
            <template #item.name="{ item }">
              <v-text-field
                v-model="item.name"
                density="compact"
                variant="plain"
                hide-details
                @update:model-value="updateHoldingName(item)"
              />
            </template>
            <template #item.value="{ item }">
              <v-text-field
                :model-value="item.value"
                density="compact"
                variant="plain"
                hide-details
                type="number"
                min="0"
                max="65535"
                @update:model-value="updateHoldingValue(item, $event)"
              />
            </template>
            <template #item.hex="{ item }">
              0x{{ item.value.toString(16).toUpperCase().padStart(4, '0') }}
            </template>
            <template #item.unit="{ item }">
              <v-text-field
                v-model="item.unit"
                density="compact"
                variant="plain"
                hide-details
                @update:model-value="updateHoldingUnit(item)"
              />
            </template>
            <template #item.actions="{ item }">
              <v-btn icon="mdi-delete" size="x-small" variant="text" color="error" @click="removeHolding(item.address)" />
            </template>
            <template #bottom>
              <div class="d-flex align-center pa-2 ga-2">
                <v-text-field
                  v-model.number="newHoldingAddress"
                  label="Address"
                  type="number"
                  min="0"
                  max="65535"
                  density="compact"
                  hide-details
                  style="max-width: 120px"
                />
                <v-btn size="small" color="primary" variant="tonal" @click="addHolding" prepend-icon="mdi-plus">
                  Add Register
                </v-btn>
              </div>
            </template>
          </v-data-table>
        </v-tabs-window-item>

        <!-- Input Registers -->
        <v-tabs-window-item value="input">
          <v-data-table
            :headers="headers"
            :items="inputItems"
            density="compact"
            items-per-page="-1"
            class="mt-2"
          >
            <template #item.address="{ item }">
              {{ item.address }} (0x{{ item.address.toString(16).toUpperCase().padStart(4, '0') }})
            </template>
            <template #item.name="{ item }">
              <v-text-field
                v-model="item.name"
                density="compact"
                variant="plain"
                hide-details
                @update:model-value="updateInputName(item)"
              />
            </template>
            <template #item.value="{ item }">
              <v-text-field
                :model-value="item.value"
                density="compact"
                variant="plain"
                hide-details
                type="number"
                min="0"
                max="65535"
                @update:model-value="updateInputValue(item, $event)"
              />
            </template>
            <template #item.hex="{ item }">
              0x{{ item.value.toString(16).toUpperCase().padStart(4, '0') }}
            </template>
            <template #item.unit="{ item }">
              <v-text-field
                v-model="item.unit"
                density="compact"
                variant="plain"
                hide-details
                @update:model-value="updateInputUnit(item)"
              />
            </template>
            <template #item.actions="{ item }">
              <v-btn icon="mdi-delete" size="x-small" variant="text" color="error" @click="removeInput(item.address)" />
            </template>
            <template #bottom>
              <div class="d-flex align-center pa-2 ga-2">
                <v-text-field
                  v-model.number="newInputAddress"
                  label="Address"
                  type="number"
                  min="0"
                  max="65535"
                  density="compact"
                  hide-details
                  style="max-width: 120px"
                />
                <v-btn size="small" color="primary" variant="tonal" @click="addInput" prepend-icon="mdi-plus">
                  Add Register
                </v-btn>
              </div>
            </template>
          </v-data-table>
        </v-tabs-window-item>
      </v-tabs-window>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  store,
  addHoldingRegister,
  removeHoldingRegister,
  setHoldingRegister,
  addInputRegister,
  removeInputRegister,
  setInputRegister,
} from '../store/registers'
import type { RegisterDefinition } from '../modbus/types'

const activeTab = ref('holding')
const newHoldingAddress = ref(0)
const newInputAddress = ref(0)

const headers = [
  { title: 'Address', key: 'address', width: '160px' },
  { title: 'Name', key: 'name' },
  { title: 'Value (Dec)', key: 'value', width: '140px' },
  { title: 'Value (Hex)', key: 'hex', width: '120px' },
  { title: 'Unit', key: 'unit', width: '120px' },
  { title: '', key: 'actions', width: '50px', sortable: false },
]

const holdingItems = computed(() => store.holdingRegisters)
const inputItems = computed(() => store.inputRegisters)

// --- Holding register operations ---

function updateHoldingValue(item: RegisterDefinition, val: string | number) {
  const num = typeof val === 'string' ? parseInt(val, 10) : val
  if (!isNaN(num)) {
    setHoldingRegister(item.address, Math.max(0, Math.min(65535, num)))
  }
}

function updateHoldingName(item: RegisterDefinition) {
  const reg = store.holdingRegisters.find(r => r.address === item.address)
  if (reg) reg.name = item.name
}

function updateHoldingUnit(item: RegisterDefinition) {
  const reg = store.holdingRegisters.find(r => r.address === item.address)
  if (reg) reg.unit = item.unit
}

function addHolding() {
  addHoldingRegister({
    address: newHoldingAddress.value,
    name: `Holding ${newHoldingAddress.value}`,
    value: 0,
    unit: '',
  })
}

function removeHolding(address: number) {
  removeHoldingRegister(address)
}

// --- Input register operations ---

function updateInputValue(item: RegisterDefinition, val: string | number) {
  const num = typeof val === 'string' ? parseInt(val, 10) : val
  if (!isNaN(num)) {
    setInputRegister(item.address, Math.max(0, Math.min(65535, num)))
  }
}

function updateInputName(item: RegisterDefinition) {
  const reg = store.inputRegisters.find(r => r.address === item.address)
  if (reg) reg.name = item.name
}

function updateInputUnit(item: RegisterDefinition) {
  const reg = store.inputRegisters.find(r => r.address === item.address)
  if (reg) reg.unit = item.unit
}

function addInput() {
  addInputRegister({
    address: newInputAddress.value,
    name: `Input ${newInputAddress.value}`,
    value: 0,
    unit: '',
  })
}

function removeInput(address: number) {
  removeInputRegister(address)
}
</script>
