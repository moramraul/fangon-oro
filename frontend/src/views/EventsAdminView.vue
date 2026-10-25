<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { ApiError, request, type EditionSummary } from '../api'
import { useAuthStore } from '../stores/auth'
import EventCover from '../components/events/EventCover.vue'
interface ListedEvent {
  id: string
  editionId: string | null
  name: string
  image: string | null
  status: string
  startDate: string | null
  endDate: string | null
  participantCount: number
  isTest: boolean
}
const auth = useAuthStore()
const events = ref<ListedEvent[]>([])
const editions = ref<EditionSummary[]>([])
const search = ref('')
const edition = ref('all')
const status = ref('all')
const kind = ref('all')
const loading = ref(true)
const busy = ref(false)
const error = ref('')
const success = ref('')
const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | undefined
const visibleEvents = computed(() =>
  events.value.filter(
    (event) =>
      event.name.toLocaleLowerCase('es').includes(search.value.trim().toLocaleLowerCase('es')) &&
      (edition.value === 'all' || (event.editionId ?? '') === edition.value) &&
      (status.value === 'all' || event.status === status.value) &&
      (kind.value === 'all' || event.isTest === (kind.value === 'test')),
  ),
)
const dateFormat = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' })
function date(value: string | null) {
  return value ? dateFormat.format(new Date(value)) : 'Sin fecha'
}
function canDelete(event: ListedEvent) {
  return (
    event.isTest ||
    (event.status === 'open' && !!event.startDate && Date.parse(event.startDate) > now.value)
  )
}
function handleError(cause: unknown) {
  if (cause instanceof ApiError && cause.status === 401) auth.logout()
  error.value =
    cause instanceof ApiError
      ? ({
          403: 'Solo los administradores pueden gestionar eventos.',
          404: 'El evento ya no existe. Actualiza el listado.',
          409: 'El evento ha cambiado. Los eventos oficiales solo se pueden borrar antes de empezar y no se pueden reabrir.',
        }[cause.status] ?? 'No se ha podido completar la operación. Inténtalo de nuevo.')
      : 'No se ha podido conectar con el servidor.'
}
async function loadEvents() {
  if (!auth.token || auth.user?.role !== 'ADMIN') return
  loading.value = true
  error.value = ''
  try {
    const [data, editionData] = await Promise.all([
      request<ListedEvent[]>('/admin/events', {}, auth.token),
      request<EditionSummary[]>('/editions', {}, auth.token),
    ])
    events.value = data
    editions.value = editionData
    now.value = Date.now()
  } catch (cause) {
    handleError(cause)
  } finally {
    loading.value = false
  }
}
function editEvent(id: string) {
  if (!busy.value) location.hash = `/events/manage/${encodeURIComponent(id)}`
}
async function changeEvent(event: ListedEvent, action: 'close' | 'delete') {
  if (busy.value || loading.value || !auth.token || auth.user?.role !== 'ADMIN') return
  const deleting = action === 'delete'
  if (deleting ? !canDelete(event) : event.status !== 'open') return
  const warning = deleting
    ? event.isTest
      ? 'Se eliminarán el evento y todos sus votos y respuestas.'
      : 'El evento se eliminará permanentemente.'
    : event.isTest
      ? 'La votación terminará y se podrá consultar el muro de respuestas.'
      : 'La votación terminará y se guardarán sus clasificaciones definitivas. No se podrá reabrir.'
  if (!window.confirm(`¿${deleting ? 'Borrar' : 'Cerrar'} ${event.name}?\n\n${warning}`)) return
  busy.value = true
  error.value = ''
  success.value = ''
  try {
    if (deleting) {
      await request(`/events/${encodeURIComponent(event.id)}`, { method: 'DELETE' }, auth.token)
      events.value = events.value.filter((item) => item.id !== event.id)
      success.value = `Se ha borrado ${event.name}.`
    } else {
      const updated = await request<ListedEvent>(
        `/events/${encodeURIComponent(event.id)}/status`,
        { method: 'PATCH', body: JSON.stringify({ status: 'closed' }) },
        auth.token,
      )
      events.value = events.value.map((item) =>
        item.id === event.id ? { ...item, ...updated } : item,
      )
      success.value = `Se ha cerrado ${event.name}.`
    }
  } catch (cause) {
    handleError(cause)
  } finally {
    busy.value = false
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
  <section
    class="users-admin events-admin"
    aria-labelledby="events-title"
    :aria-busy="loading || busy"
  >
    <a class="back" href="#/profile">← Volver al perfil</a>
    <header>
      <span class="eyebrow">ADMINISTRACIÓN</span>
      <h1 id="events-title">Eventos</h1>
      <p>Consulta y gestiona los eventos del Fangón de Oro.</p>
    </header>
    <div class="toolbar">
      <a class="create-event" href="#/events/manage">Crear evento</a>
      <button type="button" :disabled="busy || loading" @click="loadEvents">Actualizar</button>
    </div>
    <div class="event-filters">
      <label
        >Buscar evento<input v-model="search" type="search" placeholder="Nombre del evento"
      /></label>
      <label
        >Edición<select v-model="edition">
          <option value="all">Todas</option>
          <option v-for="item in editions" :key="item.id" :value="item.id">{{ item.name }}</option>
          <option v-if="events.some((event) => !event.editionId)" value="">Sin edición</option>
        </select></label
      >
      <label
        >Estado<select v-model="status">
          <option value="all">Todos</option>
          <option value="open">Abiertos</option>
          <option value="closed">Cerrados</option>
          <option value="draft">En preparación</option>
        </select></label
      >
      <label
        >Tipo<select v-model="kind">
          <option value="all">Todos</option>
          <option value="official">Oficiales</option>
          <option value="test">Pruebas</option>
        </select></label
      >
    </div>
    <p v-if="loading" role="status">Cargando eventos…</p>
    <div v-if="error" class="error" role="alert">
      <p>{{ error }}</p>
    </div>
    <p class="success" role="status">{{ success }}</p>
    <template v-if="!loading">
      <p class="count">{{ visibleEvents.length }} de {{ events.length }} eventos</p>
      <p v-if="!visibleEvents.length && !error">No hay eventos para estos filtros.</p>
      <ul v-else class="user-list">
        <li v-for="event in visibleEvents" :key="event.id">
          <EventCover class="admin-cover" :image="event.image" />
          <div class="details">
            <strong>{{ event.name }}</strong>
            <span>{{
              editions.find((item) => item.id === event.editionId)?.name ?? 'Sin edición'
            }}</span>
            <small :class="{ active: event.status === 'open' }"
              >{{
                event.status === 'closed'
                  ? 'Cerrado'
                  : event.status === 'open'
                    ? 'Abierto'
                    : 'En preparación'
              }}
              · {{ event.participantCount }} participantes</small
            >
            <span v-if="event.isTest" class="event-test-tag">Evento de pruebas</span>
            <span>Inicio: {{ date(event.startDate) }}</span
            ><span>Fin: {{ date(event.endDate) }}</span>
            <small v-if="!canDelete(event)"
              >Los eventos oficiales solo se pueden borrar antes de empezar.</small
            >
          </div>
          <div class="actions">
            <button
              type="button"
              :disabled="busy"
              :aria-label="`Editar ${event.name}`"
              @click="editEvent(event.id)"
            >
              Editar
            </button>
            <button
              v-if="event.status === 'open'"
              type="button"
              :disabled="busy"
              :aria-label="`Cerrar ${event.name}`"
              @click="changeEvent(event, 'close')"
            >
              Cerrar
            </button>
            <button
              class="danger"
              type="button"
              :disabled="busy || !canDelete(event)"
              :aria-label="`Borrar ${event.name}`"
              @click="changeEvent(event, 'delete')"
            >
              Borrar
            </button>
            <a v-if="event.status === 'closed'" :href="`#/responses/events/${event.id}`"
              >Respuestas</a
            >
          </div>
        </li>
      </ul>
    </template>
  </section>
</template>

<style scoped src="../styles/users-admin.css"></style>
<style scoped>
.toolbar,
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}
.create-event,
.actions a {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 10px 14px;
  border: 1px solid var(--gold);
  border-radius: 8px;
  color: var(--gold);
  text-decoration: none;
  font-size: 13px;
}
.event-filters {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin: 24px 0;
}
.event-filters label {
  display: grid;
  gap: 8px;
  min-width: 0;
  color: var(--muted);
  font-size: 13px;
}
.event-filters input,
.event-filters select {
  width: 100%;
  min-width: 0;
  min-height: 44px;
  padding: 10px;
  border: 1px solid #d9b66560;
  border-radius: 8px;
  background: #201e17;
  color: inherit;
  font: inherit;
}
.user-list .admin-cover {
  width: 64px;
  flex: 0 0 64px;
  font-size: 20px;
}
.actions {
  max-width: 250px;
}
button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
input:focus-visible,
select:focus-visible,
button:focus-visible,
a:focus-visible {
  outline: 2px solid var(--gold);
  outline-offset: 3px;
}
@media (max-width: 560px) {
  .actions {
    max-width: none;
  }
}
@media (max-width: 380px) {
  .event-filters {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
