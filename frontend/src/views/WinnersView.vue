<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { ApiError, request, type EditionSummary } from '../api'
import { useAuthStore } from '../stores/auth'
import { winnerEditions, refreshWinners } from '../composables/useWinners'

interface Winner {
  id: string
  name: string
  avatar: string | null
  points: number
}
type Award = 'gold' | 'silver' | 'bronze' | 'goldenUnderpants'
const assetBase = import.meta.env.BASE_URL
const banners: { key: Award; title: string; number: string; subtitle: string }[] = [
  { key: 'gold', title: 'Fangón de Oro', number: '01', subtitle: 'En lo más alto' },
  {
    key: 'silver',
    title: 'Fangón de Plata',
    number: '02',
    subtitle: 'Una temporada para recordar',
  },
  { key: 'bronze', title: 'Fangón de Bronce', number: '03', subtitle: 'Un sitio en el podio' },
  {
    key: 'goldenUnderpants',
    title: 'Calzón de Oro',
    number: '✦',
    subtitle: 'El premio que nadie quiere ganar',
  },
]
const auth = useAuthStore()
const editions = computed(() =>
  winnerEditions.value.filter(
    (edition) => auth.user?.role === 'ADMIN' || edition.status === 'closed',
  ),
)
const selected = ref('')
const result = ref<{
  edition: EditionSummary
  preview: boolean
  awards: Record<Award, Winner[]>
} | null>(null)
const loading = ref(true)
const error = ref('')
let revision = 0
async function load() {
  const current = ++revision
  loading.value = true
  error.value = ''
  result.value = null
  try {
    if (!selected.value) {
      const loaded = await refreshWinners(auth.token)
      if (current !== revision) return
      if (!loaded) throw new Error('No hemos podido cargar las ediciones. Inténtalo de nuevo.')
      selected.value = editions.value[0]?.id ?? ''
    }
    if (!selected.value) {
      location.hash = '/overview'
      return
    }
    const data = await request<NonNullable<typeof result.value>>(
      `/editions/${encodeURIComponent(selected.value)}/winners`,
      {},
      auth.token ?? undefined,
    )
    if (current === revision) result.value = data
  } catch (cause) {
    if (current !== revision) return
    if (cause instanceof ApiError && cause.status === 401) auth.logout()
    error.value = cause instanceof Error ? cause.message : 'No hemos podido cargar los premios.'
  } finally {
    if (current === revision) loading.value = false
  }
}
onMounted(() => void load())
onUnmounted(() => revision++)
</script>

<template>
  <section class="winners" aria-labelledby="winners-title" :aria-busy="loading">
    <header class="winners-heading">
      <p class="winners-eyebrow">LA TEMPORADA TIENE NOMBRES PROPIOS</p>
      <h1 id="winners-title">Ganadores<span>Una edición. Su leyenda.</span></h1>
      <label v-if="editions.length > 1" class="winners-selector">
        Edición
        <select v-model="selected" @change="load">
          <option v-for="edition in editions" :key="edition.id" :value="edition.id">
            {{ edition.name }}{{ edition.status === 'open' ? ' · Vista previa' : '' }}
          </option>
        </select>
      </label>
      <p v-else-if="result">{{ result.edition.name }}</p>
      <p v-if="result?.preview" role="status">
        Vista previa solo para administradores. Resultados provisionales de eventos cerrados; los
        premios y el sorteo de desempate se fijarán al cerrar la temporada.
      </p>
    </header>
    <p v-if="loading" role="status">Preparando el palmarés…</p>
    <div v-else-if="error" role="alert">
      <p>{{ error }}</p>
      <button type="button" @click="load">Volver a intentar</button>
    </div>
    <div v-else-if="result" class="winners-banners">
      <article
        v-for="banner in banners"
        :key="banner.key"
        class="award-banner"
        :class="`award-banner--${banner.key}`"
      >
        <div class="award-artwork">
          <img
            :src="`${assetBase}images/awards/${banner.key}.png`"
            alt=""
            :loading="banner.key === 'gold' ? 'eager' : 'lazy'"
            width="2048"
            height="768"
          />
          <span v-if="banner.key === 'goldenUnderpants'" class="award-shame-stamp"
            >Premio de<br />la vergüenza</span
          >
        </div>
        <div class="award-content">
          <div class="award-caption">
            <p class="winners-eyebrow">{{ banner.subtitle }}</p>
            <h2>{{ banner.title }}</h2>
            <span v-if="banner.key === 'goldenUnderpants'" class="award-last-place"
              >Último de la clasificación</span
            >
            <span v-else class="award-place">{{ banner.number }} · PODIO</span>
          </div>
          <div class="award-recipients">
            <div v-for="winner in result.awards[banner.key]" :key="winner.id" class="award-person">
              <img v-if="winner.avatar" :src="winner.avatar" alt="" />
              <span v-else class="award-avatar" aria-hidden="true">{{
                winner.name.charAt(0).toUpperCase()
              }}</span>
              <div>
                <h3>{{ winner.name }}</h3>
                <p>{{ winner.points }} puntos</p>
              </div>
            </div>
            <p v-if="!result.awards[banner.key].length" class="award-empty">Premio desierto</p>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped src="../styles/winners.css"></style>
