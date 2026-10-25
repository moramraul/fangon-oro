<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { ApiError, request, type EditionSummary } from '../api'
import { useAuthStore } from '../stores/auth'
import EventResponses from '../components/events/EventResponses.vue'
import ResponseFilter from '../components/events/ResponseFilter.vue'
import '../styles/overview.css'
import '../styles/rankings.css'
interface ClosedEvent {
  editionId: string | null
  id: string
  name: string
  status: string
  isTest: boolean
  endDate: string | null
}
const auth = useAuthStore()
const events = ref<ClosedEvent[]>([])
const editions = ref<EditionSummary[]>([])
const selectedEditions = ref<string[]>([])
const selectedEvents = ref<string[]>([])
const recipients = ref<string[]>(['*'])
const scores = ref<string[]>(['*'])
const recipientNames = ref<string[]>([])
const matches = (selection: string[], value: string) =>
  selection.includes('*') || selection.includes(value)
const editionEvents = computed(() =>
  events.value.filter((event) => matches(selectedEditions.value, event.editionId ?? '')),
)
const eventIds = computed(() =>
  editionEvents.value
    .filter((event) => matches(selectedEvents.value, event.id))
    .map((event) => event.id),
)
const editionOptions = computed(() => [
  ...editions.value.map((edition) => ({ value: edition.id, label: edition.name })),
  ...(events.value.some((event) => !event.editionId) ? [{ value: '', label: 'Sin edición' }] : []),
])
const eventOptions = computed(() =>
  editionEvents.value.map((event) => ({
    value: event.id,
    label: `${event.name}${event.isTest ? ' (pruebas)' : ''}`,
  })),
)
const recipientOptions = computed(() =>
  [...new Set([...recipientNames.value, ...recipients.value.filter((name) => name !== '*')])]
    .sort((a, b) => a.localeCompare(b, 'es'))
    .map((name) => ({ value: name, label: name })),
)
const scoreOptions = [5, 3, 1].map((score) => ({
  value: String(score),
  label: `${score} ${score === 1 ? 'punto' : 'puntos'}`,
}))
const loading = ref(true)
const error = ref('')
let revision = 0
function resetDefaults(requestedId?: string) {
  const requested = events.value.find((event) => event.id === requestedId)
  const active = editions.value.find((edition) => edition.status === 'open')
  const edition = requested?.editionId ?? active?.id ?? editions.value[0]?.id ?? ''
  selectedEditions.value = [edition]
  const latest = requested ?? events.value.find((event) => (event.editionId ?? '') === edition)
  selectedEvents.value = latest ? [latest.id] : []
  recipients.value = ['*']
  scores.value = ['*']
}
function changeEditions(values: string[]) {
  selectedEditions.value = values
  selectedEvents.value = ['*']
  history.replaceState(null, '', '#/responses')
}
async function load() {
  const current = ++revision
  loading.value = true
  error.value = ''
  if (!auth.token) {
    loading.value = false
    return
  }
  try {
    const [data, editionData] = await Promise.all([
      request<ClosedEvent[]>(
        auth.user?.role === 'ADMIN' ? '/admin/events' : '/events',
        {},
        auth.token,
      ),
      request<EditionSummary[]>('/editions', {}, auth.token),
    ])
    if (current !== revision) return
    editions.value = editionData
    events.value = data
      .filter((event) => event.status === 'closed')
      .sort(
        (a, b) => (b.endDate ? Date.parse(b.endDate) : 0) - (a.endDate ? Date.parse(a.endDate) : 0),
      )
    const requestedId = location.hash.match(/^#\/responses\/events\/([^/]+)$/)?.[1]
    if (requestedId && !events.value.some((event) => event.id === requestedId)) {
      error.value =
        'Las respuestas solo están disponibles para eventos cerrados a los que tienes acceso.'
      return
    }
    resetDefaults(requestedId)
  } catch (cause) {
    if (current !== revision) return
    if (cause instanceof ApiError && cause.status === 401) auth.logout()
    error.value = 'No hemos podido cargar los eventos. Inténtalo de nuevo.'
  } finally {
    if (current === revision) loading.value = false
  }
}
onMounted(() => {
  void load()
  window.addEventListener('hashchange', load)
})
onUnmounted(() => {
  revision++
  window.removeEventListener('hashchange', load)
})
</script>

<template>
  <section class="rankings overview" aria-labelledby="responses-title" :aria-busy="loading">
    <a class="overview-text-button" href="#/overview">← Volver a Home</a>
    <header class="rankings-heading">
      <span class="overview-edition">FANGÓN DE ORO</span>
      <h1 id="responses-title">Respuestas</h1>
      <p>Aquí sabrás por qué te han votado, pedazo de guarro.</p>
    </header>
    <p v-if="loading" class="overview-message" role="status">Cargando eventos…</p>
    <div v-else-if="error" class="overview-error" role="alert">
      <p>{{ error }}</p>
      <button class="overview-button" type="button" @click="load">Volver a intentar</button>
      <a class="overview-button" href="#/responses">Ver eventos disponibles</a>
    </div>
    <section v-else class="overview-panel" aria-label="Filtrar respuestas">
      <div class="responses-filters">
        <ResponseFilter
          label="Edición"
          :model-value="selectedEditions"
          :options="editionOptions"
          @update:model-value="changeEditions"
        />
        <ResponseFilter v-model="selectedEvents" label="Evento" :options="eventOptions" />
        <ResponseFilter v-model="recipients" label="Voto para" :options="recipientOptions" />
        <ResponseFilter v-model="scores" label="Puntuación" :options="scoreOptions" />
      </div>
      <button class="overview-text-button" type="button" @click="resetDefaults()">
        Restablecer filtros
      </button>
      <EventResponses
        :event-ids="eventIds"
        :recipients="recipients"
        :scores="scores"
        @recipients="recipientNames = $event"
      />
    </section>
  </section>
</template>

<style scoped>
.responses-filters {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
  align-items: start;
}
@media (max-width: 480px) {
  .responses-filters {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
