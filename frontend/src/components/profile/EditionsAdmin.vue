<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ApiError, request, type EditionSummary } from '../../api'
import { useAuthStore } from '../../stores/auth'
const auth = useAuthStore()
const editions = ref<EditionSummary[]>([])
const loading = ref(true)
const saving = ref(false)
const reviewing = ref(false)
const error = ref('')
const success = ref('')
const leaders = ref<string[]>([])
const totalPoints = ref(0)
const active = computed(() => editions.value.find((edition) => edition.status === 'open'))
const dates = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Europe/Madrid',
})
async function load() {
  loading.value = true
  reviewing.value = false
  error.value = ''
  try {
    editions.value = await request<EditionSummary[]>('/editions', {}, auth.token ?? undefined)
  } catch (cause) {
    handleError(cause)
  } finally {
    loading.value = false
  }
}
function handleError(cause: unknown) {
  if (cause instanceof ApiError && cause.status === 401) auth.logout()
  else
    error.value =
      cause instanceof ApiError && cause.status === 409
        ? 'No se puede cerrar: quedan votaciones abiertas, la edición ya se ha cerrado o aún no ha comenzado. Actualiza para comprobarlo.'
        : cause instanceof Error
          ? cause.message
          : 'No hemos podido gestionar la edición.'
}
async function review() {
  if (!active.value || saving.value) return
  saving.value = true
  error.value = ''
  success.value = ''
  try {
    const overview = await request<{
      edition: EditionSummary
      standings: { name: string; rank: number; points: number }[]
    }>('/overview', {}, auth.token ?? undefined)
    if (overview.edition.id !== active.value.id) {
      await load()
      return
    }
    leaders.value = overview.standings
      .filter((entry) => entry.rank === 1)
      .map((entry) => entry.name)
    totalPoints.value = overview.standings.reduce((total, entry) => total + entry.points, 0)
    reviewing.value = true
  } catch (cause) {
    handleError(cause)
  } finally {
    saving.value = false
  }
}
async function close() {
  if (!active.value || saving.value || !reviewing.value) return
  saving.value = true
  error.value = ''
  try {
    const result = await request<{ closed: EditionSummary; opened: EditionSummary }>(
      `/editions/${active.value.id}/close`,
      { method: 'POST' },
      auth.token ?? undefined,
    )
    reviewing.value = false
    success.value = `${result.closed.name} cerrada. ${result.opened.name} admitirá eventos desde ${dates.format(new Date(result.opened.opensAt))}.`
    await load()
  } catch (cause) {
    handleError(cause)
  } finally {
    saving.value = false
  }
}
onMounted(() => void load())
</script>
<template>
  <section
    class="editions-admin"
    aria-labelledby="editions-admin-title"
    :aria-busy="loading || saving"
  >
    <h2 id="editions-admin-title">Gestionar ediciones</h2>
    <p v-if="loading" role="status">Cargando ediciones…</p>
    <template v-else-if="active">
      <h3>{{ active.name }}</h3>
      <p>Apertura: {{ dates.format(new Date(active.opensAt)) }}</p>
      <p>
        Fin orientativo: {{ dates.format(new Date(active.expectedEndsAt)) }}. El cierre es manual.
      </p>
      <div v-if="reviewing" class="edition-close-review">
        <h3>Confirmar el cierre de {{ active.name }}</h3>
        <p>
          Clasificación actual: {{ totalPoints }} puntos.
          {{
            leaders.length && totalPoints
              ? `En cabeza: ${leaders.join(', ')}.`
              : 'Todavía no hay ganador.'
          }}
        </p>
        <p>
          Se fijará la clasificación definitiva y se creará la siguiente edición, que admitirá
          eventos un minuto después. El resultado final incluirá todos los cierres que se hayan
          completado al confirmar.
        </p>
        <p>Si queda algún evento abierto, el cierre no se realizará.</p>
        <button type="button" :disabled="saving" @click="close">
          {{ saving ? 'Cerrando…' : 'Confirmar cierre e iniciar siguiente edición' }}
        </button>
        <button type="button" :disabled="saving" @click="reviewing = false">Cancelar</button>
      </div>
      <button v-else type="button" :disabled="saving" @click="review">
        Cerrar edición e iniciar la siguiente
      </button>
    </template>
    <div v-if="error" role="alert">
      <p>{{ error }}</p>
      <button type="button" :disabled="saving" @click="load">Actualizar</button>
    </div>
    <p v-if="success" role="status">{{ success }}</p>
    <ul v-if="editions.some((edition) => edition.status === 'closed')">
      <li v-for="edition in editions.filter((item) => item.status === 'closed')" :key="edition.id">
        {{ edition.name }} · Cerrada el
        {{ edition.closedAt ? dates.format(new Date(edition.closedAt)) : '—' }}
      </li>
    </ul>
  </section>
</template>
<style scoped>
.editions-admin {
  margin: 24px 0;
  padding: 20px;
  border: 1px solid #96702f;
  border-radius: 12px;
  background: #17140f;
}
h2,
h3 {
  color: var(--gold);
}
p,
li {
  color: var(--muted);
  font-size: 13px;
  line-height: 1.7;
  overflow-wrap: anywhere;
}
button {
  min-height: 44px;
  margin: 8px 8px 0 0;
  padding: 10px 14px;
  border: 1px solid var(--gold);
  border-radius: 8px;
  background: transparent;
  color: var(--gold);
  font: inherit;
  cursor: pointer;
}
button:disabled {
  opacity: 0.5;
  cursor: default;
}
button:focus-visible {
  outline: 2px solid var(--gold);
  outline-offset: 3px;
}
.edition-close-review {
  padding: 12px;
  border: 1px solid #96702f;
  border-radius: 8px;
}
</style>
