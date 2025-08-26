import type { Environment, TwitchTokenResponse } from './types/index.js';

export async function getBroadcasterId(env: Environment): Promise<string> {
  // Step 0: Check if broadcaster ID is already provided
  if (env.TWITCH_BROADCASTER_ID) {
    console.log('🔑 Using provided TWITCH_BROADCASTER_ID');
    return env.TWITCH_BROADCASTER_ID;
  }

  // Step 0.5: Validate that login is provided
  if (!env.TWITCH_BROADCASTER_LOGIN) {
    throw new Error('TWITCH_BROADCASTER_LOGIN environment variable is required when TWITCH_BROADCASTER_ID is not provided');
  }

  try {
    console.log('🔑 Getting Twitch access token...');
    // Credentials present; avoid logging their values or metadata.
    
    // Step 1: Get access token
    const tokenBody = new URLSearchParams({
      client_id: env.TWITCH_CLIENT_ID,
      client_secret: env.TWITCH_CLIENT_SECRET,
      grant_type: 'client_credentials',
    });
    
    const tokenResponse = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenBody,
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token response error:', errorText);
      throw new Error(`Token request failed: ${tokenResponse.statusText} - ${errorText}`);
    }

    const tokenData = await tokenResponse.json() as TwitchTokenResponse;

    // Step 2: Get user ID by username
    const userResponse = await fetch(
      `https://api.twitch.tv/helix/users?login=${env.TWITCH_BROADCASTER_LOGIN}`,
      {
        headers: {
          'Client-ID': env.TWITCH_CLIENT_ID,
          'Authorization': `Bearer ${tokenData.access_token}`,
        },
      }
    );

    if (!userResponse.ok) {
      throw new Error(`User lookup failed: ${userResponse.statusText}`);
    }

    const userData = await userResponse.json() as { data: Array<{ id: string }> };
    
    if (userData.data?.length > 0) {
      return userData.data[0].id;
    } else {
      throw new Error(`User ${env.TWITCH_BROADCASTER_LOGIN} not found`);
    }

  } catch (error) {
    console.error('Error getting broadcaster ID:', error);
    throw error;
  }
}
