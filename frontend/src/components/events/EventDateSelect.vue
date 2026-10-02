<script setup lang="ts">
import { computed } from 'vue'

defineProps<{ label: string; disabled?: boolean }>()
const model = defineModel<string>({ required: true })
const parts = computed(() => {
  const date = new Date(model.value)
  return {
    year: date.getFullYear(),
    month: date.getMonth(),
    day: date.getDate(),
    hour: date.getHours(),
    minute: date.getMinutes(),
  }
})
const months = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]
const days = computed(() => new Date(parts.value.year, parts.value.month + 1, 0).getDate())
const currentYear = new Date().getFullYear()
const years = computed(() => {
  const first = Math.min(currentYear, parts.value.year)
  const last = Math.max(currentYear + 10, parts.value.year)
  return Array.from({ length: last - first + 1 }, (_, i) => first + i)
})
function update(part: keyof typeof parts.value, event: Event) {
  const next = { ...parts.value, [part]: Number((event.target as HTMLSelectElement).value) }
  next.day = Math.min(next.day, new Date(next.year, next.month + 1, 0).getDate())
  model.value = new Date(next.year, next.month, next.day, next.hour, next.minute).toISOString()
}
</script>

<template>
  <fieldset class="date-select" :disabled="disabled">
    <legend>{{ label }}</legend>
    <div class="date-parts">
      <label
        >Día<select :value="parts.day" @change="update('day', $event)">
          <option v-for="day in days" :key="day" :value="day">{{ day }}</option>
        </select></label
      >
      <label
        >Mes<select :value="parts.month" @change="update('month', $event)">
          <option v-for="(month, index) in months" :key="month" :value="index">{{ month }}</option>
        </select></label
      >
      <label
        >Año<select :value="parts.year" @change="update('year', $event)">
          <option v-for="year in years" :key="year" :value="year">{{ year }}</option>
        </select></label
      >
    </div>
    <div class="time-parts">
      <label
        >Hora<select :value="parts.hour" @change="update('hour', $event)">
          <option v-for="hour in 24" :key="hour" :value="hour - 1">
            {{ String(hour - 1).padStart(2, '0') }}
          </option>
        </select></label
      >
      <label
        >Minuto<select :value="parts.minute" @change="update('minute', $event)">
          <option v-for="minute in 60" :key="minute" :value="minute - 1">
            {{ String(minute - 1).padStart(2, '0') }}
          </option>
        </select></label
      >
    </div>
  </fieldset>
</template>

<style scoped src="../../styles/event-date-select.css"></style>
