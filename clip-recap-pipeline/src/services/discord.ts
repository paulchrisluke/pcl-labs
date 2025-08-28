import type { Environment, JudgeResult } from '../types/index.js';

interface DiscordEmbed {
  title: string;
  description?: string;
  color?: number;
  fields?: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
  footer?: {
    text: string;
  };
  timestamp?: string;
}

export class DiscordService {
  constructor(private env: Environment) {}

  async notifyPRCreated(pr: any, judgeResult: JudgeResult, clipCount: number): Promise<void> {
    console.log(`Notifying Discord about PR ${pr.number} with ${clipCount} clips...`);
    
    const embed: DiscordEmbed = {
      title: '🎬 Daily Dev Recap Ready for Review',
      description: `A new daily development recap has been generated and is ready for review!`,
      color: judgeResult.overall >= 0.8 ? 0x00ff00 : 0xffa500, // Green if good, orange if needs review
      fields: [
        {
          name: '📊 Quality Score',
          value: `${Math.round(judgeResult.overall * 100)}/100`,
          inline: true
        },
        {
          name: '🎥 Clips Included',
          value: `${clipCount} clips`,
          inline: true
        },
        {
          name: '📝 Status',
          value: judgeResult.action === 'approve' ? '✅ Ready to merge' : '⚠️ Needs review',
          inline: true
        },
        {
          name: '🔗 Pull Request',
          value: `[View PR #${pr.number}](${pr.html_url})`,
          inline: false
        }
      ],
      footer: {
        text: 'Twitch Clip Recap Pipeline'
      },
      timestamp: new Date().toISOString()
    };

    await this.sendDiscordMessage(embed);
  }

  async notifyError(error: any): Promise<void> {
    console.log('Sending error notification to Discord...');
    
    const embed: DiscordEmbed = {
      title: '❌ Pipeline Error',
      description: 'The daily clip recap pipeline encountered an error.',
      color: 0xff0000, // Red
      fields: [
        {
          name: '🚨 Error Details',
          value: error.message || 'Unknown error occurred',
          inline: false
        }
      ],
      footer: {
        text: 'Twitch Clip Recap Pipeline'
      },
      timestamp: new Date().toISOString()
    };

    await this.sendDiscordMessage(embed);
  }

  async notifyTokenValidationErrors(errors: string[]): Promise<void> {
    console.log('Sending token validation error notification to Discord...');
    
    const embed: DiscordEmbed = {
      title: '🔐 Token Validation Failed',
      description: 'One or more API tokens failed validation during the hourly check.',
      color: 0xff6b35, // Orange-red
      fields: errors.map((error, index) => ({
        name: `Error ${index + 1}`,
        value: error,
        inline: false
      })),
      footer: {
        text: 'Twitch Clip Recap Pipeline - Token Validation'
      },
      timestamp: new Date().toISOString()
    };

    await this.sendDiscordMessage(embed);
  }

  private async sendDiscordMessage(embed: DiscordEmbed): Promise<void> {
    // validate Discord config before issuing API request
    if (!this.env.DISCORD_REVIEW_CHANNEL_ID || !this.env.DISCORD_BOT_TOKEN) {
      throw new Error(
        'Discord configuration missing: DISCORD_REVIEW_CHANNEL_ID and DISCORD_BOT_TOKEN are required'
      );
    }

    const message = {
      embeds: [embed]
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const doPost = async () =>
        fetch(
          `https://discord.com/api/v10/channels/${this.env.DISCORD_REVIEW_CHANNEL_ID}/messages`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bot ${this.env.DISCORD_BOT_TOKEN}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(message),
            signal: controller.signal,
          }
        );

      let response = await doPost();
      if (response.status === 429) {
        const { retry_after } = await response.json().catch(() => ({ retry_after: 1 })) as { retry_after: number };
        const ms = Math.ceil((retry_after ?? 1) * 1000);
        console.warn(`Discord rate limited. Retrying after ${ms}ms...`);
        await new Promise((r) => setTimeout(r, ms));
        response = await doPost();
      }

      if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        console.error(`Failed to send Discord message: ${response.status} ${response.statusText} ${errBody}`);
        throw new Error(`Discord API error: ${response.status} ${response.statusText}`);
      }

      const resJson = await response.json().catch(() => null) as { id?: string } | null;
      console.log(
        `Discord notification sent successfully${
          resJson?.id ? ` (message id: ${resJson.id})` : ''
        }`
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
