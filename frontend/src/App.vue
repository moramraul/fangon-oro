<script setup lang="ts">
import { onMounted, watch } from 'vue'
import AppHeader from './components/layout/AppHeader.vue'
import AppFooter from './components/layout/AppFooter.vue'
import SessionState from './components/auth/SessionState.vue'
import LoginView from './views/LoginView.vue'
import RegisterView from './views/RegisterView.vue'
import ProfileView from './views/ProfileView.vue'
import EventCreateView from './views/EventCreateView.vue'
import { useAuthStore } from './stores/auth'
import { useHashRoute } from './composables/useHashRoute'
import './style.css'
const auth = useAuthStore()
const route = useHashRoute()
watch(route, () => auth.clearError())
watch([route, () => auth.user, () => auth.restoring], () => {
  if (auth.restoring) return
  if ((route.value === 'profile' || route.value === 'manage-events') && !auth.user)
    location.hash = '/login'
  else if (route.value === 'manage-events' && auth.user?.role !== 'ADMIN')
    location.hash = '/profile'
})
onMounted(() => void auth.restore())
</script>

<template>
  <main class="app-shell">
    <AppHeader :authenticated="Boolean(auth.user)" />
    <SessionState v-if="auth.restoring || auth.needsSessionRecovery" />
    <EventCreateView v-else-if="route === 'manage-events' && auth.user?.role === 'ADMIN'" />
    <ProfileView v-else-if="auth.user" :user="auth.user" />
    <RegisterView v-else-if="route === 'register'" />
    <LoginView v-else />
    <AppFooter />
  </main>
</template>

<style scoped src="./styles/app.css"></style>
