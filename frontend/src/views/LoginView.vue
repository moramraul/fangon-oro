<script setup lang="ts">
import AuthLayout from '../components/auth/AuthLayout.vue'
import AuthForm from '../components/auth/AuthForm.vue'
import { useAuthStore } from '../stores/auth'
const auth = useAuthStore()
</script>

<template>
  <AuthLayout mode="login"
    ><AuthForm
      mode="login"
      :busy="auth.busy"
      :error="auth.error"
      @submit="auth.login"
      @google="auth.googleLogin"
  /></AuthLayout>
</template>
