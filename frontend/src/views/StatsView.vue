<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { ApiError, request, type EditionSummary } from '../api'
import { useAuthStore } from '../stores/auth'
import '../styles/overview.css'
import '../styles/stats.css'

interface Stats {
  scope: 'edition' | 'global'
  editions: EditionSummary[]
  editionId: string | null
  editionName: string | null
  calculatedAt: string | null
  awards: {
    id: string
    title: string
    description: string
    votes: number
    people: { id: string; name: string; avatar: string | null }[]
  }[]
}
const auth = useAuthStore()
const data = ref<Stats | null>(null)
const loading = ref(true)
const error = ref('')
const selected = ref<string | null>(null)
const availableEditions = computed(() => data.value?.editions ?? [])
const selectedEdition = computed(() =>
  availableEditions.value.find((edition) => edition.id === selected.value),
)
let requestId = 0
async function load(selection = selected.value) {
  if (!auth.token) return
  const currentRequest = ++requestId
  selected.value = selection
  loading.value = true
  error.value = ''
  try {
    const response = await request<Stats>(
      selection === null ? '/stats' : `/stats?edition=${encodeURIComponent(selection)}`,
      {},
      auth.token,
    )
    if (currentRequest !== requestId) return
    data.value = response
    selected.value = response.scope === 'global' ? 'global' : response.editionId
  } catch (cause) {
    if (currentRequest !== requestId) return
    if (cause instanceof ApiError && cause.status === 401) auth.logout()
    else
      error.value =
        cause instanceof Error ? cause.message : 'No hemos podido cargar las estadísticas.'
  } finally {
    if (currentRequest === requestId) loading.value = false
  }
}
function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
}
const dateFormat = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Europe/Madrid',
})
onMounted(() => void load())
onUnmounted(() => {
  requestId++
})
</script>

<template>
  <section class="stats overview" aria-labelledby="stats-title" :aria-busy="loading">
    <a class="overview-text-button" href="#/overview">← Volver a Home</a>
    <header class="stats-heading">
      <span class="overview-edition">FANGÓN DE ORO</span>
      <h1 id="stats-title">STATS</h1>
      <p v-if="selected === 'global'">Todas las ediciones en números.</p>
      <p v-else>La edición {{ selectedEdition?.number ?? 'actual' }} en números.</p>
    </header>
    <nav class="stats-navigation" aria-label="Elegir estadísticas">
      <button
        v-for="edition in availableEditions"
        :key="edition.id"
        class="overview-button"
        :class="{ 'overview-button--gold': selected === edition.id }"
        :aria-pressed="selected === edition.id"
        type="button"
        @click="load(edition.id)"
      >
        {{ edition.name }}
      </button>
      <button
        class="overview-button"
        :class="{ 'overview-button--gold': selected === 'global' }"
        :aria-pressed="selected === 'global'"
        type="button"
        @click="load('global')"
      >
        Globales
      </button>
    </nav>
    <p v-if="loading" class="overview-message" role="status">Cargando estadísticas…</p>
    <div v-else-if="error" class="overview-error" role="alert">
      <p>{{ error }}</p>
      <button class="overview-button" type="button" @click="load()">Volver a intentar</button>
    </div>
    <p v-else-if="!data?.awards.length" class="overview-message" role="status">
      Aun no hay estadísticas para mostrar
    </p>
    <template v-else>
      <p v-if="data.calculatedAt" class="overview-ranking-edition stats-updated">
        Actualizada el {{ dateFormat.format(new Date(data.calculatedAt)) }}
      </p>
      <div class="stats-grid">
        <section
          v-for="award in data.awards"
          :key="award.id"
          class="stats-card"
          :aria-labelledby="`stats-${award.id}`"
        >
          <h2 :id="`stats-${award.id}`">{{ award.title }}</h2>
          <p class="stats-description">{{ award.description }}</p>
          <ul v-if="award.people.length" class="stats-people">
            <li v-for="person in award.people.slice(0, 1)" :key="person.id">
              <div class="stats-avatar">
                <img v-if="person.avatar" :src="person.avatar" alt="" />
                <span v-else aria-hidden="true">{{ initials(person.name) }}</span>
              </div>
              <strong>{{ person.name }}</strong>
            </li>
          </ul>
          <p v-else class="stats-description">Todavía nadie ha recibido este tipo de voto.</p>
        </section>
      </div>
    </template>
  </section>
</template>
