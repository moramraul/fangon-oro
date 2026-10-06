<script setup lang="ts">
import MemberCard from '../components/profile/MemberCard.vue'
import PendingUsers from '../components/profile/PendingUsers.vue'
import EditionsAdmin from '../components/profile/EditionsAdmin.vue'
import type { User } from '../api'
import { useAuthStore } from '../stores/auth'
import '../styles/profile.css'
defineProps<{ user: User }>()
const auth = useAuthStore()
</script>

<template>
  <section class="profile">
    <div class="profile-welcome">
      <span class="eyebrow">YA ESTÁS DENTRO</span>
      <h1>Tu lugar en<br />el Fangón de Oro.</h1>
      <p>Las mejores historias merecen un premio.</p>
    </div>
    <MemberCard :user="user" />
    <nav class="profile-actions" aria-label="Acciones de perfil">
      <a class="profile-action" href="#/profile/edit">Modificar mi perfil</a>
      <a v-if="user.role === 'ADMIN'" class="profile-action" href="#/events/manage">
        Crear o modificar evento
      </a>
    </nav>
    <PendingUsers v-if="user.role === 'ADMIN'" />
    <EditionsAdmin v-if="user.role === 'ADMIN'" />
    <button class="logout" @click="auth.logout">
      Cerrar sesión <span aria-hidden="true">↗</span>
    </button>
  </section>
</template>
