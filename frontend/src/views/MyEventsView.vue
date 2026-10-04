<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { ApiError, request } from '../api'
import { useAuthStore } from '../stores/auth'
import EventCover from '../components/events/EventCover.vue'
import '../styles/my-events.css'

interface EventSummary {
  id: string
  name: string
  image: string | null
  startDate: string | null
  endDate: string | null
  status: 'open' | 'closed' | 'draft'
  participantCount: number
  hasVoted: boolean
}

const auth = useAuthStore()
const events = ref<EventSummary[]>([])
const loading = ref(true)
const error = ref('')
const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | undefined
const groups = computed(() => {
  const active: EventSummary[] = []
  const upcoming: EventSummary[] = []
  const closed: EventSummary[] = []
  for (const event of events.value) {
    if (event.status === 'closed' || (event.endDate && Date.parse(event.endDate) <= now.value))
      closed.push(event)
    else if (
      event.status === 'draft' ||
      !event.startDate ||
      Date.parse(event.startDate) > now.value
    )
      upcoming.push(event)
    else active.push(event)
  }
  active.sort((a, b) => timestamp(a.endDate) - timestamp(b.endDate))
  upcoming.sort((a, b) => timestamp(a.startDate) - timestamp(b.startDate))
  closed.sort((a, b) => timestamp(b.endDate) - timestamp(a.endDate))
  return [
    { key: 'active', title: 'En curso', label: 'En curso', items: active },
    { key: 'upcoming', title: 'Próximos eventos', label: 'Próximo', items: upcoming },
    { key: 'closed', title: 'Eventos cerrados', label: 'Cerrado', items: closed },
  ]
})
const dateFormat = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})
const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
function timestamp(value: string | null) {
  return value ? Date.parse(value) : 0
}
function formatDate(value: string | null) {
  return value ? dateFormat.format(new Date(value)) : 'Sin definir'
}
async function loadEvents() {
  if (!auth.token) return
  loading.value = true
  error.value = ''
  try {
    events.value = await request<EventSummary[]>('/events', {}, auth.token)
    now.value = Date.now()
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 401) {
      auth.logout()
      return
    }
    error.value =
      cause instanceof ApiError
        ? 'No hemos podido cargar tus eventos. Inténtalo de nuevo en unos momentos.'
        : cause instanceof Error
          ? cause.message
          : 'No hemos podido cargar tus eventos.'
  } finally {
    loading.value = false
  }
}
onMounted(() => {
  void loadEvents()
  timer = setInterval(() => {
    now.value = Date.now()
  }, 1000)
})
onUnmounted(() => clearInterval(timer))
</script>

<template>
  <section class="my-events" aria-labelledby="my-events-title" :aria-busy="loading">
    <a class="events-back" href="#/profile">← Volver a mi perfil</a>
    <header class="events-heading">
      <span class="events-eyebrow">TU INVITACIÓN A LOS PREMIOS</span>
      <h1 id="my-events-title">Mis eventos</h1>
      <p>Las historias de las que formas parte. Aquí están los eventos en los que participas.</p>
    </header>
    <p v-if="loading" class="events-message" role="status">Cargando tus eventos…</p>
    <div v-else-if="error" class="events-message events-error" role="alert">
      <p>{{ error }}</p>
      <button type="button" @click="loadEvents">Volver a intentar</button>
    </div>
    <div v-else-if="!events.length" class="events-empty" role="status">
      <span class="empty-star" aria-hidden="true">✧</span>
      <h2>Todavía no has sido añadido a ningún evento.</h2>
      <p>Cuando te añadan a un evento, aparecerá aquí.</p>
    </div>
    <template v-else>
      <div class="events-overview" aria-label="Resumen de tus eventos">
        <div v-for="group in groups" :key="group.key">
          <strong>{{ group.items.length }}</strong>
          <span>{{ group.key === 'upcoming' ? 'Próximos' : group.title }}</span>
        </div>
      </div>
      <template v-for="group in groups" :key="group.key">
        <section
          v-if="group.items.length"
          class="events-group"
          :aria-labelledby="`events-${group.key}`"
        >
          <h2 :id="`events-${group.key}`">
            {{ group.title }} <span>{{ group.items.length }}</span>
          </h2>
          <ul class="events-list">
            <li v-for="event in group.items" :key="event.id">
              <article class="event-card" :class="`event-card--${group.key}`">
                <EventCover class="my-event-cover" :image="event.image" />
                <span class="event-badge"
                  ><span aria-hidden="true">●</span>
                  {{ event.status === 'draft' ? 'En preparación' : group.label }}</span
                >
                <h3>{{ event.name }}</h3>
                <dl class="event-dates">
                  <div>
                    <dt>Inicio</dt>
                    <dd>
                      <time v-if="event.startDate" :datetime="event.startDate">{{
                        formatDate(event.startDate)
                      }}</time>
                      <span v-else>Sin definir</span>
                    </dd>
                  </div>
                  <div>
                    <dt>Fin</dt>
                    <dd>
                      <time v-if="event.endDate" :datetime="event.endDate">{{
                        formatDate(event.endDate)
                      }}</time>
                      <span v-else>Sin definir</span>
                    </dd>
                  </div>
                </dl>
                <p class="event-participants">
                  {{ event.participantCount }}
                  {{ event.participantCount === 1 ? 'participante' : 'participantes' }}
                </p>
                <a
                  v-if="group.key === 'active'"
                  class="event-vote-link"
                  :href="`#/events/${event.id}/vote`"
                  >{{ event.hasVoted ? 'Ver tus votos' : 'Entrar a votar' }} →</a
                >
                <a
                  v-else-if="group.key === 'closed'"
                  class="event-vote-link"
                  :href="`#/events/${event.id}/vote`"
                  >Ver tus votos →</a
                >
              </article>
            </li>
          </ul>
        </section>
      </template>
      <p class="events-timezone">Fechas en tu zona horaria: {{ timezone }}.</p>
    </template>
  </section>
</template>
