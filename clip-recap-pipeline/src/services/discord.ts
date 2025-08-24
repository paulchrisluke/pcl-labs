import { Environment, JudgeResult } from '../types';

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
      color: judgeResult.overall >= 80 ? 0x00ff00 : 0xffa500, // Green if good, orange if needs review
      fields: [
        {
          name: '📊 Quality Score',
          value: `${judgeResult.overall}/100`,
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

    const response = await fetch(
      `https://discord.com/api/v10/channels/${this.env.DISCORD_REVIEW_CHANNEL_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bot ${this.env.DISCORD_BOT_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      }
    );

    if (!response.ok) {
      console.error(`Failed to send Discord message: ${response.statusText}`);
      throw new Error(`Discord API error: ${response.statusText}`);
    }

    console.log('Discord notification sent successfully');
  }
}
