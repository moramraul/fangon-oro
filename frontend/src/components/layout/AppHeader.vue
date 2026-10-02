<script setup lang="ts">
defineProps<{ authenticated: boolean }>()
</script>

<template>
  <header class="brand">
    <span class="brand-mark" aria-hidden="true">✦</span
    ><a :href="authenticated ? '#/profile' : '#/login'">FANGÓN <span>DE ORO</span></a
    ><span class="edition">LOS PREMIOS</span>
  </header>
</template>
