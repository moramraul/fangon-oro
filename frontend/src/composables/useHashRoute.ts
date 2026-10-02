import { onMounted, onUnmounted, ref } from 'vue'
type Route = 'login' | 'register' | 'profile'
function readRoute(): Route {
  if (location.hash === '#/register') return 'register'
  if (location.hash === '#/profile') return 'profile'
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
