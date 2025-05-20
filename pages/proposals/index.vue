<template>
  <div class="bg-gray-900 px-6 pt-32 pb-16 lg:px-8">
    <div class="mx-auto max-w-3xl text-center">
      <h1 class="text-3xl font-bold tracking-tight text-white sm:text-4xl">Client Proposals</h1>
      <p v-if="!isAuthenticated" class="mt-6 text-lg leading-8 text-gray-300">
        Please enter the password to access your custom proposal.
      </p>
      <p v-else class="mt-6 text-lg leading-8 text-gray-300">
        Select your proposal from the list below.
      </p>
    </div>

    <div v-if="!isAuthenticated" class="mx-auto mt-10 max-w-md">
      <form @submit.prevent="authenticate" class="bg-gray-800 p-6 rounded-lg shadow-lg">
        <div class="mb-4">
          <label for="password" class="block text-sm font-medium leading-6 text-gray-300">Password</label>
          <div class="mt-2">
            <input
              id="password"
              v-model="password"
              type="password"
              required
              class="block w-full rounded-md border-0 bg-white/5 py-2 px-3 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6"
              placeholder="Enter your password"
            />
          </div>
        </div>
        <div v-if="error" class="mt-2 text-sm text-red-500">
          {{ error }}
        </div>
        <div class="mt-6">
          <button
            type="submit"
            class="w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            Access Proposals
          </button>
        </div>
      </form>
    </div>

    <div v-else class="mx-auto mt-16 max-w-7xl">
      <h2 class="text-2xl font-bold text-white mb-8">Your Proposals</h2>
      <ul role="list" class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <li v-for="proposal in proposals" :key="proposal._path" class="col-span-1 divide-y divide-gray-700 rounded-lg bg-gray-800 shadow">
          <div class="flex w-full items-center justify-between space-x-6 p-6">
            <div class="flex-1 truncate">
              <div class="flex items-center space-x-3">
                <h3 class="truncate text-lg font-medium text-white">{{ proposal.title }}</h3>
              </div>
              <p class="mt-1 truncate text-sm text-gray-400">{{ proposal.client }}</p>
              <div class="mt-2 flex flex-wrap">
                <span v-for="tag in proposal.tags" :key="tag" class="inline-flex items-center rounded-md bg-gray-700 px-2 py-1 text-xs font-medium text-gray-300 mr-2 mb-2">
                  {{ tag }}
                </span>
              </div>
            </div>
          </div>
          <div>
            <div class="-mt-px flex divide-x divide-gray-700">
              <div class="flex w-0 flex-1">
                <NuxtLink
                  :to="proposal._path"
                  class="relative -mr-px inline-flex w-0 flex-1 items-center justify-center gap-x-3 rounded-bl-lg border border-transparent py-4 text-sm font-semibold text-indigo-400 hover:text-indigo-300"
                >
                  View Proposal
                </NuxtLink>
              </div>
            </div>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'

// Password state
const password = ref('')
const error = ref('')
const isAuthenticated = ref(false)

// Check if user is already authenticated
onMounted(() => {
  if (process.client) {
    isAuthenticated.value = localStorage.getItem('proposal_auth') === 'true'
  }
})

// Authentication function
const authenticate = () => {
  if (password.value === '$p1ckl3s!') {
    if (process.client) {
      localStorage.setItem('proposal_auth', 'true')
      isAuthenticated.value = true
      error.value = ''
    }
  } else {
    error.value = 'Incorrect password. Please try again.'
  }
}

// Fetch proposals if authenticated
const { data: proposals } = await useAsyncData('proposals', () => {
  return queryContent('proposals').find()
})

useHead({
  title: 'Client Proposals - PCL Labs',
  meta: [
    { name: 'description', content: 'Access your custom proposal from PCL Labs.' },
    { property: 'og:title', content: 'Client Proposals - PCL Labs' },
    { property: 'og:description', content: 'Access your custom proposal from PCL Labs.' },
  ]
})
</script> 