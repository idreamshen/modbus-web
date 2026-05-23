<template>
  <v-card>
    <v-card-title class="d-flex align-center">
      <v-icon start>mdi-console</v-icon>
      Communication Log
      <v-spacer />
      <v-btn size="small" variant="text" @click="handleClear" prepend-icon="mdi-delete-sweep">
        Clear
      </v-btn>
    </v-card-title>

    <v-card-text class="pa-0">
      <div ref="logContainer" class="log-container">
        <div v-if="store.commLog.length === 0" class="text-center text-grey pa-4">
          No communication yet. Connect a serial port and send Modbus requests.
        </div>

        <div
          v-for="(entry, index) in store.commLog"
          :key="index"
          class="log-entry"
          :class="entry.direction === 'RX' ? 'log-rx' : 'log-tx'"
        >
          <span class="log-time">{{ formatTime(entry.timestamp) }}</span>
          <span class="log-dir" :class="entry.direction === 'RX' ? 'text-blue' : 'text-green'">
            {{ entry.direction }}
          </span>
          <span v-if="entry.role || entry.protocol" class="log-meta">
            [{{ entry.role ?? '-' }}{{ entry.protocol ? '/' + entry.protocol.toUpperCase() : '' }}]
          </span>
          <span class="log-hex">{{ entry.rawHex }}</span>
          <span class="log-summary text-grey">{{ entry.summary }}</span>
        </div>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { store, clearLog } from '../store/registers'

const logContainer = ref<HTMLElement | null>(null)

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  } as Intl.DateTimeFormatOptions)
}

function handleClear() {
  clearLog()
}

// Auto-scroll to bottom when new log entries arrive
watch(
  () => store.commLog.length,
  async () => {
    await nextTick()
    if (logContainer.value) {
      logContainer.value.scrollTop = logContainer.value.scrollHeight
    }
  }
)
</script>

<style scoped>
.log-container {
  max-height: 300px;
  overflow-y: auto;
  font-family: 'Courier New', Courier, monospace;
  font-size: 12px;
  background: #1e1e1e;
  color: #d4d4d4;
}

.log-entry {
  padding: 2px 12px;
  white-space: nowrap;
  border-bottom: 1px solid #333;
}

.log-entry:hover {
  background: #2a2a2a;
}

.log-rx {
  border-left: 3px solid #2196f3;
}

.log-tx {
  border-left: 3px solid #4caf50;
}

.log-time {
  margin-right: 8px;
  color: #888;
}

.log-dir {
  margin-right: 8px;
  font-weight: bold;
  display: inline-block;
  width: 24px;
}

.log-meta {
  margin-right: 8px;
  color: #bdbdbd;
}

.log-hex {
  margin-right: 12px;
}

.log-summary {
  font-style: italic;
}
</style>
