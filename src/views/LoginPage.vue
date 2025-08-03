<template>
  <div class="min-h-screen bg-gray-50">
    <div class="px-2 py-3 sm:px-0 sm:py-6 min-h-screen flex items-center justify-center">
      <div class="border-4 border-dashed border-gray-200 rounded-lg p-3 sm:p-6 w-full max-w-md">
        <!-- Login Form Card -->
        <div class="px-3 py-4 sm:px-6 sm:py-5">
          <form @submit.prevent="handleLogin" class="space-y-4">
            <FormField
              v-model="password"
              type="password"
              label="Password"
              placeholder="Enter password"
              :required="true"
              :error="error"
            />

            <button
              type="submit"
              class="w-full py-2 px-4 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm font-medium shadow"
            >
              Sign in
            </button>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import FormField from '@/components/ui/FormField.vue'
import { useAuthStore } from '@/stores/auth'
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const { login, user } = useAuthStore()

const password = ref('')
const error = ref('')
const loading = ref(false)

const handleLogin = async () => {
  error.value = ''
  loading.value = true

  if (login(password.value)) {
    // Redirect to intended route or dashboard
    if (user.value && user.value.role === 'manager') {
      const redirect = '/dashboard'
      router.push(redirect)
    } else if (user.value && user.value.role === 'requester') {
      const redirect = '/stock-requests'
      router.push(redirect)
    }
  } else {
    error.value = 'Invalid password. Please try again.'
  }

  loading.value = false
}
</script>
