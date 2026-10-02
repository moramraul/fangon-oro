<script setup lang="ts">
import { useAuthStore } from '../../stores/auth'
const auth = useAuthStore()
</script>

<template>
  <div v-if="auth.restoring" class="session-state" role="status">
    <span class="brand-mark">✦</span>
    <p>Preparando tu entrada…</p>
  </div>
  <div v-else class="session-state">
    <h1>Volvemos en un momento</h1>
    <p role="alert">{{ auth.error }}</p>
    <button class="primary" @click="auth.restore">Reintentar</button
    ><button class="text-button" @click="auth.logout">Ir al inicio de sesión</button>
  </div>
</template>

<style scoped src="../../styles/session-state.css"></style>
