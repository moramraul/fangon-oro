<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { request, type EditionSummary } from '../api'
import { useAuthStore } from '../stores/auth'
import '../styles/overview.css'
import '../styles/rankings.css'

interface Reveal {
  edition: EditionSummary
  publication: { state: string; nextRevealAt: string | null }
  standings: { id: string; name: string; avatar: string | null; points: number; rank: number }[]
}
const auth = useAuthStore()
const data = ref<Reveal | null>(null)
const error = ref('')
let timer: ReturnType<typeof setInterval> | undefined
let disposed = false
let busy = false
async function load() {
  if (!auth.token || busy) return
  busy = true
  try {
    const id = location.hash.split('/')[2] ?? ''
    const result = await request<Reveal>(
      `/overview/reveal/${encodeURIComponent(id)}`,
      {},
      auth.token,
    )
    if (!disposed) {
      data.value = result
      error.value = ''
    }
  } catch (cause) {
    if (!disposed)
      error.value = cause instanceof Error ? cause.message : 'No se pudo cargar la revelación.'
  } finally {
    busy = false
  }
}
onMounted(() => {
  void load()
  timer = setInterval(() => {
    if (data.value?.publication.state !== 'published') void load()
  }, 30000)
  window.addEventListener('hashchange', load)
})
onUnmounted(() => {
  disposed = true
  clearInterval(timer)
  window.removeEventListener('hashchange', load)
})
</script>

<template>
  <section class="rankings overview" aria-labelledby="reveal-title">
    <a class="overview-text-button" href="#/overview">Volver a Home</a>
    <header class="rankings-heading">
      <span class="overview-edition">{{ data?.edition.name }}</span>
      <h1 id="reveal-title">La gran revelación</h1>
      <p>Cinco puestos cada 30 minutos, desde el último hasta los ganadores.</p>
    </header>
    <p v-if="error" class="overview-error" role="alert">{{ error }}</p>
    <section v-if="data" class="overview-panel" aria-live="polite">
      <p v-if="data.publication.state === 'hidden'">
        La revelación comenzará al cerrar la temporada.
      </p>
      <p v-else-if="data.publication.state === 'published'">
        ¡Ya conocemos a los ganadores! Todas las clasificaciones de esta edición están disponibles.
        <a :href="`#/rankings/editions/${data.edition.id}`">Ver clasificaciones</a>
      </p>
      <p v-else-if="data.publication.state === 'admin'">
        Vista ADMIN: puedes ver la clasificación completa.
      </p>
      <p v-if="data.publication.nextRevealAt">
        Próximo bloque:
        {{
          new Date(data.publication.nextRevealAt).toLocaleString('es-ES', {
            timeZone: 'Europe/Madrid',
          })
        }}
      </p>
      <ol class="overview-ranking">
        <li v-for="entry in data.standings" :key="entry.id">
          <span class="overview-ranking-place">{{ entry.rank }}</span>
          <span class="ranking-person-name">{{ entry.name }}</span>
          <strong>{{ entry.points }} <small>pts</small></strong>
        </li>
      </ol>
    </section>
    <p v-else-if="!error" role="status">Cargando revelación…</p>
  </section>
</template>
