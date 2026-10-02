<script setup lang="ts">
import { onMounted, watch } from 'vue'
import AppHeader from './components/layout/AppHeader.vue'
import AppFooter from './components/layout/AppFooter.vue'
import SessionState from './components/auth/SessionState.vue'
import LoginView from './views/LoginView.vue'
import RegisterView from './views/RegisterView.vue'
import ProfileView from './views/ProfileView.vue'
import { useAuthStore } from './stores/auth'
import { useHashRoute } from './composables/useHashRoute'
import './style.css'
const auth = useAuthStore()
const route = useHashRoute()
watch(route, () => {
  auth.clearError()
  if (route.value === 'profile' && !auth.user && !auth.restoring) location.hash = '/login'
})
onMounted(() => void auth.restore())
</script>

<template>
  <main class="app-shell">
    <AppHeader :authenticated="Boolean(auth.user)" />
    <SessionState v-if="auth.restoring || auth.needsSessionRecovery" />
    <ProfileView v-else-if="auth.user" :user="auth.user" />
    <RegisterView v-else-if="route === 'register'" />
    <LoginView v-else />
    <AppFooter />
  </main>
</template>
