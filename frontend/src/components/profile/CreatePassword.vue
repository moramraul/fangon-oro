<script setup lang="ts">
import { ref } from 'vue'
import { ApiError, request, type User } from '../../api'
import { useAuthStore } from '../../stores/auth'
const auth = useAuthStore()
const password = ref('')
const confirmation = ref('')
const busy = ref(false)
const error = ref('')
const saved = ref(false)
async function submit() {
  if (busy.value) return
  error.value = ''
  if (password.value !== confirmation.value) {
    error.value = 'Las contraseñas no coinciden.'
    return
  }
  if (password.value.length < 8 || new TextEncoder().encode(password.value).length > 72) {
    error.value =
      'Usa al menos 8 caracteres y como máximo 72 bytes (las tildes y emojis ocupan más).'
    return
  }
  busy.value = true
  try {
    auth.user = await request<User>(
      '/auth/me/password',
      { method: 'POST', body: JSON.stringify({ password: password.value }) },
      auth.token ?? undefined,
    )
    password.value = confirmation.value = ''
    saved.value = true
  } catch (cause) {
    error.value =
      cause instanceof ApiError && cause.status === 409
        ? 'No se puede crear una contraseña: puede que tu cuenta ya tenga una. Recarga la página.'
        : cause instanceof Error
          ? cause.message
          : 'No hemos podido guardar tu contraseña.'
  } finally {
    busy.value = false
  }
}
</script>
<template>
  <section
    v-if="saved || (auth.user?.hasGoogle && !auth.user.hasPassword)"
    aria-labelledby="create-password-title"
  >
    <h2 id="create-password-title">Crear una contraseña</h2>
    <p v-if="saved" role="status" class="profile-edit-success">
      Contraseña creada. Ya puedes entrar con tu correo y contraseña o seguir usando Google.
    </p>
    <form v-else class="profile-edit-form" @submit.prevent="submit">
      <p class="profile-edit-help">
        Es opcional. Google seguirá funcionando aunque crees una contraseña.
      </p>
      <fieldset :disabled="busy">
        <label for="new-password">Nueva contraseña</label>
        <input
          id="new-password"
          v-model="password"
          type="password"
          autocomplete="new-password"
          minlength="8"
          maxlength="72"
          required
        />
        <label for="confirm-password">Repite la contraseña</label>
        <input
          id="confirm-password"
          v-model="confirmation"
          type="password"
          autocomplete="new-password"
          minlength="8"
          maxlength="72"
          required
        />
      </fieldset>
      <p v-if="error" class="profile-edit-error" role="alert">{{ error }}</p>
      <button class="profile-edit-save" :disabled="busy" type="submit">
        {{ busy ? 'Guardando…' : 'Crear contraseña' }}
      </button>
    </form>
  </section>
</template>
