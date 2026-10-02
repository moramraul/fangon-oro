<script setup lang="ts">
import { computed } from 'vue'
import AuthHero from './AuthHero.vue'
const props = defineProps<{ mode: 'login' | 'register' }>()
const registering = computed(() => props.mode === 'register')
</script>

<template>
  <AuthHero />
  <section class="auth-panel" aria-labelledby="auth-title">
    <nav class="auth-tabs" aria-label="Acceso">
      <a
        href="#/login"
        :class="{ active: !registering }"
        :aria-current="!registering ? 'page' : undefined"
        >Iniciar sesión</a
      ><a
        href="#/register"
        :class="{ active: registering }"
        :aria-current="registering ? 'page' : undefined"
        >Crear cuenta</a
      >
    </nav>
    <div class="heading">
      <span class="eyebrow">{{
        registering ? 'TU SITIO EN LOS PREMIOS' : 'QUE EMPIECE LO BUENO'
      }}</span>
      <h1 id="auth-title">
        {{ registering ? 'Entra en la historia.' : 'Bienvenido de vuelta.' }}
      </h1>
      <p>
        {{
          registering
            ? 'Crea tu cuenta y forma parte del Fangón de Oro.'
            : 'Tu próxima gran decisión empieza aquí.'
        }}
      </p>
    </div>
    <slot />
    <p class="switch-copy">
      {{ registering ? '¿Ya tienes cuenta?' : '¿Es tu primera vez?' }}
      <a :href="registering ? '#/login' : '#/register'">{{
        registering ? 'Inicia sesión' : 'Únete a los premios'
      }}</a>
    </p>
  </section>
</template>
