export class SlackNotifier {
  private webhookUrl: string;

  constructor() {
    this.webhookUrl = process.env.SLACK_WEBHOOK_URL || '';
  }

  async notify(message: string, details?: string): Promise<void> {
    if (!this.webhookUrl) {
      console.log('Slack webhook URL not configured, skipping notification');
      return;
    }

    try {
      const payload = {
        text: message,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: message
            }
          }
        ]
      };

      if (details) {
        payload.blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `\`\`\`${details}\`\`\``
          }
        });
      }

      await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

    } catch (error) {
      console.error('Failed to send Slack notification:', error);
    }
  }
}
