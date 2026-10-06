<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { ApiError, request, type EditionSummary } from '../api'
import { useAuthStore } from '../stores/auth'
import EventCover from '../components/events/EventCover.vue'
import '../styles/overview.css'
import '../styles/rankings.css'

interface Standing {
  id: string
  name: string
  points: number
  rank: number
}
interface Overview {
  edition: EditionSummary | null
  editions: EditionSummary[]
  scope: 'edition' | 'global'
  rankingYear: number
  serverTime: string
  standings: Standing[]
  events: {
    image: string | null
    id: string
    name: string
    status: string
    endDate: string | null
  }[]
}
const auth = useAuthStore()
const overview = ref<Overview | null>(null)
const result = ref<{ name: string; image: string | null; standings: Standing[] } | null>(null)
const eventId = ref('')
const selectedEdition = ref<string | null>(null)
const historical = ref(false)
const activeEdition = computed(() =>
  overview.value?.editions.find((edition) => edition.status === 'open'),
)
let preserveEdition = false
const closedEditions = computed(
  () => overview.value?.editions.filter((edition) => edition.status === 'closed') ?? [],
)
const loading = ref(true)
const error = ref('')
let requestId = 0
const standings = computed(() =>
  eventId.value ? (result.value?.standings ?? []) : (overview.value?.standings ?? []),
)
const events = computed(
  () =>
    overview.value?.events.filter(
      (event) =>
        event.status === 'closed' ||
        (!!event.endDate && Date.parse(event.endDate) <= Date.parse(overview.value!.serverTime)),
    ) ?? [],
)

async function load() {
  const currentRequest = ++requestId
  eventId.value = location.hash.match(/^#\/rankings\/events\/([^/]+)$/)?.[1] ?? ''
  result.value = null
  loading.value = true
  error.value = ''
  window.scrollTo({ top: 0 })
  if (!auth.token) return
  try {
    const data = await request<Overview>(
      selectedEdition.value
        ? `/overview?edition=${encodeURIComponent(selectedEdition.value)}`
        : '/overview',
      {},
      auth.token,
    )
    if (currentRequest !== requestId) return
    overview.value = data
    selectedEdition.value = data.scope === 'global' ? 'global' : (data.edition?.id ?? null)
    if (eventId.value) {
      const response = await request<{
        name: string
        image: string | null
        editionId: string
        standings: Standing[]
      }>(`/overview/events/${eventId.value}/results`, {}, auth.token)
      if (currentRequest !== requestId) return
      result.value = response
      if (response.editionId !== data.edition?.id) {
        const editionData = await request<Overview>(
          `/overview?edition=${response.editionId}`,
          {},
          auth.token,
        )
        if (currentRequest !== requestId) return
        overview.value = editionData
        selectedEdition.value = response.editionId
      }
      historical.value = overview.value?.edition?.status === 'closed'
    }
  } catch (cause) {
    if (currentRequest !== requestId) return
    if (cause instanceof ApiError && cause.status === 401) auth.logout()
    error.value =
      cause instanceof ApiError && cause.status === 409
        ? 'Los resultados estarán disponibles cuando se cierre el evento.'
        : cause instanceof Error
          ? cause.message
          : 'No hemos podido cargar la clasificación.'
  } finally {
    if (currentRequest === requestId) loading.value = false
  }
}
function selectEdition(id: string | null) {
  selectedEdition.value = id
  historical.value = id === 'global' || closedEditions.value.some((edition) => edition.id === id)
  if (eventId.value) {
    preserveEdition = true
    location.hash = '/rankings'
  } else void load()
}
function onHashChange() {
  if (location.hash === '#/rankings' && !preserveEdition) {
    selectedEdition.value = null
    historical.value = false
  }
  preserveEdition = false
  void load()
}
onMounted(() => {
  void load()
  window.addEventListener('hashchange', onHashChange)
})
onUnmounted(() => {
  requestId++
  window.removeEventListener('hashchange', onHashChange)
})
</script>

<template>
  <section class="rankings overview" aria-labelledby="rankings-title" :aria-busy="loading">
    <a class="overview-text-button" href="#/overview">← Volver a Home</a>
    <header class="rankings-heading">
      <span class="overview-edition">FANGÓN DE ORO</span>
      <h1 id="rankings-title">Clasificaciones</h1>
      <p>Consulta los puntos acumulados y los resultados de cada evento.</p>
    </header>
    <nav class="rankings-navigation" aria-label="Elegir vista">
      <button
        class="overview-button"
        :class="{ 'overview-button--gold': !historical }"
        :aria-pressed="!historical"
        type="button"
        @click="selectEdition(null)"
      >
        {{ activeEdition?.name ?? 'Cargando edición…' }}
      </button>
      <button
        class="overview-button"
        :class="{ 'overview-button--gold': historical }"
        :aria-pressed="historical"
        type="button"
        @click="selectEdition('global')"
      >
        Histórica
      </button>
    </nav>
    <nav v-if="historical" class="rankings-history" aria-label="Elegir edición histórica">
      <p class="rankings-history-label">Consultar edición</p>
      <div class="rankings-history-options">
        <button
          class="rankings-history-option"
          :aria-pressed="selectedEdition === 'global'"
          type="button"
          @click="selectEdition('global')"
        >
          General Total
        </button>
        <button
          v-for="edition in closedEditions"
          :key="edition.id"
          class="rankings-history-option"
          :aria-pressed="selectedEdition === edition.id"
          type="button"
          @click="selectEdition(edition.id)"
        >
          {{ edition.name }}
        </button>
      </div>
    </nav>
    <nav class="rankings-navigation" aria-label="Elegir clasificación">
      <button
        v-if="eventId"
        class="overview-text-button"
        type="button"
        @click="selectEdition(selectedEdition)"
      >
        ← Volver a la clasificación de {{ overview?.edition?.name ?? 'todas las ediciones' }}
      </button>
      <a
        v-for="event in events"
        :key="event.id"
        class="overview-button"
        :class="{ 'overview-button--gold': eventId === event.id }"
        :aria-current="eventId === event.id ? 'page' : undefined"
        :href="`#/rankings/events/${encodeURIComponent(event.id)}`"
        >{{ event.name }}</a
      >
    </nav>
    <p v-if="loading" class="overview-message" role="status">Cargando clasificación…</p>
    <div v-else-if="error" class="overview-error" role="alert">
      <p>{{ error }}</p>
      <button class="overview-button" type="button" @click="load">Volver a intentar</button>
    </div>
    <section v-else class="overview-panel" aria-labelledby="ranking-title">
      <EventCover v-if="eventId && result" class="ranking-event-cover" :image="result.image" />
      <header class="overview-panel-heading">
        <h2 id="ranking-title">{{ eventId ? result?.name : 'Clasificación general' }}</h2>
      </header>
      <p v-if="!eventId" class="overview-ranking-edition">
        {{ overview?.edition?.name ?? 'Todas las ediciones' }} · puntos acumulados
      </p>
      <ol v-if="standings.length" class="overview-ranking">
        <li v-for="entry in standings" :key="entry.id">
          <span class="overview-ranking-place">{{ entry.rank }}</span>
          <span>{{ entry.name }}</span>
          <strong>{{ entry.points }} <small>pts</small></strong>
        </li>
      </ol>
      <p v-else class="overview-message">
        {{
          eventId
            ? 'No hay resultados para este evento.'
            : 'Todavía no hay clasificación. Se actualizará cuando se cierre el primer evento.'
        }}
      </p>
    </section>
  </section>
</template>
