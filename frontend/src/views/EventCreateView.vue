<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { ApiError, request } from '../api'
import { useAuthStore } from '../stores/auth'
import EventDateSelect from '../components/events/EventDateSelect.vue'
const formHeading = ref<HTMLElement | null>(null)

interface Participant {
  id: string
  name: string
}
interface AdminEvent {
  isTest: boolean
  id: string
  name: string
  image: string | null
  startDate: string
  endDate: string
  status: string
  participants: Participant[]
}
const editing = ref<AdminEvent | null>(null)
const editRequested = ref(false)
const canChangeParticipants = computed(
  () =>
    !editing.value ||
    (editing.value.status === 'open' && Date.parse(editing.value.startDate) > Date.now()),
)
const eventLoading = ref(false)
const auth = useAuthStore()
const users = ref<Participant[]>([])
const participantIds = ref<string[]>([])
const selectedUser = ref('')
const name = ref('')
const isTest = ref(false)
const image = ref('')
const processing = ref(false)
const initialStart = new Date()
initialStart.setDate(initialStart.getDate() + 1)
initialStart.setHours(12, 0, 0, 0)
const startDate = ref(initialStart.toISOString())
const endDate = ref(new Date(initialStart.getTime() + 86400000).toISOString())
const loading = ref(true)
const loadError = ref('')
const error = ref('')
const busy = ref(false)
const createdName = ref('')
const availableUsers = computed(() =>
  users.value.filter((user) => !participantIds.value.includes(user.id)),
)
const participants = computed(() =>
  users.value.filter((user) => participantIds.value.includes(user.id)),
)
const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
function message(cause: unknown) {
  if (cause instanceof ApiError) {
    if (cause.status === 401) return 'Tu sesión ha caducado. Vuelve a iniciar sesión.'
    if (cause.status === 403) return 'Solo los administradores pueden gestionar eventos.'
    if (cause.status === 409)
      return editing.value
        ? 'El evento ha cambiado o la votación ya ha comenzado. Vuelve a cargar el evento.'
        : 'La nueva edición todavía no admite eventos. Espera un minuto desde el cierre de la anterior y vuelve a intentarlo.'
    if (cause.status === 404) return 'El evento ya no está disponible.'
    if (cause.status === 400)
      return 'Revisa el nombre, la imagen, las fechas y los participantes. Algún usuario podría haber dejado de estar disponible.'
  }
  return cause instanceof Error ? cause.message : 'No hemos podido completar la operación.'
}
async function editEvent(id: string) {
  if (busy.value || processing.value || eventLoading.value) return
  eventLoading.value = true
  error.value = ''
  try {
    const event = await request<AdminEvent>(`/events/${id}`, {}, auth.token ?? undefined)
    editing.value = event
    name.value = event.name
    isTest.value = event.isTest
    image.value = event.image ?? ''
    startDate.value = event.startDate ?? initialStart.toISOString()
    endDate.value = event.endDate ?? new Date(initialStart.getTime() + 86400000).toISOString()
    participantIds.value = event.participants.map((user) => user.id)
    selectedUser.value = ''
    createdName.value = ''
    users.value = [
      ...users.value,
      ...event.participants.filter((p) => !users.value.some((u) => u.id === p.id)),
    ]
    await nextTick()
    formHeading.value?.focus()
    formHeading.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  } catch (cause) {
    error.value = message(cause)
  } finally {
    eventLoading.value = false
  }
}
async function loadUsers() {
  loading.value = true
  loadError.value = ''
  try {
    const available = await request<Participant[]>('/users', {}, auth.token ?? undefined)
    users.value = [
      ...available,
      ...(editing.value?.participants.filter(
        (participant) => !available.some((user) => user.id === participant.id),
      ) ?? []),
    ]
  } catch (cause) {
    loadError.value = message(cause)
  } finally {
    loading.value = false
  }
}
async function selectImage(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  error.value = ''
  if (
    !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
    file.size > 5 * 1024 * 1024
  ) {
    error.value = 'Elige una imagen JPG, PNG o WebP de hasta 5 MB.'
    return
  }
  processing.value = true
  const url = URL.createObjectURL(file)
  try {
    const photo = new Image()
    photo.src = url
    await photo.decode()
    const canvas = document.createElement('canvas')
    canvas.width = 640
    canvas.height = 360
    const context = canvas.getContext('2d')
    if (!context) throw new Error('No se puede procesar la imagen.')
    const width = Math.min(photo.naturalWidth, (photo.naturalHeight * 16) / 9)
    const height = (width * 9) / 16
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, 640, 360)
    context.drawImage(
      photo,
      (photo.naturalWidth - width) / 2,
      (photo.naturalHeight - height) / 2,
      width,
      height,
      0,
      0,
      640,
      360,
    )
    let encoded = ''
    for (const quality of [0.8, 0.65, 0.5, 0.35]) {
      encoded = canvas.toDataURL('image/jpeg', quality)
      if (encoded.length <= 90000) break
    }
    if (encoded.length > 90000) throw new Error('Prueba con una imagen más sencilla.')
    image.value = encoded
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No hemos podido leer la imagen.'
  } finally {
    URL.revokeObjectURL(url)
    processing.value = false
  }
}
function addParticipant() {
  if (availableUsers.value.some((user) => user.id === selectedUser.value))
    participantIds.value.push(selectedUser.value)
  selectedUser.value = ''
}
async function submit() {
  if (
    busy.value ||
    processing.value ||
    loading.value ||
    eventLoading.value ||
    loadError.value ||
    createdName.value
  )
    return
  error.value = ''
  if (!name.value.trim()) {
    error.value = 'Escribe el nombre del evento.'
    return
  }
  if (!image.value && !editing.value) {
    error.value = 'Añade una imagen para el evento.'
    return
  }
  if (new Date(endDate.value) <= new Date(startDate.value)) {
    error.value = 'La fecha de fin debe ser posterior a la fecha de inicio.'
    return
  }
  busy.value = true
  try {
    const original = editing.value
    const result = await request<AdminEvent>(
      editing.value ? `/events/${editing.value.id}` : '/events',
      {
        method: editing.value ? 'PATCH' : 'POST',
        body: JSON.stringify({
          name: name.value.trim(),
          ...(!editing.value ? { isTest: isTest.value } : {}),
          ...(image.value ? { image: image.value } : {}),
          ...(!editing.value || startDate.value !== editing.value.startDate
            ? { startDate: startDate.value }
            : {}),
          ...(!editing.value || endDate.value !== editing.value.endDate
            ? { endDate: endDate.value }
            : {}),
          ...(!editing.value ? { participantIds: participantIds.value } : {}),
        }),
      },
      auth.token ?? undefined,
    )
    if (original) {
      editing.value = { ...result, participants: original.participants }
      const participantsChanged =
        participantIds.value.length !== original.participants.length ||
        participantIds.value.some((id) => !original.participants.some((user) => user.id === id))
      if (participantsChanged) {
        try {
          editing.value = await request<AdminEvent>(
            `/events/${original.id}/participants`,
            {
              method: 'PUT',
              body: JSON.stringify({ participantIds: participantIds.value }),
            },
            auth.token ?? undefined,
          )
        } catch (cause) {
          error.value = `Los datos del evento se han guardado, pero no los participantes. ${message(cause)}`
          return
        }
      }
    }
    createdName.value = result.name
  } catch (cause) {
    error.value = message(cause)
  } finally {
    busy.value = false
  }
}
function reset() {
  editRequested.value = false
  history.replaceState(null, '', '#/events/manage')
  editing.value = null
  startDate.value = initialStart.toISOString()
  endDate.value = new Date(initialStart.getTime() + 86400000).toISOString()
  name.value = ''
  isTest.value = false
  image.value = ''
  participantIds.value = []
  selectedUser.value = ''
  createdName.value = ''
  error.value = ''
  void loadUsers()
}
async function loadFromRoute() {
  if (!/^#\/events\/manage(?:\/[^/]+)?$/.test(location.hash)) return
  const id = location.hash.match(/^#\/events\/manage\/([^/]+)$/)?.[1]
  if (id) {
    editRequested.value = true
    editing.value = null
    createdName.value = ''
    await loadUsers()
    await editEvent(id)
  } else reset()
}
onMounted(() => {
  void loadFromRoute()
  window.addEventListener('hashchange', loadFromRoute)
})
onUnmounted(() => window.removeEventListener('hashchange', loadFromRoute))
</script>

<template>
  <section class="event-create" aria-labelledby="event-title">
    <a class="back-link" href="#/admin/events">← Volver a eventos</a>
    <header class="event-heading">
      <span class="eyebrow">ADMINISTRACIÓN</span>
      <h1 id="event-title">{{ editing ? 'Modificar evento' : 'Crear evento' }}</h1>
      <p>Elige quién participa y cuándo empieza y termina el evento.</p>
    </header>
    <h2 ref="formHeading" tabindex="-1">{{ editing ? 'Editar evento' : 'Crear evento' }}</h2>
    <div v-if="createdName" class="success" role="status">
      <h2>{{ editing ? 'Evento actualizado' : 'Evento creado' }}</h2>
      <p>«{{ createdName }}» se ha guardado correctamente con sus participantes y fechas.</p>
      <a class="back-link" href="#/admin/events">Volver al listado de eventos</a>
      <button class="primary" type="button" @click="reset">Crear otro evento</button>
    </div>
    <div v-else-if="editRequested && !editing" :class="error ? 'error' : 'hint'" role="status">
      <p>{{ error || 'Cargando evento…' }}</p>
      <button v-if="error" class="retry" type="button" @click="loadFromRoute">Reintentar</button>
    </div>
    <form v-else @submit.prevent="submit" :aria-busy="busy">
      <fieldset class="form-fields" :disabled="busy || processing || eventLoading">
        <div class="field">
          <label for="event-name">Nombre del evento</label>
          <input
            id="event-name"
            v-model="name"
            required
            maxlength="100"
            pattern=".*\S.*"
            placeholder="Por ejemplo, Fangón de Oro 2026"
          />
        </div>
        <div class="field">
          <label class="event-test-option" for="event-is-test">
            <input
              id="event-is-test"
              v-model="isTest"
              type="checkbox"
              :disabled="Boolean(editing)"
              aria-describedby="event-is-test-help"
            />
            Evento de pruebas
          </label>
          <p id="event-is-test-help" class="hint">
            Se fija al crear el evento. Permite probar votos y respuestas sin generar
            clasificaciones ni enviar invitaciones. Se puede borrar con todos sus votos.
          </p>
        </div>
        <div class="field">
          <label for="event-image">Imagen del evento</label>
          <input
            id="event-image"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-describedby="event-image-help"
            @change="selectImage"
          />
          <p id="event-image-help" class="hint">
            JPG, PNG o WebP, hasta 5 MB. La portada se recorta al centro en formato horizontal.
          </p>
          <p v-if="processing" class="hint" role="status">Preparando imagen…</p>
          <img
            v-if="image"
            class="event-image-preview"
            :src="image"
            alt="Vista previa de la portada del evento"
          />
        </div>
        <div class="field">
          <label for="event-participants">Participantes</label>
          <p v-if="loading" role="status" class="hint">Cargando usuarios…</p>
          <div v-else-if="loadError" class="error" role="alert">
            {{ loadError }}
            <button type="button" class="retry" @click="loadUsers">Reintentar</button>
          </div>
          <template v-else>
            <select
              id="event-participants"
              v-model="selectedUser"
              :disabled="!availableUsers.length || !canChangeParticipants"
              @change="addParticipant"
            >
              <option value="" disabled>
                {{
                  availableUsers.length
                    ? 'Selecciona un participante'
                    : 'No hay más usuarios disponibles'
                }}
              </option>
              <option v-for="user in availableUsers" :key="user.id" :value="user.id">
                {{ user.name }}
              </option>
            </select>
            <p class="hint">
              {{ participantIds.length }} participantes seleccionados. Puedes añadir varios.
            </p>
            <ul v-if="participants.length" class="participants">
              <li v-for="participant in participants" :key="participant.id">
                <span>{{ participant.name }}</span
                ><button
                  type="button"
                  :disabled="!canChangeParticipants"
                  :aria-label="`Quitar a ${participant.name}`"
                  @click="participantIds = participantIds.filter((id) => id !== participant.id)"
                >
                  ×
                </button>
              </li>
            </ul>
            <p v-if="!users.length" class="hint">
              Todavía no hay usuarios registrados para añadir.
            </p>
          </template>
        </div>
        <p v-if="editing && !canChangeParticipants" class="hint">
          Los participantes solo se pueden modificar antes de que comience la votación de un evento
          abierto.
        </p>
        <EventDateSelect
          v-model="startDate"
          label="Fecha de inicio"
          :disabled="Boolean(editing && Date.parse(editing.startDate) <= Date.now())"
        />
        <EventDateSelect v-model="endDate" label="Fecha de fin" />
        <p class="hint">Zona horaria: {{ timezone }}.</p>
      </fieldset>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <button
        v-if="editing"
        class="primary"
        type="submit"
        :disabled="busy || processing || loading || eventLoading || Boolean(loadError)"
      >
        {{ busy ? 'Guardando cambios…' : 'Guardar cambios' }}
      </button>
      <button
        v-else
        class="primary"
        type="submit"
        :disabled="busy || processing || loading || eventLoading || Boolean(loadError)"
      >
        {{ busy ? 'Creando evento…' : 'Crear evento' }}
      </button>
      <button
        v-if="editing"
        class="retry"
        type="button"
        :disabled="busy || processing || eventLoading"
        @click="reset"
      >
        Cancelar edición
      </button>
    </form>
  </section>
</template>

<style scoped src="../styles/event-create.css"></style>
