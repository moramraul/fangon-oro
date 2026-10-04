import { onMounted, onUnmounted, ref } from 'vue'
type Route =
  | 'login'
  | 'register'
  | 'overview'
  | 'profile'
  | 'edit-profile'
  | 'events'
  | 'manage-events'
  | 'vote'
export function readRoute(hash = location.hash): Route {
  if (hash === '#/overview' || hash === '#/') return 'overview'
  if (/^#\/events\/[^/]+\/vote$/.test(hash)) return 'vote'
  if (hash === '#/profile/edit') return 'edit-profile'
  if (hash === '#/events') return 'events'
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
