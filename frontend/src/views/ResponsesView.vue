<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { ApiError, request, type EditionSummary } from '../api'
import { useAuthStore } from '../stores/auth'
import EventResponses from '../components/events/EventResponses.vue'
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
const eventId = ref('')
const editions = ref<EditionSummary[]>([])
const editionId = ref('')
const editionEvents = computed(() =>
  events.value.filter((event) => (event.editionId ?? '') === editionId.value),
)
const selectedEvent = computed(() => events.value.find((event) => event.id === eventId.value))
const loading = ref(true)
const error = ref('')
let revision = 0
async function load() {
  const current = ++revision
  loading.value = true
  error.value = ''
  events.value = []
  eventId.value = ''
  if (!auth.token) {
    loading.value = false
    return
  }
  try {
    // Both list endpoints apply the existing event closure reconciliation.
    // USER sees their events; ADMIN can inspect all events they manage.
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
    const initial =
      events.value.find((event) => event.id === requestedId) ??
      events.value.find(
        (event) => event.editionId === editionData.find((edition) => edition.status === 'open')?.id,
      ) ??
      events.value[0]
    eventId.value = initial?.id ?? ''
    editionId.value = initial?.editionId ?? ''
  } catch (cause) {
    if (current !== revision) return
    if (cause instanceof ApiError && cause.status === 401) auth.logout()
    error.value = 'No hemos podido cargar los eventos. Inténtalo de nuevo.'
  } finally {
    if (current === revision) loading.value = false
  }
}
function selectEdition(event: Event) {
  editionId.value = (event.target as HTMLSelectElement).value
  const first = editionEvents.value[0]
  eventId.value = first?.id ?? ''
  if (first) selectEvent(first.id)
  else history.replaceState(null, '', '#/responses')
}
function selectEvent(id: string) {
  location.hash = `/responses/events/${encodeURIComponent(id)}`
}
function onHashChange() {
  const id = location.hash.match(/^#\/responses\/events\/([^/]+)$/)?.[1]
  if (!loading.value && !error.value && id && events.value.some((event) => event.id === id)) {
    eventId.value = id
    editionId.value = events.value.find((event) => event.id === id)?.editionId ?? ''
    return
  }
  void load()
}
onMounted(() => {
  void load()
  window.addEventListener('hashchange', onHashChange)
})
onUnmounted(() => {
  revision++
  window.removeEventListener('hashchange', onHashChange)
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
    <p v-else-if="!events.length" class="overview-message">
      Todavía no hay eventos cerrados disponibles para consultar respuestas.
    </p>
    <section v-else class="overview-panel" aria-label="Respuestas por evento">
      <div class="responses-filters">
        <label for="responses-edition"
          >Edición
          <select id="responses-edition" :value="editionId" @change="selectEdition">
            <option v-for="edition in editions" :key="edition.id" :value="edition.id">
              {{ edition.name }}
            </option>
            <option v-if="events.some((event) => !event.editionId)" value="">Sin edición</option>
          </select>
        </label>
        <label for="responses-event"
          >Evento
          <select
            id="responses-event"
            :value="eventId"
            :disabled="!editionEvents.length"
            @change="selectEvent(($event.target as HTMLSelectElement).value)"
          >
            <option v-if="!editionEvents.length" value="">No hay eventos cerrados</option>
            <option v-for="event in editionEvents" :key="event.id" :value="event.id">
              {{ event.name }}{{ event.isTest ? ' (pruebas)' : '' }}
            </option>
          </select>
        </label>
      </div>
      <p v-if="!editionEvents.length" class="overview-message">
        No hay eventos cerrados disponibles en esta edición.
      </p>
      <EventResponses v-if="selectedEvent" :key="selectedEvent.id" :event-id="selectedEvent.id" />
    </section>
  </section>
</template>

<style scoped>
.responses-filters {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 20px;
}
.responses-filters label {
  display: grid;
  gap: 8px;
  min-width: 0;
  color: var(--gold);
  font-size: 13px;
}
.responses-filters select {
  width: 100%;
  min-width: 0;
  min-height: 48px;
  padding: 10px;
  border: 1px solid #d9b66560;
  border-radius: 8px;
  background: #201e17;
  color: #f2eee5;
  font: inherit;
}
.responses-filters select:focus-visible {
  outline: 2px solid var(--gold);
  outline-offset: 3px;
}
@media (max-width: 480px) {
  .responses-filters {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
