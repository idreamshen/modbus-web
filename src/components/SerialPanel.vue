<template>
  <v-card>
    <v-card-title class="d-flex align-center">
      <v-icon start>mdi-serial-port</v-icon>
      Serial Port
      <v-spacer />
      <v-chip :color="isOpen ? 'success' : 'grey'" size="small" variant="flat">
        {{ isOpen ? 'Connected' : 'Disconnected' }}
      </v-chip>
    </v-card-title>

    <v-card-text>
      <!-- Browser support warning -->
      <v-alert v-if="!serialSupported" type="error" variant="tonal" density="compact" class="mb-4">
        Web Serial API is not supported in this browser. Please use Chrome, Edge, or Opera.
      </v-alert>

      <v-alert v-if="masterOpen" type="warning" variant="tonal" density="compact" class="mb-4">
        RTU Master is using a serial port. Disconnect Master first before using Slave.
      </v-alert>

      <v-row dense>
        <v-col cols="6">
          <v-select
            v-model="config.baudRate"
            :items="baudRates"
            label="Baud Rate"
            density="compact"
            :disabled="isOpen"
          />
        </v-col>
        <v-col cols="6">
          <v-select
            v-model="config.dataBits"
            :items="[7, 8]"
            label="Data Bits"
            density="compact"
            :disabled="isOpen"
          />
        </v-col>
        <v-col cols="6">
          <v-select
            v-model="config.stopBits"
            :items="[1, 2]"
            label="Stop Bits"
            density="compact"
            :disabled="isOpen"
          />
        </v-col>
        <v-col cols="6">
          <v-select
            v-model="config.parity"
            :items="['none', 'even', 'odd']"
            label="Parity"
            density="compact"
            :disabled="isOpen"
          />
        </v-col>
      </v-row>

      <v-text-field
        v-model.number="store.slaveAddress"
        label="Slave Address"
        type="number"
        min="1"
        max="247"
        density="compact"
        hint="1-247"
        persistent-hint
      />
    </v-card-text>

    <v-card-actions>
      <v-btn
        v-if="!isOpen"
        color="primary"
        variant="flat"
        :disabled="!serialSupported || masterOpen"
        @click="handleConnect"
        :loading="connecting"
        prepend-icon="mdi-connection"
      >
        Connect
      </v-btn>
      <v-btn
        v-else
        color="error"
        variant="flat"
        @click="handleDisconnect"
        prepend-icon="mdi-close-circle"
      >
        Disconnect
      </v-btn>
    </v-card-actions>

    <v-snackbar v-model="showError" color="error" :timeout="5000">
      {{ errorMessage }}
    </v-snackbar>
  </v-card>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { openPort, closePort, isOpen, isSerialSupported } from '../serial/serial-port'
import { isRtuMasterOpen as masterOpen } from '../master/rtu-master'
import { store } from '../store/registers'
import type { SerialConfig } from '../serial/serial-port'

const serialSupported = isSerialSupported()

const baudRates = [1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200]

const config = reactive<SerialConfig>({
  baudRate: 9600,
  dataBits: 8,
  stopBits: 1,
  parity: 'none',
})

const connecting = ref(false)
const showError = ref(false)
const errorMessage = ref('')

async function handleConnect() {
  if (masterOpen.value) {
    errorMessage.value = 'RTU Master is already connected. Disconnect Master first.'
    showError.value = true
    return
  }

  connecting.value = true
  try {
    await openPort(config)
  } catch (err: any) {
    errorMessage.value = err?.message ?? 'Failed to connect'
    showError.value = true
  } finally {
    connecting.value = false
  }
}

async function handleDisconnect() {
  try {
    await closePort()
  } catch (err: any) {
    errorMessage.value = err?.message ?? 'Failed to disconnect'
    showError.value = true
  }
}
</script>
