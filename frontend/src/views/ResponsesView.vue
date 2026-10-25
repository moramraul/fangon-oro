<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { ApiError, request } from '../api'
import { useAuthStore } from '../stores/auth'
import EventResponses from '../components/events/EventResponses.vue'
import '../styles/overview.css'
import '../styles/rankings.css'

interface ClosedEvent {
  id: string
  name: string
  status: string
  isTest: boolean
  endDate: string | null
}
const auth = useAuthStore()
const events = ref<ClosedEvent[]>([])
const eventId = ref('')
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
    const data = await request<ClosedEvent[]>(
      auth.user?.role === 'ADMIN' ? '/admin/events' : '/events',
      {},
      auth.token,
    )
    if (current !== revision) return
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
    eventId.value = requestedId ?? events.value[0]?.id ?? ''
  } catch (cause) {
    if (current !== revision) return
    if (cause instanceof ApiError && cause.status === 401) auth.logout()
    error.value = 'No hemos podido cargar los eventos. Inténtalo de nuevo.'
  } finally {
    if (current === revision) loading.value = false
  }
}
function selectEvent(id: string) {
  location.hash = `/responses/events/${encodeURIComponent(id)}`
}
function onHashChange() {
  const id = location.hash.match(/^#\/responses\/events\/([^/]+)$/)?.[1]
  if (!loading.value && !error.value && id && events.value.some((event) => event.id === id)) {
    eventId.value = id
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
      <p>Consulta las justificaciones anónimas de los eventos cerrados.</p>
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
      <nav class="ranking-selector" aria-label="Elegir evento">
        <button
          v-for="event in events"
          :key="event.id"
          type="button"
          :aria-pressed="eventId === event.id"
          @click="selectEvent(event.id)"
        >
          {{ event.name }}{{ event.isTest ? ' (pruebas)' : '' }}
        </button>
      </nav>
      <EventResponses v-if="selectedEvent" :key="selectedEvent.id" :event-id="selectedEvent.id" />
    </section>
  </section>
</template>
