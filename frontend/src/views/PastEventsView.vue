<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ApiError, request, type EditionSummary } from '../api'
import { useAuthStore } from '../stores/auth'
import '../styles/overview.css'
import '../styles/rankings.css'

interface PastEvent {
  id: string
  editionId: string
  name: string
  startDate: string
  endDate: string | null
  participantCount: number
}
const auth = useAuthStore()
const events = ref<PastEvent[]>([])
const editions = ref<EditionSummary[]>([])
const selected = ref('all')
const loading = ref(true)
const error = ref('')
const visibleEvents = computed(() =>
  events.value.filter((event) => selected.value === 'all' || event.editionId === selected.value),
)
const dates = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'Europe/Madrid',
})
function tag(event: PastEvent) {
  const edition = editions.value.find((item) => item.id === event.editionId)
  return edition ? `#fangon${edition.number}` : ''
}
async function load() {
  loading.value = true
  error.value = ''
  try {
    const data = await request<{ events: PastEvent[]; editions: EditionSummary[] }>(
      '/overview?edition=global',
      {},
      auth.token ?? undefined,
    )
    events.value = data.events.sort(
      (a, b) => Date.parse(b.endDate ?? b.startDate) - Date.parse(a.endDate ?? a.startDate),
    )
    editions.value = data.editions
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 401) auth.logout()
    else
      error.value =
        cause instanceof Error ? cause.message : 'No hemos podido cargar las votaciones.'
  } finally {
    loading.value = false
  }
}
onMounted(() => void load())
</script>

<template>
  <section class="rankings overview" aria-labelledby="past-events-title" :aria-busy="loading">
    <a class="overview-text-button" href="#/overview">← Volver a Home</a>
    <header class="rankings-heading">
      <h1 id="past-events-title">Votaciones pasadas</h1>
      <p>Consulta los resultados de los eventos cerrados.</p>
    </header>
    <p v-if="loading" class="overview-message" role="status">Cargando votaciones…</p>
    <div v-else-if="error" class="overview-error" role="alert">
      <p>{{ error }}</p>
      <button class="overview-button" type="button" @click="load">Volver a intentar</button>
    </div>
    <template v-else>
      <label class="past-edition-filter"
        >Edición
        <select v-model="selected">
          <option value="all">Todas las ediciones</option>
          <option v-for="edition in editions" :key="edition.id" :value="edition.id">
            {{ edition.name }}
          </option>
        </select>
      </label>
      <section class="overview-panel" aria-label="Listado de votaciones pasadas">
        <ul v-if="visibleEvents.length" class="overview-event-list">
          <li v-for="event in visibleEvents" :key="event.id" class="overview-event">
            <div class="overview-event-info">
              <h3>{{ event.name }}</h3>
              <span class="overview-event-edition">{{ tag(event) }}</span>
              <p>Inicio: {{ dates.format(new Date(event.startDate)) }}</p>
              <p>
                Fin:
                {{ event.endDate ? dates.format(new Date(event.endDate)) : 'Sin fecha de cierre' }}
              </p>
              <p>{{ event.participantCount }} participantes</p>
            </div>
            <a class="overview-button" :href="`#/rankings/events/${encodeURIComponent(event.id)}`"
              >Ver resultados</a
            >
          </li>
        </ul>
        <p v-else class="overview-message">Todavía no hay votaciones pasadas para mostrar.</p>
      </section>
    </template>
  </section>
</template>

<style scoped>
.past-edition-filter {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  color: var(--muted);
  font-size: 13px;
}
select {
  min-height: 44px;
  max-width: 100%;
  padding: 8px 12px;
  border: 1px solid #d9b66555;
  border-radius: 6px;
  background: #17140f;
  color: #f3d68d;
  font: inherit;
}
select:focus-visible {
  outline: 2px solid var(--gold);
  outline-offset: 2px;
}
</style>
