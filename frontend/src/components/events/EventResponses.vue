<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { ApiError, request } from '../../api'
import { useAuthStore } from '../../stores/auth'
interface ResponseEntry {
  participantName: string
  points: number
  justification: string
}
const props = defineProps<{ eventIds: string[]; recipients: string[]; scores: string[] }>()
const emit = defineEmits<{ recipients: [names: string[]] }>()
const auth = useAuthStore()
const entries = ref<ResponseEntry[]>([])
const filteredEntries = computed(() =>
  entries.value.filter(
    (entry) =>
      (props.recipients.includes('*') || props.recipients.includes(entry.participantName)) &&
      (props.scores.includes('*') || props.scores.includes(String(entry.points))),
  ),
)
const loading = ref(false)
const error = ref('')
// Reuse closed-event responses when changing filters, bounded to this view's lifetime.
const cache = new Map<string, ResponseEntry[]>()
let revision = 0
let controller: AbortController | undefined
async function load() {
  const current = ++revision
  controller?.abort()
  controller = new AbortController()
  const signal = controller.signal
  entries.value = []
  emit('recipients', [])
  error.value = ''
  loading.value = true
  try {
    const queue = [...props.eventIds]
    // Bound concurrent HTTP queries when selecting a whole edition.
    await Promise.all(
      Array.from({ length: Math.min(4, queue.length) }, async () => {
        while (queue.length && current === revision) {
          const id = queue.shift()!
          if (!cache.has(id)) {
            const data = await request<ResponseEntry[]>(
              `/events/${encodeURIComponent(id)}/responses`,
              { signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]) },
              auth.token!,
            )
            if (current !== revision) return
            cache.set(id, data)
          }
        }
      }),
    )
    if (current !== revision) return
    entries.value = props.eventIds
      .flatMap((id) => cache.get(id) ?? [])
      .sort(
        (a, b) =>
          a.participantName.localeCompare(b.participantName) ||
          b.points - a.points ||
          a.justification.localeCompare(b.justification),
      )
    emit('recipients', [...new Set(entries.value.map((entry) => entry.participantName))])
  } catch (cause) {
    if (current !== revision) return
    controller.abort()
    if (cause instanceof ApiError && cause.status === 401) auth.logout()
    error.value =
      cause instanceof ApiError && cause.status === 409
        ? 'Las respuestas estarán disponibles cuando se cierre el evento.'
        : 'No hemos podido cargar todas las respuestas. Vuelve a intentarlo.'
  } finally {
    if (current === revision) loading.value = false
  }
}
watch(() => props.eventIds, load, { immediate: true })
onUnmounted(() => {
  revision++
  controller?.abort()
  cache.clear()
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
      <p v-if="!filteredEntries.length" class="overview-message">
        No hay respuestas para los filtros seleccionados.
      </p>
      <ul v-else class="event-responses">
        <li v-for="(entry, index) in filteredEntries" :key="index">
          <p>{{ entry.justification }}</p>
          <small class="response-recipient"
            >(Voto para {{ entry.participantName }} · {{ entry.points }}
            {{ entry.points === 1 ? 'punto' : 'puntos' }})</small
          >
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
.response-recipient {
  display: block;
  margin-top: 6px;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.5;
}
</style>
