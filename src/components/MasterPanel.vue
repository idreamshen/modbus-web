<template>
  <v-card>
    <v-card-title class="d-flex align-center">
      <v-icon start>mdi-access-point-network</v-icon>
      Modbus Master
      <v-spacer />
      <v-chip :color="connected ? 'success' : 'grey'" size="small" variant="flat">
        {{ statusText }}
      </v-chip>
    </v-card-title>

    <v-card-text>
      <v-alert v-if="protocol === 'tcp'" type="info" variant="tonal" density="compact" class="mb-4">
        Modbus TCP requires the local proxy server. Run <code>npm run proxy</code> in another terminal.
      </v-alert>

      <v-alert v-if="protocol === 'rtu' && !rtuSupported" type="error" variant="tonal" density="compact" class="mb-4">
        Web Serial API is not supported in this browser. Please use Chrome, Edge, or Opera.
      </v-alert>

      <v-alert v-if="protocol === 'rtu' && isRtuSlaveOpen" type="warning" variant="tonal" density="compact" class="mb-4">
        RTU Slave is using a serial port. Disconnect Slave first before using RTU Master.
      </v-alert>

      <v-row dense>
        <v-col cols="12" md="4">
          <v-select
            v-model="protocol"
            :items="protocolItems"
            label="Protocol"
            density="compact"
            :disabled="isRtuMasterOpen"
          />
        </v-col>
      </v-row>

      <v-divider class="my-3" />

      <template v-if="protocol === 'rtu'">
        <v-row dense>
          <v-col cols="6" md="3">
            <v-select v-model="rtuConfig.baudRate" :items="baudRates" label="Baud Rate" density="compact" :disabled="isRtuMasterOpen" />
          </v-col>
          <v-col cols="6" md="3">
            <v-select v-model="rtuConfig.dataBits" :items="[7, 8]" label="Data Bits" density="compact" :disabled="isRtuMasterOpen" />
          </v-col>
          <v-col cols="6" md="3">
            <v-select v-model="rtuConfig.stopBits" :items="[1, 2]" label="Stop Bits" density="compact" :disabled="isRtuMasterOpen" />
          </v-col>
          <v-col cols="6" md="3">
            <v-select v-model="rtuConfig.parity" :items="['none', 'even', 'odd']" label="Parity" density="compact" :disabled="isRtuMasterOpen" />
          </v-col>
        </v-row>

        <div class="d-flex ga-2 mb-3">
          <v-btn
            v-if="!isRtuMasterOpen"
            color="primary"
            variant="flat"
            prepend-icon="mdi-connection"
            :disabled="!rtuSupported || isRtuSlaveOpen"
            :loading="connecting"
            @click="connectRtu"
          >
            Connect RTU
          </v-btn>
          <v-btn v-else color="error" variant="flat" prepend-icon="mdi-close-circle" @click="disconnectRtu">
            Disconnect RTU
          </v-btn>
        </div>
      </template>

      <template v-else>
        <v-row dense>
          <v-col cols="12" md="8">
            <v-text-field v-model="tcpConfig.host" label="TCP Host" density="compact" placeholder="192.168.1.100" />
          </v-col>
          <v-col cols="12" md="4">
            <v-text-field v-model.number="tcpConfig.port" label="TCP Port" type="number" min="1" max="65535" density="compact" />
          </v-col>
        </v-row>
      </template>

      <v-divider class="my-3" />

      <v-row dense>
        <v-col cols="6" md="3">
          <v-text-field v-model.number="request.unitId" :label="protocol === 'rtu' ? 'Slave ID' : 'Unit ID'" type="number" min="0" max="247" density="compact" />
        </v-col>
        <v-col cols="12" md="5">
          <v-select v-model="request.functionCode" :items="functionItems" label="Function" density="compact" />
        </v-col>
        <v-col cols="6" md="4">
          <v-text-field v-model.number="request.timeoutMs" label="Timeout (ms)" type="number" min="100" density="compact" />
        </v-col>
        <v-col cols="6" md="4">
          <v-text-field v-model.number="request.startAddress" label="Start Address" type="number" min="0" max="65535" density="compact" />
        </v-col>
        <v-col v-if="isReadFunction" cols="6" md="4">
          <v-text-field v-model.number="request.quantity" label="Quantity" type="number" min="1" max="125" density="compact" />
        </v-col>
        <v-col v-if="request.functionCode === FunctionCode.WriteSingleRegister" cols="6" md="4">
          <v-text-field v-model.number="request.value" label="Value" type="number" min="0" max="65535" density="compact" />
        </v-col>
        <v-col v-if="request.functionCode === FunctionCode.WriteMultipleRegisters" cols="12" md="8">
          <v-text-field
            v-model="valuesText"
            label="Values"
            density="compact"
            placeholder="1, 2, 3 or 0x0001 0x0002"
            hint="Comma/space separated 16-bit values"
            persistent-hint
          />
        </v-col>
      </v-row>

      <div class="d-flex ga-2 my-3">
        <v-btn color="primary" variant="flat" prepend-icon="mdi-send" :loading="sending" :disabled="sendDisabled" @click="sendRequest">
          Send Request
        </v-btn>
        <v-btn variant="tonal" prepend-icon="mdi-broom" @click="result = null">
          Clear Result
        </v-btn>
      </div>

      <v-alert v-if="errorMessage" type="error" variant="tonal" density="compact" class="mb-3">
        {{ errorMessage }}
      </v-alert>

      <v-card v-if="result" variant="tonal" class="mt-3">
        <v-card-title class="text-subtitle-1">
          Result
          <v-chip class="ml-2" :color="result.ok ? 'success' : 'error'" size="small" variant="flat">
            {{ result.ok ? 'OK' : 'FAILED' }}
          </v-chip>
          <span class="text-caption ml-2">{{ result.elapsedMs }} ms</span>
        </v-card-title>
        <v-card-text>
          <div><strong>Request:</strong> <code>{{ result.requestHex }}</code></div>
          <div v-if="result.responseHex"><strong>Response:</strong> <code>{{ result.responseHex }}</code></div>
          <div v-if="result.result?.values"><strong>Values:</strong> {{ result.result.values.join(', ') }}</div>
          <div v-if="result.result?.address !== undefined"><strong>Address:</strong> {{ result.result.address }}</div>
          <div v-if="result.result?.value !== undefined"><strong>Value:</strong> {{ result.result.value }}</div>
          <div v-if="result.result?.quantity !== undefined"><strong>Quantity:</strong> {{ result.result.quantity }}</div>
          <div v-if="result.result?.exceptionName"><strong>Exception:</strong> {{ result.result.exceptionName }} ({{ result.result.exceptionCode }})</div>
          <div v-if="result.error"><strong>Error:</strong> {{ result.error }}</div>
        </v-card-text>
      </v-card>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { FunctionCode, type MasterProtocol } from '../modbus/types'
import type { SerialConfig } from '../serial/serial-port'
import { isOpen as isRtuSlaveOpen } from '../serial/serial-port'
import {
  closeRtuMasterPort,
  isRtuMasterOpen,
  isRtuMasterSupportedApi,
  openRtuMasterPort,
  sendRtuMasterRequest,
} from '../master/rtu-master'
import { sendTcpMasterRequest } from '../master/tcp-master-client'
import type { MasterRequest, MasterResponse, TcpConfig } from '../master/types'

const protocol = ref<MasterProtocol>('rtu')
const rtuSupported = isRtuMasterSupportedApi()
const baudRates = [1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200]
const protocolItems = [
  { title: 'RTU', value: 'rtu' },
  { title: 'TCP', value: 'tcp' },
]
const functionItems = [
  { title: '03 Read Holding Registers', value: FunctionCode.ReadHoldingRegisters },
  { title: '04 Read Input Registers', value: FunctionCode.ReadInputRegisters },
  { title: '06 Write Single Register', value: FunctionCode.WriteSingleRegister },
  { title: '10 Write Multiple Registers', value: FunctionCode.WriteMultipleRegisters },
]

const rtuConfig = reactive<SerialConfig>({
  baudRate: 9600,
  dataBits: 8,
  stopBits: 1,
  parity: 'none',
})

const tcpConfig = reactive<TcpConfig>({
  host: '127.0.0.1',
  port: 502,
})

const request = reactive<MasterRequest>({
  protocol: 'rtu',
  unitId: 1,
  functionCode: FunctionCode.ReadHoldingRegisters,
  startAddress: 0,
  quantity: 1,
  value: 0,
  values: [0],
  timeoutMs: 3000,
})

const valuesText = ref('0')
const connecting = ref(false)
const sending = ref(false)
const errorMessage = ref('')
const result = ref<MasterResponse | null>(null)

const connected = computed(() => protocol.value === 'tcp' || isRtuMasterOpen.value)
const statusText = computed(() => {
  if (protocol.value === 'tcp') return 'TCP Proxy'
  return isRtuMasterOpen.value ? 'RTU Connected' : 'RTU Disconnected'
})
const isReadFunction = computed(
  () => request.functionCode === FunctionCode.ReadHoldingRegisters || request.functionCode === FunctionCode.ReadInputRegisters
)
const sendDisabled = computed(() => sending.value || (protocol.value === 'rtu' && (!isRtuMasterOpen.value || isRtuSlaveOpen.value)))

async function connectRtu() {
  if (isRtuSlaveOpen.value) {
    errorMessage.value = 'RTU Slave is already connected. Disconnect Slave first.'
    return
  }

  connecting.value = true
  errorMessage.value = ''
  try {
    await openRtuMasterPort(rtuConfig)
  } catch (err: any) {
    errorMessage.value = err?.message ?? 'Failed to connect RTU port'
  } finally {
    connecting.value = false
  }
}

async function disconnectRtu() {
  try {
    await closeRtuMasterPort()
  } catch (err: any) {
    errorMessage.value = err?.message ?? 'Failed to disconnect RTU port'
  }
}

async function sendRequest() {
  sending.value = true
  errorMessage.value = ''
  result.value = null

  try {
    const masterRequest = buildRequest()
    result.value = protocol.value === 'rtu'
      ? await sendRtuMasterRequest(masterRequest)
      : await sendTcpMasterRequest(tcpConfig, masterRequest)

    if (!result.value.ok) errorMessage.value = result.value.error ?? result.value.result?.error ?? 'Request failed'
  } catch (err: any) {
    errorMessage.value = err?.message ?? 'Failed to send request'
  } finally {
    sending.value = false
  }
}

function buildRequest(): MasterRequest {
  const parsedValues = parseValues(valuesText.value)
  return {
    protocol: protocol.value,
    unitId: Number(request.unitId),
    functionCode: request.functionCode,
    startAddress: Number(request.startAddress),
    quantity: Number(request.quantity),
    value: Number(request.value),
    values: parsedValues,
    timeoutMs: Number(request.timeoutMs),
  }
}

function parseValues(text: string): number[] {
  return text
    .split(/[\s,;]+/)
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => part.toLowerCase().startsWith('0x') ? parseInt(part, 16) : parseInt(part, 10))
}
</script>
