<script setup lang="ts">
import { ref, watch } from 'vue'
import AuthHero from '../components/auth/AuthHero.vue'
import { request } from '../api'
import { useAuthStore } from '../stores/auth'
const props = defineProps<{ reset: boolean }>()
const auth = useAuthStore()
const email = ref('')
const password = ref('')
const confirmation = ref('')
const busy = ref(false)
const error = ref('')
const message = ref('')
const done = ref(false)
const token = () => new URLSearchParams(location.hash.split('?')[1] ?? '').get('token') ?? ''
watch(
  () => props.reset,
  () => {
    error.value = ''
    message.value = ''
    done.value = false
    password.value = ''
    confirmation.value = ''
  },
)
async function submit() {
  if (busy.value || done.value) return
  error.value = ''
  message.value = ''
  if (
    props.reset &&
    (password.value !== confirmation.value || new TextEncoder().encode(password.value).length > 72)
  ) {
    error.value =
      password.value !== confirmation.value
        ? 'Las contraseñas no coinciden.'
        : 'La contraseña no puede superar 72 bytes.'
    return
  }
  busy.value = true
  try {
    const result = await request<{ message: string }>(
      props.reset ? '/auth/reset-password' : '/auth/forgot-password',
      {
        method: 'POST',
        signal: AbortSignal.timeout(45000),
        body: JSON.stringify(
          props.reset
            ? { token: token(), password: password.value }
            : { email: email.value.trim().toLowerCase() },
        ),
      },
    )
    message.value = result.message
    done.value = true
    if (props.reset) {
      password.value = ''
      confirmation.value = ''
      history.replaceState(null, '', '#/reset-password?complete')
      auth.token = null
      auth.user = null
      localStorage.removeItem('fangon.session')
      auth.clearError()
    }
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No hemos podido completar la operación.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <AuthHero />
  <section class="auth-panel" aria-labelledby="recovery-title">
    <div class="heading">
      <span class="eyebrow">TU SITIO EN LOS PREMIOS</span>
      <h1 id="recovery-title">{{ reset ? 'Tu nueva contraseña.' : 'Vuelve a los premios.' }}</h1>
      <p>
        {{
          reset
            ? 'Elige una contraseña de al menos 8 caracteres.'
            : 'Introduce tu correo y te enviaremos un enlace. Si entras con Google, puedes seguir usando ese botón.'
        }}
      </p>
    </div>
    <form v-if="!done" @submit.prevent="submit">
      <template v-if="reset">
        <div class="field">
          <label for="new-password">Nueva contraseña</label
          ><input
            id="new-password"
            v-model="password"
            type="password"
            autocomplete="new-password"
            minlength="8"
            maxlength="72"
            required
            :disabled="busy"
          />
        </div>
        <div class="field">
          <label for="confirm-password">Repite la contraseña</label
          ><input
            id="confirm-password"
            v-model="confirmation"
            type="password"
            autocomplete="new-password"
            minlength="8"
            maxlength="72"
            required
            :disabled="busy"
          />
        </div>
      </template>
      <div v-else class="field">
        <label for="recovery-email">Correo electrónico</label
        ><input
          id="recovery-email"
          v-model="email"
          type="email"
          autocomplete="email"
          maxlength="254"
          required
          :disabled="busy"
        />
      </div>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <button class="primary" :disabled="busy">
        {{ busy ? 'Un momento…' : reset ? 'Guardar contraseña' : 'Enviar enlace' }}
      </button>
    </form>
    <p v-if="message" role="status">{{ message }}</p>
    <p v-if="!reset">El enlace caduca en 30 minutos. Revisa también la carpeta de spam.</p>
    <p class="switch-copy">
      <a href="#/login">Volver a iniciar sesión</a
      ><span v-if="reset"> · <a href="#/forgot-password">Solicitar otro enlace</a></span>
    </p>
  </section>
</template>

<style scoped src="../styles/auth-layout.css"></style>
<style scoped src="../styles/auth-form.css"></style>
