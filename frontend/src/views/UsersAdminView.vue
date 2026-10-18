<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ApiError, request, type User } from '../api'
import { useAuthStore } from '../stores/auth'

type ListedUser = Pick<User, 'id' | 'name' | 'email' | 'avatar' | 'role' | 'isActive'>
const auth = useAuthStore()
const users = ref<ListedUser[]>([])
const loading = ref(true)
const error = ref('')
const success = ref('')
const busy = ref(false)
const failedAvatars = ref(new Set<string>())

function handleError(cause: unknown) {
  if (cause instanceof ApiError && cause.status === 401) auth.logout()
  else
    error.value = cause instanceof Error ? cause.message : 'No se ha podido completar la operación.'
}

async function loadUsers() {
  if (!auth.token || auth.user?.role !== 'ADMIN') return
  loading.value = true
  error.value = ''
  try {
    users.value = await request<ListedUser[]>('/users', {}, auth.token)
  } catch (cause) {
    handleError(cause)
  } finally {
    loading.value = false
  }
}

async function changeUser(user: ListedUser, action: 'activation' | 'delete') {
  if (busy.value || !auth.token || auth.user?.role !== 'ADMIN') return
  const deleting = action === 'delete'
  const verb = deleting ? 'Eliminar' : user.isActive ? 'Desactivar' : 'Activar'
  const warning = deleting
    ? 'Su cuenta se eliminará de forma permanente. Esta acción no se puede deshacer.'
    : user.isActive
      ? 'No podrá acceder hasta que un administrador vuelva a activar su cuenta.'
      : 'Podrá acceder a la aplicación.'
  if (!window.confirm(`¿${verb} a ${user.name}?\n\n${warning}`)) return
  busy.value = true
  error.value = ''
  success.value = ''
  try {
    if (deleting) {
      await request(`/users/${encodeURIComponent(user.id)}`, { method: 'DELETE' }, auth.token)
      users.value = users.value.filter((item) => item.id !== user.id)
      success.value = `Se ha eliminado la cuenta de ${user.name}.`
    } else {
      const updated = await request<ListedUser>(
        `/users/${encodeURIComponent(user.id)}/activation`,
        { method: 'PATCH', body: JSON.stringify({ isActive: !user.isActive }) },
        auth.token,
      )
      users.value = users.value.map((item) =>
        item.id === user.id ? { ...item, ...updated } : item,
      )
      success.value = `La cuenta de ${user.name} está ${updated.isActive ? 'activa' : 'desactivada'}.`
    }
    if (user.id === auth.user?.id && (deleting || user.isActive)) auth.logout()
  } catch (cause) {
    handleError(cause)
  } finally {
    busy.value = false
  }
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

onMounted(loadUsers)
</script>

<template>
  <section class="users-admin" aria-labelledby="users-title" :aria-busy="loading || busy">
    <a class="back" href="#/profile">← Volver al perfil</a>
    <header>
      <span class="eyebrow">ADMINISTRACIÓN</span>
      <h1 id="users-title">Usuarios</h1>
      <p>Gestiona las cuentas y el acceso al Fangón de Oro.</p>
    </header>
    <p v-if="loading" role="status">Cargando usuarios…</p>
    <div v-if="error" class="error" role="alert">
      <p>{{ error }}</p>
      <button :disabled="busy || loading" @click="loadUsers">Volver a cargar</button>
    </div>
    <p class="success" role="status">{{ success }}</p>
    <template v-if="!loading">
      <p class="count">{{ users.length }} usuarios</p>
      <p v-if="!users.length && !error">No hay usuarios.</p>
      <ul v-else class="user-list">
        <li v-for="user in users" :key="user.id">
          <div class="avatar">
            <img
              v-if="user.avatar && !failedAvatars.has(user.id)"
              :src="user.avatar"
              :alt="`Foto de ${user.name}`"
              @error="failedAvatars.add(user.id)"
            />
            <span v-else>{{ initials(user.name) }}</span>
          </div>
          <div class="details">
            <strong>{{ user.name }}</strong>
            <span>{{ user.email }}</span>
            <small :class="{ active: user.isActive }">
              {{ user.isActive ? 'Activo' : 'Desactivado' }}
              <template v-if="user.role === 'ADMIN'"> · Administrador</template>
            </small>
          </div>
          <div class="actions">
            <button
              :disabled="busy"
              :aria-label="`${user.isActive ? 'Desactivar' : 'Activar'} a ${user.name}`"
              @click="changeUser(user, 'activation')"
            >
              {{ user.isActive ? 'Desactivar' : 'Activar' }}
            </button>
            <button
              class="danger"
              :disabled="busy"
              :aria-label="`Eliminar a ${user.name}`"
              @click="changeUser(user, 'delete')"
            >
              Eliminar
            </button>
          </div>
        </li>
      </ul>
    </template>
  </section>
</template>

<style scoped src="../styles/users-admin.css"></style>
