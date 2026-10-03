<script setup lang="ts">
import { computed } from 'vue'
import type { User } from '../../api'
const props = defineProps<{ user: User }>()
const initials = computed(() =>
  props.user.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase(),
)
</script>

<template>
  <div class="member-card">
    <div class="card-top">
      <span class="eyebrow">MI PERFIL</span
      ><span class="member-badge">{{ user.role === 'ADMIN' ? 'Administrador' : 'Miembro' }}</span>
    </div>
    <div class="member-details">
      <div class="member-info">
        <h2>{{ user.name }}</h2>
        <p class="member-email">{{ user.email }}</p>
      </div>
      <div class="avatar">
        <img v-if="user.avatar" :src="user.avatar" :alt="`Foto de ${user.name}`" />
        <span v-else>{{ initials }}</span>
      </div>
    </div>
    <div class="card-bottom"><span>FANGÓN DE ORO</span><span aria-hidden="true">✦</span></div>
  </div>
</template>

<style scoped src="../../styles/member-card.css"></style>
