<script setup lang="ts">
import { nextTick, onMounted, watch } from 'vue'
import AppHeader from './components/layout/AppHeader.vue'
import AppFooter from './components/layout/AppFooter.vue'
import SessionState from './components/auth/SessionState.vue'
import PasswordPrompt from './components/auth/PasswordPrompt.vue'
import LoginView from './views/LoginView.vue'
import PasswordRecoveryView from './views/PasswordRecoveryView.vue'
import RegisterView from './views/RegisterView.vue'
import ProfileView from './views/ProfileView.vue'
import UsersAdminView from './views/UsersAdminView.vue'
import ProfileEditView from './views/ProfileEditView.vue'
import EventCreateView from './views/EventCreateView.vue'
import EventsAdminView from './views/EventsAdminView.vue'
import VotingView from './views/VotingView.vue'
import OverviewView from './views/OverviewView.vue'
import RankingsView from './views/RankingsView.vue'
import ResponsesView from './views/ResponsesView.vue'
import StatsView from './views/StatsView.vue'
import WinnersView from './views/WinnersView.vue'
import PastEventsView from './views/PastEventsView.vue'
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
    [
      'overview',
      'rankings',
      'responses',
      'stats',
      'winners',
      'profile',
      'edit-profile',
      'events',
      'past-events',
      'manage-events',
      'manage-users',
      'admin-events',
      'vote',
    ].includes(route.value) &&
    !auth.user
  )
    location.hash = '/login'
  else if (
    ['manage-events', 'manage-users', 'admin-events'].includes(route.value) &&
    auth.user?.role !== 'ADMIN'
  )
    location.hash = '/overview'
})
onMounted(() => void auth.restore())
</script>

<template>
  <main class="app-shell">
    <AppHeader :authenticated="Boolean(auth.user)" />
    <PasswordRecoveryView
      v-if="route === 'forgot-password' || route === 'reset-password'"
      :reset="route === 'reset-password'"
    />
    <SessionState v-else-if="auth.restoring || auth.needsSessionRecovery" />
    <OverviewView v-else-if="(route === 'overview' || route === 'events') && auth.user" />
    <RankingsView v-else-if="route === 'rankings' && auth.user" />
    <ResponsesView v-else-if="route === 'responses' && auth.user" />
    <StatsView v-else-if="route === 'stats' && auth.user" />
    <WinnersView v-else-if="route === 'winners' && auth.user" />
    <PastEventsView v-else-if="route === 'past-events' && auth.user" />
    <EventsAdminView v-else-if="route === 'admin-events' && auth.user?.role === 'ADMIN'" />
    <EventCreateView v-else-if="route === 'manage-events' && auth.user?.role === 'ADMIN'" />
    <UsersAdminView v-else-if="route === 'manage-users' && auth.user?.role === 'ADMIN'" />
    <VotingView v-else-if="route === 'vote' && auth.user" />
    <ProfileEditView v-else-if="route === 'edit-profile' && auth.user" :user="auth.user" />
    <ProfileView v-else-if="auth.user" :user="auth.user" />
    <RegisterView v-else-if="route === 'register'" />
    <LoginView v-else />
    <AppFooter />
    <PasswordPrompt
      v-if="
        !auth.restoring &&
        auth.user?.hasGoogle &&
        !auth.user.hasPassword &&
        !auth.user.passwordPromptSeen &&
        (route === 'overview' || route === 'events')
      "
    />
  </main>
</template>

<style scoped src="./styles/app.css"></style>
