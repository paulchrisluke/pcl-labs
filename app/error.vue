<template>
  <div class="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
    <div class="sm:mx-auto sm:w-full sm:max-w-md">
      <div class="text-center">
        <h1 class="text-6xl font-bold text-gray-900 mb-4">{{ error.statusCode }}</h1>
        <h2 class="text-2xl font-semibold text-gray-700 mb-4">
          {{ error.statusCode === 404 ? 'Page Not Found' : 'Something went wrong' }}
        </h2>
        <p class="text-gray-600 mb-8">
          {{ error.statusCode === 404 
            ? 'The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.' 
            : 'We encountered an unexpected error. Please try again later.' 
          }}
        </p>
        <div class="space-y-4">
          <NuxtLink 
            to="/" 
            class="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            Go back home
          </NuxtLink>
          <div class="text-sm">
            <button 
              @click="handleError" 
              class="text-blue-600 hover:text-blue-500 underline"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: 'Error' })

defineProps<{ error: Error | Record<string, unknown> }>()

const handleError = (): void => {
  clearError({ redirect: '/' })
}
</script>
