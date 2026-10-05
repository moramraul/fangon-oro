<script setup lang="ts">
import { computed, ref } from 'vue'
import type { AuthCredentials } from '../../stores/auth'
import GoogleSignIn from './GoogleSignIn.vue'
const props = defineProps<{
  mode: 'login' | 'register'
  busy: boolean
  error: string
  success?: string
}>()
const emit = defineEmits<{ submit: [credentials: AuthCredentials]; google: [credential: string] }>()
const registering = computed(() => props.mode === 'register')
const name = ref('')
const email = ref('')
const password = ref('')
const visiblePassword = ref(false)
function submit() {
  if (props.busy) return
  emit('submit', {
    email: email.value,
    password: password.value,
    ...(registering.value ? { name: name.value } : {}),
  })
}
</script>

<template>
  <form @submit.prevent="submit">
    <div v-if="registering" class="field">
      <label for="name">Tu nombre</label
      ><input
        id="name"
        v-model="name"
        autocomplete="name"
        placeholder="¿Cómo te llamas?"
        required
        pattern=".*\S.*"
        maxlength="100"
        :disabled="busy"
      />
    </div>
    <div class="field">
      <label for="email">Correo electrónico</label
      ><input
        id="email"
        v-model="email"
        type="email"
        autocomplete="email"
        inputmode="email"
        autocapitalize="none"
        spellcheck="false"
        placeholder="tu@email.com"
        required
        :disabled="busy"
      />
    </div>
    <div class="field">
      <label for="password">Contraseña</label>
      <div class="password-field">
        <input
          id="password"
          v-model="password"
          :type="visiblePassword ? 'text' : 'password'"
          :autocomplete="registering ? 'new-password' : 'current-password'"
          :minlength="registering ? 8 : undefined"
          :maxlength="registering ? 100 : undefined"
          :placeholder="registering ? 'Al menos 8 caracteres' : 'Tu contraseña'"
          required
          :disabled="busy"
        /><button
          type="button"
          :aria-label="visiblePassword ? 'Ocultar contraseña' : 'Mostrar contraseña'"
          :aria-pressed="visiblePassword"
          @click="visiblePassword = !visiblePassword"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            aria-hidden="true"
          >
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
            <circle cx="12" cy="12" r="3" />
            <path v-if="visiblePassword" d="m3 3 18 18" />
          </svg>
        </button>
      </div>
    </div>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="success" role="status">{{ success }}</p>
    <button class="primary" type="submit" :disabled="busy">
      {{ busy ? 'Un momento…' : registering ? 'Crear mi cuenta' : 'Entrar'
      }}<span aria-hidden="true">↗</span>
    </button>
  </form>
  <GoogleSignIn :busy="busy" @credential="emit('google', $event)" />
</template>

<style scoped src="../../styles/auth-form.css"></style>
