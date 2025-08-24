import { Env, TwitchTokenResponse } from './types';

export async function getBroadcasterId(env: Env): Promise<string> {
  try {
    console.log('🔑 Getting Twitch access token...');
    console.log('Client ID:', env.TWITCH_CLIENT_ID);
    console.log('Client Secret (first 4 chars):', env.TWITCH_CLIENT_SECRET?.substring(0, 4) + '...');
    console.log('Client ID length:', env.TWITCH_CLIENT_ID?.length || 0);
    console.log('Client Secret length:', env.TWITCH_CLIENT_SECRET?.length || 0);
    
    // Step 1: Get access token
    const tokenResponse = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `client_id=${env.TWITCH_CLIENT_ID}&client_secret=${env.TWITCH_CLIENT_SECRET}&grant_type=client_credentials`,
    });

    console.log('Token response status:', tokenResponse.status);
    
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token response error:', errorText);
      throw new Error(`Token request failed: ${tokenResponse.statusText} - ${errorText}`);
    }

    const tokenData = await tokenResponse.json() as TwitchTokenResponse;

    // Step 2: Get user ID by username
    const userResponse = await fetch(
      'https://api.twitch.tv/helix/users?login=paulchrisluke',
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
      throw new Error('User paulchrisluke not found');
    }

  } catch (error) {
    console.error('Error getting broadcaster ID:', error);
    throw error;
  }
}
