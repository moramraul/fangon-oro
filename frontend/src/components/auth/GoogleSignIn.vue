<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'

const props = defineProps<{ busy: boolean }>()
const emit = defineEmits<{ credential: [value: string] }>()
const container = ref<HTMLDivElement>()
const error = ref('')
const ready = ref(false)
const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
let disposed = false

interface GoogleIdentity {
  accounts: {
    id: {
      initialize: (options: {
        client_id: string
        callback: (response: { credential: string }) => void
      }) => void
      renderButton: (
        element: HTMLElement,
        options: { theme: string; size: string; text: string; locale: string },
      ) => void
    }
  }
}

onBeforeUnmount(() => {
  disposed = true
})
onMounted(async () => {
  if (!clientId) return
  const browser = window as Window & { google?: GoogleIdentity }
  try {
    if (!browser.google) {
      await new Promise<void>((resolve, reject) => {
        const existing = document.querySelector<HTMLScriptElement>('script[data-google-identity]')
        const script = existing || document.createElement('script')
        const timeout = window.setTimeout(() => reject(new Error('Timeout')), 15000)
        script.addEventListener(
          'load',
          () => {
            clearTimeout(timeout)
            resolve()
          },
          { once: true },
        )
        script.addEventListener(
          'error',
          () => {
            clearTimeout(timeout)
            script.remove()
            reject(new Error('Load failed'))
          },
          { once: true },
        )
        if (!existing) {
          script.src = 'https://accounts.google.com/gsi/client'
          script.async = true
          script.dataset.googleIdentity = 'true'
          document.head.append(script)
        }
      })
    }
    if (disposed || !container.value || !browser.google) return
    browser.google.accounts.id.initialize({
      client_id: clientId,
      callback: ({ credential }) => {
        if (!disposed && !props.busy) emit('credential', credential)
      },
    })
    browser.google.accounts.id.renderButton(container.value, {
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      locale: 'es',
    })
    ready.value = true
  } catch {
    if (!disposed)
      error.value = 'No se ha podido cargar Google. Recarga la página para volver a intentarlo.'
  }
})
</script>

<template>
  <div class="google-sign-in" :class="{ busy }" :inert="busy">
    <p>O continúa con Google</p>
    <div v-show="ready" ref="container" />
    <button
      v-if="!ready"
      type="button"
      class="google-button"
      :disabled="busy || Boolean(clientId && !error)"
      @click="error = 'El acceso con Google todavía no está disponible. Puedes continuar con tu correo y contraseña.'"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20">
        <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.25c1.9-1.75 2.97-4.33 2.97-7.36Z" />
        <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.61-2.41l-3.25-2.51c-.9.6-2.05.97-3.36.97-2.6 0-4.8-1.76-5.59-4.12H3.06v2.59A10 10 0 0 0 12 22Z" />
        <path fill="#FBBC05" d="M6.41 13.93a6 6 0 0 1 0-3.86V7.48H3.06a10 10 0 0 0 0 9.04l3.35-2.59Z" />
        <path fill="#EA4335" d="M12 5.95c1.47 0 2.79.5 3.82 1.49l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.94 5.48l3.35 2.59A5.99 5.99 0 0 1 12 5.95Z" />
      </svg>
      Continuar con Google
    </button>
    <p v-if="error" role="alert">{{ error }}</p>
  </div>
</template>

<style scoped>
.google-sign-in {
  margin-top: 24px;
  display: grid;
  justify-items: center;
  gap: 12px;
}
.google-sign-in p {
  margin: 0;
  font-size: 14px;
}
.busy {
  opacity: 0.6;
}
.google-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  min-height: 44px;
  width: 100%;
  padding: 10px 20px;
  border: 1px solid #dadce0;
  border-radius: 6px;
  background: white;
  color: #3c4043;
  font-family: inherit;
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  cursor: pointer;
}
.google-button:hover { background: #f8faff; }
.google-button:disabled { cursor: wait; opacity: .65; }
</style>
