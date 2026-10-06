<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { ApiError, request } from '../api'
import { useAuthStore } from '../stores/auth'
import EventCover from '../components/events/EventCover.vue'
import '../styles/overview.css'

interface Standing {
  id: string
  name: string
  avatar: string | null
  points: number
  rank: number
}
interface EditionEvent {
  image: string | null
  id: string
  name: string
  startDate: string
  endDate: string | null
  status: string
  participantCount: number
  canVote: boolean
  hasVoted: boolean
}
interface Overview {
  year: number
  rankingYear: number
  serverTime: string
  calculatedAt: string | null
  standings: Standing[]
  events: EditionEvent[]
}
const auth = useAuthStore()
const data = ref<Overview | null>(null)
const loading = ref(true)
const error = ref('')
const now = ref(Date.now())
let offset = 0
let timer: ReturnType<typeof setInterval> | undefined
let refreshTimer: ReturnType<typeof setInterval> | undefined
let refreshing = false
const yearFormat = new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Europe/Madrid' })
const currentYear = computed(() => Number(yearFormat.format(now.value)))
const groups = computed(() => {
  const events = (data.value?.events ?? []).filter(
    (event) => Number(yearFormat.format(new Date(event.startDate))) === currentYear.value,
  )
  const past = (event: EditionEvent) =>
    event.status === 'closed' || (!!event.endDate && Date.parse(event.endDate) <= now.value)
  return [
    {
      key: 'active',
      title: 'Votaciones activas',
      icon: '◷',
      events: events.filter(
        (event) =>
          !past(event) && event.status === 'open' && Date.parse(event.startDate) <= now.value,
      ),
    },
    {
      key: 'upcoming',
      title: 'Próximos eventos',
      icon: '◇',
      events: events
        .filter(
          (event) =>
            !past(event) && (event.status !== 'open' || Date.parse(event.startDate) > now.value),
        )
        .sort((a, b) => Date.parse(a.startDate) - Date.parse(b.startDate)),
    },
    { key: 'past', title: 'Votaciones pasadas', icon: '≡', events: events.filter(past) },
  ]
})
const podium = computed(() => {
  const top = data.value?.standings.slice(0, 3) ?? []
  return [top[1], top[0], top[2]].filter((entry): entry is Standing => !!entry)
})
const dates = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  timeZone: 'Europe/Madrid',
})
function date(value: string) {
  return dates.format(new Date(value))
}
function closing(value: string | null) {
  if (!value) return 'Sin fecha de cierre'
  const days = Math.ceil((Date.parse(value) - now.value) / 86400000)
  return days > 1 ? `Cierra en ${days} días` : 'Cierra en menos de un día'
}
function message(cause: unknown) {
  if (cause instanceof ApiError && cause.status === 401) auth.logout()
  return cause instanceof Error ? cause.message : 'No hemos podido cargar la información.'
}
async function load(silent = false) {
  if (!auth.token || refreshing) return
  refreshing = true
  if (!silent) loading.value = true
  error.value = ''
  try {
    data.value = await request<Overview>('/overview', {}, auth.token)
    offset = Date.parse(data.value.serverTime) - Date.now()
    now.value = Date.now() + offset
  } catch (cause) {
    error.value = message(cause)
  } finally {
    loading.value = false
    refreshing = false
  }
}
onMounted(() => {
  void load()
  timer = setInterval(() => {
    now.value = Date.now() + offset
    if (data.value && currentYear.value !== data.value.year) {
      void load(true)
    }
  }, 1000)
  refreshTimer = setInterval(() => void load(true), 30000)
})
onUnmounted(() => {
  clearInterval(timer)
  clearInterval(refreshTimer)
})
</script>

<template>
  <section class="overview" aria-label="Vista general del Fangón de Oro" :aria-busy="loading">
    <header class="overview-hero">
      <div class="overview-art" aria-hidden="true"></div>
      <div class="overview-hero-caption">
        <span class="overview-edition">EDICIÓN {{ currentYear }}</span>
        <h1>¿Quién será<br />el ganador?</h1>
        <p>Un año de historias. Un Fangón de Oro.</p>
      </div>
    </header>
    <div class="overview-content">
      <p v-if="loading" class="overview-message" role="status">Cargando la edición…</p>
      <div v-if="error" class="overview-error" role="alert">
        <p>{{ error }}</p>
        <button class="overview-button" type="button" @click="load()">Volver a intentar</button>
      </div>
      <template v-if="data && !loading">
        <section class="overview-panel" aria-labelledby="standings-title">
          <header class="overview-panel-heading">
            <h2 id="standings-title"><span aria-hidden="true">♛</span> Clasificación general</h2>
            <a class="overview-text-button" href="#/rankings"
              >Ver completa <span aria-hidden="true">›</span></a
            >
          </header>
          <p class="overview-ranking-edition">Edición {{ data.rankingYear }} · puntos acumulados</p>
          <p v-if="data.calculatedAt" class="overview-ranking-edition">
            Actualizada el {{ date(data.calculatedAt) }}
          </p>
          <p v-if="data.rankingYear !== currentYear" class="overview-message">
            La clasificación anterior se mantiene hasta que se cierre el primer evento de
            {{ currentYear }}.
          </p>
          <div v-if="podium.length" class="overview-podium">
            <article
              v-for="entry in podium"
              :key="entry.id"
              class="overview-medalist"
              :class="`overview-medalist--${entry.rank}`"
            >
              <div class="overview-medal">
                <img v-if="entry.avatar" :src="entry.avatar" alt="" />
                <span v-else class="overview-initial" aria-hidden="true">{{
                  entry.name.slice(0, 1).toUpperCase()
                }}</span>
                <span class="overview-rank">{{ entry.rank }}</span>
              </div>
              <h3>{{ entry.name }}</h3>
              <p>{{ entry.points }} puntos</p>
            </article>
          </div>
          <p v-else class="overview-message">
            Todavía no hay clasificación. Se actualizará cuando se cierre el primer evento.
          </p>
        </section>
        <section
          v-for="group in groups"
          :key="group.key"
          class="overview-panel"
          :aria-labelledby="`overview-${group.key}`"
        >
          <header class="overview-panel-heading">
            <h2 :id="`overview-${group.key}`">
              <span aria-hidden="true">{{ group.icon }}</span> {{ group.title }}
            </h2>
            <span class="overview-event-count">{{ group.events.length }}</span>
          </header>
          <p v-if="!group.events.length" class="overview-message">
            {{
              group.key === 'active'
                ? 'No hay votaciones abiertas ahora mismo.'
                : group.key === 'upcoming'
                  ? 'Todavía no hay próximos eventos este año.'
                  : 'Todavía no hay eventos finalizados este año.'
            }}
          </p>
          <ul v-else class="overview-event-list">
            <li v-for="event in group.events" :key="event.id" class="overview-event">
              <EventCover class="overview-event-cover" :image="event.image" />
              <div class="overview-event-date" aria-hidden="true">
                <span>{{ date(event.startDate) }}</span
                ><span>✦</span>
              </div>
              <div class="overview-event-info">
                <h3>{{ event.name }}</h3>
                <p>{{ event.participantCount }} participantes</p>
                <p>{{ group.key === 'active' ? closing(event.endDate) : date(event.startDate) }}</p>
              </div>
              <a
                v-if="group.key === 'active' && event.canVote"
                class="overview-button overview-button--gold"
                :href="`#/events/${event.id}/vote`"
                >{{ event.hasVoted ? 'Ver tus votos' : 'Votar' }}</a
              >
              <a
                v-else-if="group.key === 'past'"
                class="overview-button"
                :href="`#/rankings/events/${encodeURIComponent(event.id)}`"
                >Ver resultados</a
              >
              <span v-else class="overview-event-label">{{
                group.key === 'upcoming' ? 'Próximamente' : 'En curso'
              }}</span>
            </li>
          </ul>
        </section>
        <p class="overview-calendar">
          Edición {{ currentYear }} · 1 de enero — 31 de diciembre<br />Fechas en horario de Madrid.
        </p>
      </template>
    </div>
  </section>
</template>
