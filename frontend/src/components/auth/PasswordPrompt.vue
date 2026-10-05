<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { request, type User } from '../../api'
import { useAuthStore } from '../../stores/auth'
const auth = useAuthStore()
const dialog = ref<HTMLDialogElement>()
const busy = ref(false)
const error = ref('')
onMounted(() => dialog.value?.showModal())
async function answer(create: boolean) {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    auth.user = await request<User>(
      '/auth/me/password-prompt',
      { method: 'POST' },
      auth.token ?? undefined,
    )
    if (create) location.hash = '/profile/edit'
  } catch {
    error.value = 'No hemos podido guardar tu respuesta. Vuelve a intentarlo.'
  } finally {
    busy.value = false
  }
}
</script>
<template>
  <dialog
    ref="dialog"
    aria-labelledby="password-prompt-title"
    aria-describedby="password-prompt-description"
    @cancel.prevent="answer(false)"
  >
    <h2 id="password-prompt-title">¿Quieres establecer una contraseña?</h2>
    <p id="password-prompt-description">
      Si no lo haces, tendrás que iniciar sesión siempre con Google. Puedes crearla más adelante
      desde tu perfil.
    </p>
    <p v-if="error" role="alert">{{ error }}</p>
    <div class="actions">
      <button :disabled="busy" @click="answer(true)">Sí, crear contraseña</button>
      <button :disabled="busy" @click="answer(false)">No, seguir con Google</button>
    </div>
  </dialog>
</template>
<style scoped>
dialog {
  width: min(440px, calc(100vw - 48px));
  box-sizing: border-box;
  padding: 28px;
  border: 1px solid var(--gold);
  border-radius: 16px;
  background: #171713;
  color: #f4eddb;
}
dialog::backdrop {
  background: rgb(0 0 0 / 70%);
}
h2 {
  font-size: 24px;
  margin: 0 0 16px;
}
p {
  line-height: 1.6;
}
.actions {
  display: grid;
  gap: 12px;
  margin-top: 24px;
}
button {
  padding: 12px;
  border: 1px solid var(--gold);
  border-radius: 8px;
  background: transparent;
  color: var(--gold);
  font: inherit;
  cursor: pointer;
}
button:first-child {
  background: var(--gold);
  color: #171713;
}
button:disabled {
  opacity: 0.6;
  cursor: wait;
}
</style>
