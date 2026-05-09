<template>
  <v-card>
    <v-card-title class="d-flex align-center">
      <v-icon start>mdi-devices</v-icon>
      Device Templates
    </v-card-title>

    <v-card-text>
      <v-select
        v-model="selectedTemplateId"
        :items="templateItems"
        item-title="name"
        item-value="id"
        label="Select Template"
        density="compact"
        clearable
      />

      <v-alert
        v-if="selectedTemplate"
        type="info"
        variant="tonal"
        density="compact"
        class="mt-2"
      >
        {{ selectedTemplate.description }}
      </v-alert>
    </v-card-text>

    <v-card-actions>
      <v-btn
        color="primary"
        variant="flat"
        :disabled="!selectedTemplateId"
        @click="handleApply"
        prepend-icon="mdi-check"
      >
        Apply Template
      </v-btn>
    </v-card-actions>

    <v-snackbar v-model="showSuccess" color="success" :timeout="3000">
      Template "{{ selectedTemplate?.name }}" applied successfully.
    </v-snackbar>
  </v-card>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { deviceTemplates, applyTemplate } from '../templates/devices'

const selectedTemplateId = ref<string | null>(null)
const showSuccess = ref(false)

const templateItems = computed(() =>
  deviceTemplates.map(t => ({ id: t.id, name: t.name }))
)

const selectedTemplate = computed(() =>
  deviceTemplates.find(t => t.id === selectedTemplateId.value) ?? null
)

function handleApply() {
  if (!selectedTemplate.value) return
  applyTemplate(selectedTemplate.value)
  showSuccess.value = true
}
</script>
