<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { ApiError, request, type EditionSummary } from '../api'
import { useAuthStore } from '../stores/auth'
import '../styles/overview.css'
import '../styles/rankings.css'

interface Standing {
  id: string
  name: string
  avatar: string | null
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
const closedEditions = computed(
  () => overview.value?.editions.filter((edition) => edition.status === 'closed') ?? [],
)
const loading = ref(true)
const error = ref('')
const switching = ref(false)
const switchError = ref('')
let requestId = 0
const standings = computed(() =>
  eventId.value ? (result.value?.standings ?? []) : (overview.value?.standings ?? []),
)
const events = computed(() =>
  historical.value
    ? []
    : (overview.value?.events.filter(
        (event) =>
          event.status === 'closed' ||
          (!!event.endDate && Date.parse(event.endDate) <= Date.parse(overview.value!.serverTime)),
      ) ?? []),
)

async function load() {
  const currentRequest = ++requestId
  switching.value = false
  switchError.value = ''
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
async function selectClassification(id: string) {
  const currentRequest = ++requestId
  switchError.value = ''
  if (!id) {
    eventId.value = ''
    result.value = null
    switching.value = false
    return
  }
  if (!auth.token) return
  switching.value = true
  try {
    const response = await request<NonNullable<typeof result.value>>(
      `/overview/events/${encodeURIComponent(id)}/results`,
      {},
      auth.token,
    )
    if (currentRequest !== requestId) return
    result.value = response
    eventId.value = id
  } catch (cause) {
    if (currentRequest !== requestId) return
    if (cause instanceof ApiError && cause.status === 401) auth.logout()
    switchError.value =
      cause instanceof Error ? cause.message : 'No hemos podido cargar la clasificación.'
  } finally {
    if (currentRequest === requestId) switching.value = false
  }
}
async function selectHistoricalEdition(id: string) {
  if (!auth.token) return
  const currentRequest = ++requestId
  switching.value = true
  switchError.value = ''
  try {
    const data = await request<Overview>(
      `/overview?edition=${encodeURIComponent(id)}`,
      {},
      auth.token,
    )
    if (currentRequest !== requestId) return
    overview.value = data
    selectedEdition.value = id
    eventId.value = ''
    result.value = null
  } catch (cause) {
    if (currentRequest !== requestId) return
    if (cause instanceof ApiError && cause.status === 401) auth.logout()
    switchError.value =
      cause instanceof Error ? cause.message : 'No hemos podido cargar la clasificación.'
  } finally {
    if (currentRequest === requestId) switching.value = false
  }
}
function selectEdition(id: string | null) {
  selectedEdition.value = id
  historical.value = id === 'global' || closedEditions.value.some((edition) => edition.id === id)
  if (eventId.value) {
    eventId.value = ''
    history.replaceState(null, '', '#/rankings')
  }
  void load()
}
function onHashChange() {
  if (location.hash === '#/rankings') {
    selectedEdition.value = null
    historical.value = false
  }
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
    <p v-if="loading" class="overview-message" role="status">Cargando clasificación…</p>
    <div v-else-if="error" class="overview-error" role="alert">
      <p>{{ error }}</p>
      <button class="overview-button" type="button" @click="load">Volver a intentar</button>
    </div>
    <section v-else class="overview-panel" aria-labelledby="ranking-title">
      <header class="overview-panel-heading">
        <h2 id="ranking-title">Clasificación</h2>
      </header>
      <p class="overview-ranking-edition">
        {{ overview?.edition?.name ?? 'Todas las ediciones' }} · puntos acumulados
      </p>
      <nav v-if="historical" class="ranking-selector" aria-label="Elegir edición histórica">
        <button
          type="button"
          :aria-pressed="selectedEdition === 'global'"
          @click="selectHistoricalEdition('global')"
        >
          General
        </button>
        <button
          v-for="edition in closedEditions"
          :key="edition.id"
          type="button"
          :aria-pressed="selectedEdition === edition.id"
          @click="selectHistoricalEdition(edition.id)"
        >
          {{ edition.name }}
        </button>
      </nav>
      <nav v-else class="ranking-selector" aria-label="Elegir clasificación">
        <button type="button" :aria-pressed="!eventId" @click="selectClassification('')">
          General
        </button>
        <button
          v-for="event in events"
          :key="event.id"
          type="button"
          :aria-pressed="eventId === event.id"
          @click="selectClassification(event.id)"
        >
          {{ event.name }}
        </button>
      </nav>
      <p v-if="switchError" class="overview-error" role="alert">{{ switchError }}</p>
      <div
        class="ranking-results"
        :aria-busy="switching"
        :class="{ 'ranking-results--loading': switching }"
      >
        <span v-if="switching" class="ranking-loading" role="status">Cargando clasificación…</span>
        <Transition name="ranking-list" mode="out-in">
          <div :key="`${selectedEdition}:${eventId}`">
            <ol v-if="standings.length" class="overview-ranking">
              <li v-for="entry in standings" :key="entry.id">
                <span class="overview-ranking-place">{{ entry.rank }}</span>
                <span class="ranking-person">
                  <span class="ranking-avatar" aria-hidden="true">
                    <img v-if="entry.avatar" :src="entry.avatar" alt="" loading="lazy" />
                    <span v-else>{{ entry.name.trim().charAt(0).toUpperCase() }}</span>
                  </span>
                  <span class="ranking-person-name">{{ entry.name }}</span>
                </span>
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
          </div>
        </Transition>
      </div>
    </section>
  </section>
</template>
