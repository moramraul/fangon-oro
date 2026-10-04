<script setup lang="ts">
import { nextTick, onMounted, watch } from 'vue'
import AppHeader from './components/layout/AppHeader.vue'
import AppFooter from './components/layout/AppFooter.vue'
import SessionState from './components/auth/SessionState.vue'
import LoginView from './views/LoginView.vue'
import RegisterView from './views/RegisterView.vue'
import ProfileView from './views/ProfileView.vue'
import ProfileEditView from './views/ProfileEditView.vue'
import EventCreateView from './views/EventCreateView.vue'
import VotingView from './views/VotingView.vue'
import OverviewView from './views/OverviewView.vue'
import RankingsView from './views/RankingsView.vue'
import { useAuthStore } from './stores/auth'
import { useHashRoute } from './composables/useHashRoute'
import './style.css'
const auth = useAuthStore()
const route = useHashRoute()
watch(route, async () => {
  auth.clearError()
  await nextTick()
  window.scrollTo({ top: 0 })
})
watch([route, () => auth.user, () => auth.restoring], () => {
  if (auth.restoring) return
  if (
    ['overview', 'rankings', 'profile', 'edit-profile', 'events', 'manage-events', 'vote'].includes(
      route.value,
    ) &&
    !auth.user
  )
    location.hash = '/login'
  else if (route.value === 'manage-events' && auth.user?.role !== 'ADMIN')
    location.hash = '/overview'
})
onMounted(() => void auth.restore())
</script>

<template>
  <main class="app-shell">
    <AppHeader :authenticated="Boolean(auth.user)" />
    <SessionState v-if="auth.restoring || auth.needsSessionRecovery" />
    <OverviewView v-else-if="(route === 'overview' || route === 'events') && auth.user" />
    <RankingsView v-else-if="route === 'rankings' && auth.user" />
    <EventCreateView v-else-if="route === 'manage-events' && auth.user?.role === 'ADMIN'" />
    <VotingView v-else-if="route === 'vote' && auth.user" />
    <ProfileEditView v-else-if="route === 'edit-profile' && auth.user" :user="auth.user" />
    <ProfileView v-else-if="auth.user" :user="auth.user" />
    <RegisterView v-else-if="route === 'register'" />
    <LoginView v-else />
    <AppFooter />
  </main>
</template>

<style scoped src="./styles/app.css"></style>
