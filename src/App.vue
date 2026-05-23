<template>
  <v-app>
    <v-app-bar color="primary" density="compact">
      <v-app-bar-title>
        <v-icon start>mdi-lan</v-icon>
        Web Modbus Tool
      </v-app-bar-title>
    </v-app-bar>

    <v-main>
      <v-container fluid class="pa-4">
        <v-tabs v-model="activeMode" density="compact" class="mb-4">
          <v-tab value="slave">Slave</v-tab>
          <v-tab value="master">Master</v-tab>
        </v-tabs>

        <v-tabs-window v-model="activeMode">
          <v-tabs-window-item value="slave">
            <v-row>
              <!-- Left column: connection + templates -->
              <v-col cols="12" md="4" lg="3">
                <SerialPanel class="mb-4" />
                <DeviceTemplates />
              </v-col>

              <!-- Right column: registers + log -->
              <v-col cols="12" md="8" lg="9">
                <RegisterTable class="mb-4" />
                <CommLog />
              </v-col>
            </v-row>
          </v-tabs-window-item>

          <v-tabs-window-item value="master">
            <v-row>
              <v-col cols="12" lg="5">
                <MasterPanel />
              </v-col>
              <v-col cols="12" lg="7">
                <CommLog />
              </v-col>
            </v-row>
          </v-tabs-window-item>
        </v-tabs-window>
      </v-container>
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import SerialPanel from './components/SerialPanel.vue'
import RegisterTable from './components/RegisterTable.vue'
import DeviceTemplates from './components/DeviceTemplates.vue'
import CommLog from './components/CommLog.vue'
import MasterPanel from './components/MasterPanel.vue'
import { initDefaultRegisters } from './store/registers'

const activeMode = ref<'slave' | 'master'>('slave')

onMounted(() => {
  initDefaultRegisters()
})
</script>
