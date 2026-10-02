<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ApiError, request } from '../api'
import { useAuthStore } from '../stores/auth'
import EventDateSelect from '../components/events/EventDateSelect.vue'

interface Participant {
  id: string
  name: string
}
const auth = useAuthStore()
const users = ref<Participant[]>([])
const participantIds = ref<string[]>([])
const selectedUser = ref('')
const name = ref('')
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
    if (cause.status === 403) return 'Solo los administradores pueden crear eventos.'
    if (cause.status === 400)
      return 'Revisa el nombre, las fechas y los participantes. Algún usuario podría haber dejado de estar disponible.'
  }
  return cause instanceof Error ? cause.message : 'No hemos podido completar la operación.'
}
async function loadUsers() {
  loading.value = true
  loadError.value = ''
  try {
    users.value = await request<Participant[]>('/users', {}, auth.token ?? undefined)
  } catch (cause) {
    loadError.value = message(cause)
  } finally {
    loading.value = false
  }
}
function addParticipant() {
  if (availableUsers.value.some((user) => user.id === selectedUser.value))
    participantIds.value.push(selectedUser.value)
  selectedUser.value = ''
}
async function submit() {
  if (busy.value || loading.value || loadError.value || createdName.value) return
  error.value = ''
  if (!name.value.trim()) {
    error.value = 'Escribe el nombre del evento.'
    return
  }
  if (new Date(endDate.value) <= new Date(startDate.value)) {
    error.value = 'La fecha de fin debe ser posterior a la fecha de inicio.'
    return
  }
  busy.value = true
  try {
    const result = await request<{ name: string }>(
      '/events',
      {
        method: 'POST',
        body: JSON.stringify({
          name: name.value.trim(),
          startDate: startDate.value,
          endDate: endDate.value,
          participantIds: participantIds.value,
        }),
      },
      auth.token ?? undefined,
    )
    createdName.value = result.name
  } catch (cause) {
    error.value = message(cause)
  } finally {
    busy.value = false
  }
}
function reset() {
  name.value = ''
  participantIds.value = []
  selectedUser.value = ''
  createdName.value = ''
  error.value = ''
  void loadUsers()
}
onMounted(loadUsers)
</script>

<template>
  <section class="event-create" aria-labelledby="event-title">
    <a class="back-link" href="#/profile">← Volver a mi perfil</a>
    <header class="event-heading">
      <span class="eyebrow">ADMINISTRACIÓN</span>
      <h1 id="event-title">Crear evento</h1>
      <p>Elige quién participa y cuándo empieza y termina el evento.</p>
    </header>
    <div v-if="createdName" class="success" role="status">
      <h2>Evento creado</h2>
      <p>«{{ createdName }}» se ha guardado correctamente con sus participantes y fechas.</p>
      <button class="primary" type="button" @click="reset">Crear otro evento</button>
    </div>
    <form v-else @submit.prevent="submit" :aria-busy="busy">
      <fieldset class="form-fields" :disabled="busy">
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
              :disabled="!availableUsers.length"
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
        <EventDateSelect v-model="startDate" label="Fecha de inicio" />
        <EventDateSelect v-model="endDate" label="Fecha de fin" />
        <p class="hint">Zona horaria: {{ timezone }}.</p>
      </fieldset>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <button class="primary" type="submit" :disabled="busy || loading || Boolean(loadError)">
        {{ busy ? 'Creando evento…' : 'Crear evento' }}
      </button>
    </form>
  </section>
</template>

<style scoped src="../styles/event-create.css"></style>
