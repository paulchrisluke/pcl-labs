// Simple in-memory token cache (in production, consider using Redis or similar)
let tokenCache: { token: string; expiresAt: number } | null = null

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  
  const TWITCH_CLIENT_ID = config.public.twitchClientId
  const TWITCH_CLIENT_SECRET = config.twitchClientSecret // Private config
  const TWITCH_BROADCASTER_ID = config.public.twitchBroadcasterId
  const TWITCH_USERNAME = 'paulchrisluke'

  if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Twitch credentials not configured'
    })
  }

  try {
    // Check if we have a valid cached token
    let accessToken = null
    if (tokenCache && tokenCache.expiresAt > Date.now()) {
      accessToken = tokenCache.token
    } else {
      // Get a new App Access Token
      console.log('Getting new Twitch App Access Token...')
      const tokenResponse = await $fetch('https://id.twitch.tv/oauth2/token', {
        method: 'POST',
        params: {
          client_id: TWITCH_CLIENT_ID,
          client_secret: TWITCH_CLIENT_SECRET,
          grant_type: 'client_credentials'
        }
      }) as { access_token: string; expires_in?: number }

      accessToken = tokenResponse.access_token
      
      // Cache the token (expires in 1 hour, cache for 50 minutes to be safe)
      const expiresIn = tokenResponse.expires_in || 3600
      tokenCache = {
        token: accessToken,
        expiresAt: Date.now() + (expiresIn - 600) * 1000 // 10 minutes buffer
      }
      
      console.log('Cached new Twitch access token')
    }

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
    }) as { data: any[] }

    console.log('Twitch API response:', response)
    
    // Return only the necessary data (no sensitive information)
    return {
      isLive: response.data && response.data.length > 0,
      data: response.data || []
    }
  } catch (error) {
    console.error('Error checking Twitch status:', error)
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to check live status: ${error instanceof Error ? error.message : 'Unknown error'}`
    })
  }
})
