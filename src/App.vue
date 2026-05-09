<template>
  <v-app>
    <v-app-bar color="primary" density="compact">
      <v-app-bar-title>
        <v-icon start>mdi-lan</v-icon>
        Web Modbus Slave Emulator
      </v-app-bar-title>
    </v-app-bar>

    <v-main>
      <v-container fluid class="pa-4">
        <section class="seo-intro mb-4" aria-labelledby="page-title">
          <h1 id="page-title" class="text-h4 text-md-h3 font-weight-bold mb-2">
            Web Modbus Slave Emulator
          </h1>
          <p class="text-body-1 text-medium-emphasis mb-0">
            Test Modbus RTU masters directly in the browser with a Web Serial based slave emulator,
            editable register tables, reusable device templates, and live communication logs.
          </p>
        </section>

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
      </v-container>
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import SerialPanel from './components/SerialPanel.vue'
import RegisterTable from './components/RegisterTable.vue'
import DeviceTemplates from './components/DeviceTemplates.vue'
import CommLog from './components/CommLog.vue'
import { initDefaultRegisters } from './store/registers'

onMounted(() => {
  initDefaultRegisters()
})
</script>

<style scoped>
.seo-intro {
  max-width: 960px;
}
</style>
