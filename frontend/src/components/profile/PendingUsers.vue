<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ApiError, request, type User } from '../../api'
import { useAuthStore } from '../../stores/auth'

const auth = useAuthStore()
const users = ref<User[]>([])
const loading = ref(true)
const loadError = ref('')
const activationErrors = ref<Record<string, string>>({})
const activating = ref(new Set<string>())
const success = ref('')

function errorMessage(cause: unknown) {
  return cause instanceof Error ? cause.message : 'No hemos podido completar la operación.'
}

async function loadUsers() {
  if (!auth.token || auth.user?.role !== 'ADMIN') return
  loading.value = true
  loadError.value = ''
  try {
    const result = await request<User[]>('/users', {}, auth.token)
    users.value = result.filter((user) => user.isActive !== true)
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 401) auth.logout()
    else loadError.value = errorMessage(cause)
  } finally {
    loading.value = false
  }
}

async function activateUser(user: User) {
  if (!auth.token || auth.user?.role !== 'ADMIN' || activating.value.has(user.id)) return
  activating.value.add(user.id)
  delete activationErrors.value[user.id]
  success.value = ''
  try {
    const updated = await request<User>(
      `/users/${encodeURIComponent(user.id)}/activation`,
      { method: 'PATCH', body: JSON.stringify({ isActive: true }) },
      auth.token,
    )
    if (!updated.isActive) throw new Error('No se ha activado el usuario. Vuelve a intentarlo.')
    users.value = users.value.filter((pending) => pending.id !== user.id)
    success.value = `${user.name} ya tiene su cuenta activa.`
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 401) auth.logout()
    else activationErrors.value[user.id] = errorMessage(cause)
  } finally {
    activating.value.delete(user.id)
  }
}

onMounted(loadUsers)
</script>

<template>
  <section class="pending-users" aria-labelledby="pending-users-title" :aria-busy="loading">
    <header class="pending-users-heading">
      <h2 id="pending-users-title">Usuarios pendientes de activar</h2>
      <span v-if="!loading && !loadError" class="pending-users-count">{{ users.length }}</span>
    </header>
    <p v-if="loading" class="pending-users-message" role="status">Cargando usuarios…</p>
    <div v-else-if="loadError" class="pending-users-error" role="alert">
      <p>{{ loadError }}</p>
      <button type="button" class="pending-users-button" @click="loadUsers">
        Volver a intentar
      </button>
    </div>
    <template v-else>
      <p v-if="!users.length" class="pending-users-message">
        No hay usuarios pendientes de activar.
      </p>
      <ul v-else class="pending-users-list">
        <li v-for="user in users" :key="user.id" class="pending-user">
          <div class="pending-user-details">
            <strong>{{ user.name }}</strong>
            <span>{{ user.email }}</span>
          </div>
          <button
            type="button"
            class="pending-users-button"
            :disabled="activating.has(user.id)"
            :aria-busy="activating.has(user.id)"
            :aria-label="`Activar a ${user.name}`"
            @click="activateUser(user)"
          >
            {{ activating.has(user.id) ? 'Activando…' : 'Activar' }}
          </button>
          <p v-if="activationErrors[user.id]" class="pending-users-error" role="alert">
            {{ activationErrors[user.id] }}
          </p>
        </li>
      </ul>
    </template>
    <p class="pending-users-success" role="status">{{ success }}</p>
  </section>
</template>

<style scoped src="../../styles/pending-users.css"></style>
