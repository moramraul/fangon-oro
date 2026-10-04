<script setup lang="ts">
defineProps<{ image?: string | null }>()
</script>

<template>
  <div class="event-cover" aria-hidden="true">
    <img v-if="image" :src="image" alt="" loading="lazy" />
    <span v-else>✦</span>
  </div>
</template>

<style scoped>
.event-cover {
  width: 100%;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border-radius: 9px;
  background: radial-gradient(ellipse at top, #806127, #211b10 65%, #11100d);
  display: grid;
  place-items: center;
  color: var(--gold);
  font-size: 48px;
}
.event-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
