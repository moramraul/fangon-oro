<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue'
import { ApiError, request } from '../../api'
import { useAuthStore } from '../../stores/auth'
const props = defineProps<{ eventId: string }>()
const auth = useAuthStore()
const entries = ref<{ participantName: string; points: number; justification: string }[]>([])
const loading = ref(false)
const error = ref('')
let revision = 0
async function load() {
  const current = ++revision
  entries.value = []
  error.value = ''
  loading.value = true
  try {
    const data = await request<typeof entries.value>(
      `/events/${encodeURIComponent(props.eventId)}/responses`,
      {},
      auth.token!,
    )
    if (current === revision) entries.value = data
  } catch (cause) {
    if (current !== revision) return
    if (cause instanceof ApiError && cause.status === 401) auth.logout()
    error.value =
      cause instanceof ApiError && cause.status === 409
        ? 'Las respuestas estarán disponibles cuando se cierre el evento.'
        : 'No hemos podido cargar las respuestas de este evento.'
  } finally {
    if (current === revision) loading.value = false
  }
}
watch(() => props.eventId, load, { immediate: true })
onUnmounted(() => {
  revision++
})
</script>

<template>
  <section aria-label="Respuestas anónimas" :aria-busy="loading">
    <p v-if="loading" class="overview-message" role="status">Cargando respuestas…</p>
    <div v-else-if="error" class="overview-error" role="alert">
      <p>{{ error }}</p>
      <button class="overview-button" type="button" @click="load">Volver a intentar</button>
    </div>
    <template v-else>
      <p v-if="!entries.length" class="overview-message">Todavía no hay respuestas.</p>
      <ul v-else class="event-responses">
        <li v-for="(entry, index) in entries" :key="index">
          <p>{{ entry.justification }}</p>
        </li>
      </ul>
    </template>
  </section>
</template>

<style scoped>
.event-responses {
  margin: 0;
  padding: 0;
  list-style: none;
}
.event-responses li {
  min-width: 0;
  padding: 16px 0;
  border-bottom: 1px solid #d9b66525;
  overflow-wrap: anywhere;
}
.event-responses li:last-child {
  border-bottom: 0;
}
.event-responses p {
  margin: 0;
  white-space: pre-wrap;
  font-size: 16px;
  line-height: 1.7;
}
</style>
