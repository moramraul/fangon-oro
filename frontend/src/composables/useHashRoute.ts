import { onMounted, onUnmounted, ref } from 'vue'
type Route =
  | 'login'
  | 'register'
  | 'forgot-password'
  | 'reset-password'
  | 'overview'
  | 'rankings'
  | 'stats'
  | 'profile'
  | 'edit-profile'
  | 'events'
  | 'past-events'
  | 'manage-events'
  | 'vote'
export function readRoute(hash = location.hash): Route {
  if (hash === '#/forgot-password') return 'forgot-password'
  if (hash.startsWith('#/reset-password?')) return 'reset-password'
  if (hash === '#/overview' || hash === '#/') return 'overview'
  if (hash === '#/stats') return 'stats'
  if (/^#\/events\/[^/]+\/vote$/.test(hash)) return 'vote'
  if (hash === '#/rankings' || /^#\/rankings\/events\/[^/]+$/.test(hash)) return 'rankings'
  if (hash === '#/profile/edit') return 'edit-profile'
  if (hash === '#/events') return 'events'
  if (hash === '#/events/past') return 'past-events'
  if (hash === '#/events/manage') return 'manage-events'
  if (hash === '#/register') return 'register'
  if (hash === '#/profile') return 'profile'
  return 'login'
}
export function useHashRoute() {
  const route = ref<Route>(readRoute())
  function syncRoute() {
    route.value = readRoute()
  }
  onMounted(() => window.addEventListener('hashchange', syncRoute))
  onUnmounted(() => window.removeEventListener('hashchange', syncRoute))
  return route
}
