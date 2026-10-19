import { ref } from 'vue'
import { request, type EditionSummary } from '../api'

export const closedEditions = ref<EditionSummary[]>([])
export const winnerEditions = ref<EditionSummary[]>([])
let revision = 0
export async function refreshWinners(token: string | null) {
  const current = ++revision
  closedEditions.value = []
  winnerEditions.value = []
  if (!token) return
  try {
    const editions = await request<EditionSummary[]>('/editions', {}, token)
    if (current === revision) {
      closedEditions.value = editions.filter((edition) => edition.status === 'closed')
      winnerEditions.value = editions
    }
    return true
  } catch {
    // Navigation is optional; the winners page provides errors and retry.
    return false
  }
}
