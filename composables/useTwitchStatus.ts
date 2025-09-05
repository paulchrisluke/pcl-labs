export const useTwitchStatus = () => {
  const isLive = ref(false)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Get runtime config for environment variables
  const config = useRuntimeConfig()
  const TWITCH_CLIENT_ID = config.public.twitchClientId || ''
  const TWITCH_CLIENT_SECRET = config.public.twitchClientSecret || ''
  const TWITCH_BROADCASTER_ID = config.public.twitchBroadcasterId || ''
  const TWITCH_USERNAME = 'paulchrisluke'

  const checkLiveStatus = async () => {
    if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) {
      error.value = 'Twitch credentials not configured'
      console.warn('TWITCH_CLIENT_ID or TWITCH_CLIENT_SECRET environment variable not set')
      return
    }

    isLoading.value = true
    error.value = null

    try {
      // First, get an App Access Token
      console.log('Getting Twitch App Access Token...')
      const tokenResponse = await $fetch('https://id.twitch.tv/oauth2/token', {
        method: 'POST',
        params: {
          client_id: TWITCH_CLIENT_ID,
          client_secret: TWITCH_CLIENT_SECRET,
          grant_type: 'client_credentials'
        }
      })

      const accessToken = tokenResponse.access_token
      console.log('Got Twitch access token')

      // Use broadcaster ID if available, otherwise fall back to username
      const queryParam = TWITCH_BROADCASTER_ID ? 
        { user_id: TWITCH_BROADCASTER_ID } : 
        { user_login: TWITCH_USERNAME }
      
      console.log('Checking Twitch status for:', TWITCH_BROADCASTER_ID ? `ID: ${TWITCH_BROADCASTER_ID}` : `Username: ${TWITCH_USERNAME}`)
      const response = await $fetch('https://api.twitch.tv/helix/streams', {
        params: queryParam,
        headers: {
          'Client-ID': TWITCH_CLIENT_ID,
          'Authorization': `Bearer ${accessToken}`
        }
      })

      console.log('Twitch API response:', response)
      // If response has data, user is live
      isLive.value = response.data && response.data.length > 0
    } catch (err) {
      console.error('Error checking Twitch status:', err)
      error.value = `Failed to check live status: ${err.message || 'Unknown error'}`
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
  let intervalId: NodeJS.Timeout | null = null
  
  onMounted(() => {
    intervalId = setInterval(checkLiveStatus, 2 * 60 * 1000) // 2 minutes
  })

  onUnmounted(() => {
    if (intervalId) {
      clearInterval(intervalId)
    }
  })

  return {
    isLive: readonly(isLive),
    isLoading: readonly(isLoading),
    error: readonly(error),
    checkLiveStatus
  }
}
