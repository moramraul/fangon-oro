<script setup lang="ts">
import { computed, ref } from 'vue'
import { ApiError, request, type User } from '../api'
import MemberCard from '../components/profile/MemberCard.vue'
import { useAuthStore } from '../stores/auth'
import '../styles/profile.css'
import '../styles/profile-edit.css'

const props = defineProps<{ user: User }>()
const auth = useAuthStore()
const name = ref(props.user.name)
const avatar = ref(props.user.avatar ?? '')
const busy = ref(false)
const processing = ref(false)
const error = ref('')
const saved = ref(false)
const preview = computed(() => ({
  ...props.user,
  name: name.value.trim() || props.user.name,
  avatar: avatar.value,
}))

async function selectPhoto(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  error.value = ''
  saved.value = false
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
    const image = new Image()
    image.src = url
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 256
    const context = canvas.getContext('2d')
    if (!context) throw new Error('No se puede procesar la imagen.')
    const size = Math.min(image.naturalWidth, image.naturalHeight)
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, 256, 256)
    context.drawImage(
      image,
      (image.naturalWidth - size) / 2,
      (image.naturalHeight - size) / 2,
      size,
      size,
      0,
      0,
      256,
      256,
    )
    const result = canvas.toDataURL('image/jpeg', 0.8)
    if (result.length > 90000)
      throw new Error('La imagen es demasiado grande. Prueba con otra foto.')
    avatar.value = result
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No hemos podido leer esta imagen.'
  } finally {
    URL.revokeObjectURL(url)
    processing.value = false
  }
}

async function submit() {
  if (busy.value || processing.value) return
  error.value = ''
  saved.value = false
  if (!name.value.trim() || name.value.trim().length > 80) {
    error.value = 'Escribe un nombre de entre 1 y 80 caracteres.'
    return
  }
  busy.value = true
  try {
    auth.user = await request<User>(
      '/auth/me',
      {
        method: 'PATCH',
        body: JSON.stringify({ name: name.value.trim(), avatar: avatar.value }),
      },
      auth.token ?? undefined,
    )
    name.value = auth.user.name
    saved.value = true
  } catch (cause) {
    error.value =
      cause instanceof ApiError && cause.status === 400
        ? 'Revisa el nombre y la foto de perfil.'
        : cause instanceof ApiError && cause.status === 401
          ? 'Tu sesión ha caducado. Vuelve a iniciar sesión.'
          : cause instanceof Error
            ? cause.message
            : 'No hemos podido guardar tu perfil.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="profile profile-edit">
    <a class="profile-edit-back" href="#/profile">← Volver a mi perfil</a>
    <div class="profile-welcome">
      <span class="eyebrow">A TU MANERA</span>
      <h1>Modificar mi perfil</h1>
      <p>Actualiza tu nombre y añade una foto para que todos te reconozcan.</p>
    </div>
    <MemberCard :user="preview" />
    <form class="profile-edit-form" @submit.prevent="submit">
      <fieldset :disabled="busy || processing">
        <label for="profile-name">Nombre</label>
        <input
          id="profile-name"
          v-model="name"
          name="name"
          autocomplete="name"
          required
          maxlength="80"
          @input="saved = false"
        />
        <label for="profile-photo">Foto de perfil</label>
        <input
          id="profile-photo"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          aria-describedby="photo-help"
          @change="selectPhoto"
        />
        <p id="photo-help" class="profile-edit-help">
          JPG, PNG o WebP, hasta 5 MB. La foto se recortará al centro.
        </p>
        <button
          v-if="avatar"
          class="profile-edit-remove"
          type="button"
          @click="
            avatar = '';
            saved = false
          "
        >
          Quitar foto
        </button>
      </fieldset>
      <p v-if="processing" role="status" class="profile-edit-help">Preparando tu foto…</p>
      <p v-if="error" role="alert" class="profile-edit-error">{{ error }}</p>
      <p v-if="saved" role="status" class="profile-edit-success">
        Tu perfil se ha guardado correctamente.
      </p>
      <button class="profile-edit-save" type="submit" :disabled="busy || processing">
        {{ busy ? 'Guardando…' : 'Guardar cambios' }}
      </button>
    </form>
  </section>
</template>
