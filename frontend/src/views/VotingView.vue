<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { ApiError, request } from '../api'
import { useAuthStore } from '../stores/auth'
import EventCover from '../components/events/EventCover.vue'
import '../styles/my-events.css'
import '../styles/voting.css'

interface EventDetail {
  id: string
  name: string
  image: string | null
  description: string | null
  status: 'open' | 'closed' | 'draft'
  startDate: string | null
  endDate: string | null
  participants: { id: string; name: string }[]
}
interface Vote {
  allocations: { votedUserId: string; points: number }[]
}
const auth = useAuthStore()
const event = ref<EventDetail | null>(null)
const vote = ref<Vote | null>(null)
const selections = ref(['', '', ''])
const points = [5, 3, 1]
const loading = ref(true)
const saving = ref(false)
const reviewing = ref(false)
const reviewHeading = ref<HTMLHeadingElement | null>(null)
const firstSelection = ref<HTMLSelectElement | null>(null)
const error = ref('')
const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | undefined
const candidates = computed(
  () => event.value?.participants.filter((p) => p.id !== auth.user?.id) ?? [],
)
const isOpen = computed(
  () =>
    event.value?.status === 'open' &&
    !!event.value.startDate &&
    !!event.value.endDate &&
    Date.parse(event.value.startDate) <= now.value &&
    Date.parse(event.value.endDate) > now.value,
)
const canSubmit = computed(
  () =>
    isOpen.value &&
    candidates.value.length >= 3 &&
    selections.value.every((id) => candidates.value.some((p) => p.id === id)) &&
    new Set(selections.value).size === 3,
)
const reviewAllocations = computed(() =>
  selections.value.map((id, index) => ({
    id,
    points: points[index],
    name: candidates.value.find((candidate) => candidate.id === id)?.name ?? 'Participante',
  })),
)
async function review() {
  if (!canSubmit.value || saving.value || vote.value) return
  error.value = ''
  reviewing.value = true
  await nextTick()
  reviewHeading.value?.focus()
}
async function cancelReview() {
  if (saving.value) return
  reviewing.value = false
  error.value = ''
  await nextTick()
  firstSelection.value?.focus()
}
function eventId() {
  return location.hash.split('/')[2] ?? ''
}
function handleError(cause: unknown) {
  if (cause instanceof ApiError && cause.status === 401) {
    auth.logout()
    return
  }
  error.value =
    cause instanceof ApiError
      ? ({
          400: 'Selecciona tres participantes distintos. No puedes votarte a ti mismo.',
          403: 'Solo los participantes de este evento pueden votar.',
          404: 'Este evento no está disponible.',
          409: 'La votación ha terminado o ya has registrado tu voto. Actualiza para comprobarlo.',
        }[cause.status] ?? 'No hemos podido completar la operación. Inténtalo de nuevo.')
      : cause instanceof Error
        ? cause.message
        : 'No hemos podido conectar con el servidor.'
}
async function load() {
  if (!auth.token || !/^#\/events\/[^/]+\/vote$/.test(location.hash)) return
  loading.value = true
  error.value = ''
  event.value = null
  vote.value = null
  reviewing.value = false
  selections.value = ['', '', '']
  try {
    const id = eventId()
    const [detail, existingVote] = await Promise.all([
      request<EventDetail>(`/events/${id}`, {}, auth.token),
      request<Vote | null>(`/events/${id}/votes/me`, {}, auth.token),
    ])
    event.value = detail
    vote.value = existingVote
    now.value = Date.now()
  } catch (cause) {
    handleError(cause)
  } finally {
    loading.value = false
  }
}
async function submit() {
  if (!reviewing.value || !canSubmit.value || saving.value || vote.value || !auth.token) return
  saving.value = true
  error.value = ''
  try {
    vote.value = await request<Vote>(
      `/events/${eventId()}/votes`,
      {
        method: 'POST',
        body: JSON.stringify({ candidateIds: selections.value }),
      },
      auth.token,
    )
    reviewing.value = false
  } catch (cause) {
    handleError(cause)
  } finally {
    saving.value = false
  }
}
onMounted(() => {
  void load()
  window.addEventListener('hashchange', load)
  timer = setInterval(() => {
    now.value = Date.now()
  }, 1000)
})
onUnmounted(() => {
  clearInterval(timer)
  window.removeEventListener('hashchange', load)
})
</script>

<template>
  <section class="my-events voting" aria-labelledby="voting-title" :aria-busy="loading || saving">
    <a class="events-back" href="#/overview">← Volver a la general</a>
    <EventCover v-if="event" class="voting-event-cover" :image="event.image" />
    <header class="events-heading">
      <span class="events-eyebrow">TU VOZ EN LOS PREMIOS</span>
      <h1 id="voting-title">{{ event?.name ?? 'Votación' }}</h1>
      <p v-if="event?.description">{{ event.description }}</p>
    </header>
    <p v-if="loading" class="events-message" role="status">Cargando la votación…</p>
    <template v-else>
      <div v-if="error" class="events-message events-error" role="alert">
        <p>{{ error }}</p>
        <button type="button" :disabled="saving" @click="load">Actualizar votación</button>
      </div>
      <div v-if="vote" class="vote-confirmation" role="status">
        <h2>Tu voto está registrado</h2>
        <p>Gracias por participar. Tu voto es definitivo.</p>
        <dl class="vote-summary">
          <div v-for="allocation in vote.allocations" :key="allocation.points">
            <dt>{{ allocation.points }} puntos</dt>
            <dd>
              {{
                event?.participants.find((p) => p.id === allocation.votedUserId)?.name ??
                'Participante'
              }}
            </dd>
          </div>
        </dl>
      </div>
      <p v-else-if="event && !isOpen" class="events-message" role="status">
        {{
          event.status === 'closed' || (event.endDate && Date.parse(event.endDate) <= now)
            ? 'La votación ha terminado.'
            : 'La votación todavía no está abierta.'
        }}
      </p>
      <p v-else-if="event && candidates.length < 3" class="events-message" role="status">
        Se necesitan al menos tres participantes más para repartir tus puntos.
      </p>
      <section
        v-else-if="event && reviewing"
        class="vote-confirmation"
        aria-labelledby="vote-review-title"
        :aria-busy="saving"
      >
        <h2 id="vote-review-title" ref="reviewHeading" tabindex="-1">Revisa tu voto</h2>
        <p>Este es tu reparto de puntos para {{ event.name }}.</p>
        <dl class="vote-summary">
          <div v-for="allocation in reviewAllocations" :key="allocation.id">
            <dt>{{ allocation.points }} {{ allocation.points === 1 ? 'punto' : 'puntos' }}</dt>
            <dd>{{ allocation.name }}</dd>
          </div>
        </dl>
        <p>Al confirmar, tu voto quedará registrado y no podrás modificarlo.</p>
        <div class="vote-review-actions">
          <button
            class="vote-submit"
            type="button"
            :disabled="saving || !canSubmit"
            @click="submit"
          >
            {{ saving ? 'Registrando voto…' : 'Confirmar y enviar voto' }}
          </button>
          <button class="vote-cancel" type="button" :disabled="saving" @click="cancelReview">
            Cancelar y volver al formulario
          </button>
        </div>
      </section>
      <form v-else-if="event" class="voting-form" @submit.prevent="review">
        <p id="voting-instructions">
          Reparte 5, 3 y 1 punto entre tres participantes distintos. No puedes votarte a ti mismo.
        </p>
        <fieldset :disabled="saving" aria-describedby="voting-instructions">
          <legend class="vote-legend">Vota al mayor fangón de {{ event.name }}</legend>
          <div v-for="(score, index) in points" :key="score" class="vote-field">
            <label :for="`vote-${score}`"
              ><span>{{ score }}</span> {{ score === 1 ? 'punto' : 'puntos' }}</label
            >
            <select
              :id="`vote-${score}`"
              :ref="
                (element) => {
                  if (index === 0) firstSelection = element as HTMLSelectElement | null
                }
              "
              v-model="selections[index]"
              required
            >
              <option disabled value="">Selecciona un participante</option>
              <option
                v-for="candidate in candidates"
                :key="candidate.id"
                :value="candidate.id"
                :disabled="
                  selections.some((id, position) => position !== index && id === candidate.id)
                "
              >
                {{ candidate.name }}
              </option>
            </select>
          </div>
          <p class="vote-hint">
            Revisa tu elección antes de enviarla. Una vez registrado, no podrás cambiar tu voto.
          </p>
          <button class="vote-submit" type="submit" :disabled="!canSubmit || saving">
            Revisar mi voto
          </button>
        </fieldset>
      </form>
    </template>
  </section>
</template>
