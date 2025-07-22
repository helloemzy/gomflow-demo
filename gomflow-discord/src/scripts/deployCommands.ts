#!/usr/bin/env node

import { REST, Routes, SlashCommandBuilder } from 'discord.js'
import { Config } from '@/config'
import { logger } from '@/utils/logger'

/**
 * Deploy Discord slash commands
 */
async function deployCommands(): Promise<void> {
  try {
    logger.info('Deploying Discord slash commands...')

    const commands = [
      // /order command with subcommands
      new SlashCommandBuilder()
        .setName('order')
        .setDescription('Manage group orders')
        .addSubcommand(subcommand =>
          subcommand
            .setName('list')
            .setDescription('List all active group orders')
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('view')
            .setDescription('View details of a specific order')
            .addStringOption(option =>
              option
                .setName('order_id')
                .setDescription('Order ID to view')
                .setRequired(true)
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('create')
            .setDescription('Create a new group order (GOM only)')
            .addStringOption(option =>
              option
                .setName('title')
                .setDescription('Order title')
                .setRequired(true)
                .setMaxLength(200)
            )
            .addNumberOption(option =>
              option
                .setName('price')
                .setDescription('Price per item')
                .setRequired(true)
                .setMinValue(0.01)
            )
            .addStringOption(option =>
              option
                .setName('currency')
                .setDescription('Currency')
                .setRequired(true)
                .addChoices(
                  { name: 'PHP (Philippines)', value: 'PHP' },
                  { name: 'MYR (Malaysia)', value: 'MYR' }
                )
            )
            .addStringOption(option =>
              option
                .setName('deadline')
                .setDescription('Order deadline (YYYY-MM-DD)')
                .setRequired(true)
            )
            .addStringOption(option =>
              option
                .setName('description')
                .setDescription('Order description')
                .setMaxLength(1000)
            )
        ),

      // /submit command
      new SlashCommandBuilder()
        .setName('submit')
        .setDescription('Submit an order for a group order')
        .addStringOption(option =>
          option
            .setName('order_id')
            .setDescription('Order ID to submit to')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('buyer_name')
            .setDescription('Your name')
            .setRequired(true)
            .setMaxLength(100)
        )
        .addIntegerOption(option =>
          option
            .setName('quantity')
            .setDescription('Quantity to order')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(99)
        )
        .addStringOption(option =>
          option
            .setName('phone')
            .setDescription('Your phone number')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('email')
            .setDescription('Your email address')
        ),

      // /pay command with subcommands
      new SlashCommandBuilder()
        .setName('pay')
        .setDescription('Upload payment screenshot or manage payments')
        .addSubcommand(subcommand =>
          subcommand
            .setName('screenshot')
            .setDescription('Upload payment screenshot for verification')
            .addAttachmentOption(option =>
              option
                .setName('screenshot')
                .setDescription('Payment screenshot image')
                .setRequired(true)
            )
            .addStringOption(option =>
              option
                .setName('submission_id')
                .setDescription('Your submission ID (optional)')
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('status')
            .setDescription('Check payment status')
            .addStringOption(option =>
              option
                .setName('submission_id')
                .setDescription('Your submission ID')
                .setRequired(true)
            )
        ),

      // /status command
      new SlashCommandBuilder()
        .setName('status')
        .setDescription('Check order or submission status')
        .addStringOption(option =>
          option
            .setName('id')
            .setDescription('Order ID or Submission ID')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('type')
            .setDescription('Type of status check')
            .setRequired(true)
            .addChoices(
              { name: 'Order Status', value: 'order' },
              { name: 'Submission Status', value: 'submission' }
            )
        ),

      // /manage command (GOM only)
      new SlashCommandBuilder()
        .setName('manage')
        .setDescription('GOM management commands')
        .addSubcommand(subcommand =>
          subcommand
            .setName('dashboard')
            .setDescription('View GOM dashboard')
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('analytics')
            .setDescription('View order analytics')
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('notify')
            .setDescription('Send notification to order participants')
            .addStringOption(option =>
              option
                .setName('order_id')
                .setDescription('Order ID')
                .setRequired(true)
            )
            .addStringOption(option =>
              option
                .setName('message')
                .setDescription('Notification message')
                .setRequired(true)
                .setMaxLength(1000)
            )
        ),

      // /help command
      new SlashCommandBuilder()
        .setName('help')
        .setDescription('Get help with GOMFLOW commands')
        .addStringOption(option =>
          option
            .setName('command')
            .setDescription('Specific command to get help for')
            .addChoices(
              { name: 'Order Management', value: 'order' },
              { name: 'Submit Orders', value: 'submit' },
              { name: 'Payment Processing', value: 'pay' },
              { name: 'Status Checking', value: 'status' },
              { name: 'GOM Management', value: 'manage' }
            )
        )
    ]

    const rest = new REST().setToken(Config.DISCORD_BOT_TOKEN)

    logger.info(`Started refreshing ${commands.length} application (/) commands.`)

    // Deploy commands globally
    const data = await rest.put(
      Routes.applicationCommands(Config.DISCORD_CLIENT_ID),
      { body: commands.map(command => command.toJSON()) }
    ) as any[]

    logger.info(`Successfully reloaded ${data.length} application (/) commands.`)

  } catch (error: any) {
    logger.error('Failed to deploy commands', {
      error: error.message,
      stack: error.stack
    })
    process.exit(1)
  }
}

// Run if called directly
if (require.main === module) {
  deployCommands().then(() => {
    logger.info('Command deployment completed')
    process.exit(0)
  }).catch((error) => {
    logger.error('Command deployment failed', { error: error.message })
    process.exit(1)
  })
}

export default deployCommands