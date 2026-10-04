<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useAuthStore } from '../../stores/auth'

defineProps<{ authenticated: boolean }>()
const auth = useAuthStore()
const menuOpen = ref(false)
const accountMenu = ref<HTMLElement | null>(null)
const avatarButton = ref<HTMLButtonElement | null>(null)
const initials = computed(() =>
  (auth.user?.name ?? '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase(),
)

function closeOnOutsideClick(event: PointerEvent) {
  if (event.target instanceof Node && !accountMenu.value?.contains(event.target)) {
    menuOpen.value = false
  }
}
function closeOnEscape(event: KeyboardEvent) {
  if (event.key === 'Escape' && menuOpen.value) {
    menuOpen.value = false
    avatarButton.value?.focus()
  }
}
function closeOnFocusLeave(event: FocusEvent) {
  if (!(event.relatedTarget instanceof Node) || !accountMenu.value?.contains(event.relatedTarget)) {
    menuOpen.value = false
  }
}
function logout() {
  menuOpen.value = false
  auth.logout()
}
onMounted(() => {
  document.addEventListener('pointerdown', closeOnOutsideClick)
  document.addEventListener('keydown', closeOnEscape)
  window.addEventListener('hashchange', closeMenu)
})
function closeMenu() {
  menuOpen.value = false
}
onUnmounted(() => {
  document.removeEventListener('pointerdown', closeOnOutsideClick)
  document.removeEventListener('keydown', closeOnEscape)
  window.removeEventListener('hashchange', closeMenu)
})
</script>

<template>
  <header class="brand">
    <span class="brand-mark" aria-hidden="true">✦</span
    ><a :href="authenticated ? '#/overview' : '#/login'">FANGÓN <span>DE ORO</span></a>
    <nav v-if="authenticated" class="header-navigation" aria-label="Navegación principal">
      <a href="#/overview">Home</a>
      <a href="#/rankings">Clasificaciones</a>
      <div ref="accountMenu" class="account-menu" @focusout="closeOnFocusLeave">
        <button
          ref="avatarButton"
          type="button"
          class="avatar-button"
          :aria-label="`Abrir menú de ${auth.user?.name ?? 'usuario'}`"
          :aria-expanded="menuOpen"
          aria-controls="header-account-options"
          @click="menuOpen = !menuOpen"
        >
          <img v-if="auth.user?.avatar" :src="auth.user.avatar" alt="" />
          <span v-else aria-hidden="true">{{ initials || 'U' }}</span>
        </button>
        <div v-if="menuOpen" id="header-account-options" class="account-options">
          <a href="#/profile" @click="closeMenu">Perfil</a>
          <button type="button" @click="logout">Cerrar sesión</button>
        </div>
      </div>
    </nav>
    <span v-else class="edition">LOS PREMIOS</span>
  </header>
</template>

<style scoped src="../../styles/app-header.css"></style>
