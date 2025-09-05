export const useTwitchStatus = () => {
  const isLive = ref(false)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const checkLiveStatus = async () => {
    isLoading.value = true
    error.value = null

    try {
      // Call our server-side API endpoint instead of direct Twitch API
      console.log('Checking Twitch status via server API...')
      const response = await $fetch('/api/twitch/live')

      console.log('Twitch status response:', response)
      isLive.value = response.isLive
    } catch (err) {
      console.error('Error checking Twitch status:', err)
      error.value = `Failed to check live status: ${err instanceof Error ? err.message : 'Unknown error'}`
      isLive.value = false
    } finally {
      isLoading.value = false
    }
  }

  // Check status on composable creation
  onMounted(() => {
    checkLiveStatus()
  })

  // Set up periodic checking (every 2 minutes)
  let intervalId: ReturnType<typeof setInterval> | null = null
  
  onMounted(() => {
    intervalId = setInterval(checkLiveStatus, 2 * 60 * 1000) // 2 minutes
  })

  onUnmounted(() => {
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
  })

  return {
    isLive: readonly(isLive),
    isLoading: readonly(isLoading),
    error: readonly(error),
    checkLiveStatus
  }
}
