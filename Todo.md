1. Instance setting configuration - Done
2. Database Migration: Need a new table `slack_channel_links` - Done
3. Go Models & Store: Appended Slack models to `model/integration.go` and `store/integration.go` - Done
4. Slack OAuth & Install Handler: Create `oauth/slack.go` and update `handler/integration.go` so users can authenticate with Slack - Done
5. Slack Notification Logic: Build a Slack client and wire it up with the background queue (RabbitMQ) to send channel messages - Done
6. Web UI for Channels: Add Slack to `IntegrationsSection.tsx` and create `SlackChannelSettingsModal.tsx` for linking projects to channels - Done