<script setup lang="ts">
import AuthLayout from '../components/auth/AuthLayout.vue'
import AuthForm from '../components/auth/AuthForm.vue'
import { useAuthStore } from '../stores/auth'
const auth = useAuthStore()
</script>

<template>
  <AuthLayout mode="register"
    ><AuthForm
      mode="register"
      :busy="auth.busy"
      :error="auth.error"
      :success="auth.success"
      @submit="auth.register"
      @google="auth.googleLogin"
  /></AuthLayout>
</template>
