import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { ApiError, request, type User } from '../api'
import { readRoute } from '../composables/useHashRoute'

export interface AuthCredentials {
  email: string
  password: string
  name?: string
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const token = ref<string | null>(localStorage.getItem('fangon.session'))
  const busy = ref(false)
  const restoring = ref(true)
  const error = ref('')
  const needsSessionRecovery = computed(() => Boolean(token.value && !user.value))
  function clearError() {
    error.value = ''
  }
  function logout() {
    token.value = null
    localStorage.removeItem('fangon.session')
    user.value = null
    clearError()
    location.hash = '/login'
  }
  async function authenticate(mode: 'login' | 'register', credentials: AuthCredentials) {
    if (busy.value) return
    clearError()
    busy.value = true
    try {
      const result = await request<{ accessToken: string }>('/auth/' + mode, {
        method: 'POST',
        body: JSON.stringify({
          email: credentials.email.trim().toLowerCase(),
          password: credentials.password,
          ...(mode === 'register' ? { name: credentials.name?.trim() } : {}),
        }),
      })
      const profile = await request<User>('/auth/me', {}, result.accessToken)
      token.value = result.accessToken
      localStorage.setItem('fangon.session', result.accessToken)
      user.value = profile
      location.hash = '/profile'
    } catch (cause) {
      error.value =
        cause instanceof Error ? cause.message : 'No hemos podido completar la operación.'
    } finally {
      busy.value = false
    }
  }
  async function restore() {
    clearError()
    restoring.value = true
    try {
      if (token.value) {
        user.value = await request<User>('/auth/me', {}, token.value)
        if (['login', 'register'].includes(readRoute()))
          location.hash = '/profile'
      }
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) logout()
      else
        error.value = 'No podemos recuperar tu sesión. Comprueba la conexión y vuelve a intentarlo.'
    } finally {
      restoring.value = false
      if (!user.value && !token.value && location.hash === '#/profile') location.hash = '/login'
    }
  }
  return {
    user,
    token,
    busy,
    restoring,
    error,
    needsSessionRecovery,
    clearError,
    logout,
    restore,
    login: (credentials: AuthCredentials) => authenticate('login', credentials),
    register: (credentials: AuthCredentials) => authenticate('register', credentials),
  }
})
