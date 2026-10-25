<script setup lang="ts">
import { computed, ref } from 'vue'
const props = defineProps<{
  label: string
  options: { value: string; label: string }[]
  modelValue: string[]
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>()
const search = ref('')
const all = computed(() => props.modelValue.includes('*'))
const selected = computed(() =>
  all.value
    ? props.options.length
    : props.options.filter((option) => props.modelValue.includes(option.value)).length,
)
const visible = computed(() =>
  props.options.filter((option) =>
    option.label.toLocaleLowerCase('es').includes(search.value.toLocaleLowerCase('es')),
  ),
)
function toggle(value: string, checked: boolean) {
  const values = all.value ? props.options.map((option) => option.value) : props.modelValue
  emit(
    'update:modelValue',
    checked ? [...new Set([...values, value])] : values.filter((item) => item !== value),
  )
}
</script>

<template>
  <details class="response-filter">
    <summary>
      {{ label }} <span>{{ all ? 'Todos' : `${selected} seleccionados` }}</span>
    </summary>
    <div class="filter-options">
      <input
        v-if="options.length > 6"
        v-model="search"
        type="search"
        :aria-label="`Buscar en ${label}`"
        placeholder="Buscar…"
      />
      <label
        ><input
          type="checkbox"
          :checked="all"
          @change="
            emit('update:modelValue', ($event.target as HTMLInputElement).checked ? ['*'] : [])
          "
        />
        Todos</label
      >
      <div class="filter-scroll">
        <label v-for="option in visible" :key="option.value">
          <input
            type="checkbox"
            :checked="all || modelValue.includes(option.value)"
            @change="toggle(option.value, ($event.target as HTMLInputElement).checked)"
          />
          {{ option.label }}
        </label>
        <p v-if="!visible.length">No hay opciones disponibles.</p>
      </div>
    </div>
  </details>
</template>

<style scoped>
.response-filter {
  min-width: 0;
  border: 1px solid #d9b66560;
  border-radius: 8px;
  background: #201e17;
}
summary {
  padding: 12px;
  cursor: pointer;
  color: var(--gold);
  font-size: 13px;
}
summary span {
  margin-left: 6px;
  color: var(--muted);
  font-size: 11px;
}
.filter-options {
  padding: 0 12px 12px;
}
.filter-scroll {
  max-height: 220px;
  overflow-y: auto;
}
label {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  font-size: 13px;
  overflow-wrap: anywhere;
}
input[type='checkbox'] {
  flex: 0 0 auto;
  width: 18px;
  height: 18px;
  accent-color: var(--gold);
}
input[type='search'] {
  width: 100%;
  min-height: 44px;
  padding: 8px;
  border: 1px solid #d9b66560;
  border-radius: 6px;
  background: #17140f;
  color: inherit;
  font: inherit;
}
p {
  color: var(--muted);
  font-size: 12px;
}
summary:focus-visible,
input:focus-visible {
  outline: 2px solid var(--gold);
  outline-offset: 2px;
}
</style>
