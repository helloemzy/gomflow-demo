import { Router, Request, Response } from 'express';
import { 
  InteractionType, 
  InteractionResponseType,
  CommandInteraction,
  ButtonInteraction,
  ModalSubmitInteraction,
  ApplicationCommandType,
} from 'discord.js';
import { verifyDiscordSignature } from '../middleware/auth';
import { logger } from '../utils/logger';
import { config } from '../config';

const router = Router();

// Apply Discord signature verification to all interaction routes
router.use(verifyDiscordSignature(config.discord.publicKey));

// Main Discord interactions endpoint
router.post('/', async (req: Request, res: Response) => {
  try {
    const interaction = req.body;
    const discordBot = req.app.locals.discordBot;

    if (!discordBot) {
      logger.error('Discord bot not initialized');
      return res.status(503).json({ error: 'Service unavailable' });
    }

    // Handle ping (Discord will send this to verify the endpoint)
    if (interaction.type === InteractionType.Ping) {
      return res.json({ type: InteractionResponseType.Pong });
    }

    // Handle application commands
    if (interaction.type === InteractionType.ApplicationCommand) {
      const response = await handleApplicationCommand(interaction, discordBot);
      return res.json(response);
    }

    // Handle button interactions
    if (interaction.type === InteractionType.MessageComponent) {
      const response = await handleMessageComponent(interaction, discordBot);
      return res.json(response);
    }

    // Handle modal submissions
    if (interaction.type === InteractionType.ModalSubmit) {
      const response = await handleModalSubmit(interaction, discordBot);
      return res.json(response);
    }

    // Handle autocomplete
    if (interaction.type === InteractionType.ApplicationCommandAutocomplete) {
      const response = await handleAutocomplete(interaction, discordBot);
      return res.json(response);
    }

    // Unknown interaction type
    logger.warn('Unknown interaction type:', interaction.type);
    return res.json({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: 'Unknown interaction type',
        flags: 64, // Ephemeral
      },
    });
  } catch (error) {
    logger.error('Error handling interaction:', error);
    return res.json({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: 'An error occurred while processing your request.',
        flags: 64, // Ephemeral
      },
    });
  }
});

// Handle application commands (slash commands)
async function handleApplicationCommand(interaction: any, discordBot: any) {
  const { data: { name, options }, user, member, guild_id } = interaction;

  // Defer the response for longer processing
  const deferredResponse = {
    type: InteractionResponseType.DeferredChannelMessageWithSource,
  };

  // Process the command in the background
  setImmediate(async () => {
    try {
      let response;

      switch (name) {
        case 'order':
          response = await discordBot.handleOrderCommand(interaction);
          break;
        case 'submit':
          response = await discordBot.handleSubmitCommand(interaction);
          break;
        case 'pay':
          response = await discordBot.handlePayCommand(interaction);
          break;
        case 'status':
          response = await discordBot.handleStatusCommand(interaction);
          break;
        case 'manage':
          response = await discordBot.handleManageCommand(interaction);
          break;
        case 'notifications':
          response = await discordBot.handleNotificationsCommand(interaction);
          break;
        case 'help':
          response = await discordBot.handleHelpCommand(interaction);
          break;
        default:
          response = {
            content: 'Unknown command',
            flags: 64,
          };
      }

      // Send the follow-up message
      await discordBot.sendFollowUpMessage(interaction.id, interaction.token, response);
    } catch (error) {
      logger.error('Error processing command:', error);
      await discordBot.sendFollowUpMessage(interaction.id, interaction.token, {
        content: 'An error occurred while processing your command.',
        flags: 64,
      });
    }
  });

  return deferredResponse;
}

// Handle message components (buttons, select menus)
async function handleMessageComponent(interaction: any, discordBot: any) {
  const { data: { custom_id, values }, user, message } = interaction;

  // Defer update for processing
  const deferredResponse = {
    type: InteractionResponseType.DeferredMessageUpdate,
  };

  // Process the component interaction in the background
  setImmediate(async () => {
    try {
      let response;

      // Parse custom_id to determine action
      const [action, ...params] = custom_id.split(':');

      switch (action) {
        case 'order_list_page':
          response = await discordBot.handleOrderListPagination(interaction, params[0]);
          break;
        case 'order_details':
          response = await discordBot.handleOrderDetailsButton(interaction, params[0]);
          break;
        case 'submit_order':
          response = await discordBot.handleSubmitOrderButton(interaction, params[0]);
          break;
        case 'confirm_payment':
          response = await discordBot.handleConfirmPaymentButton(interaction, params[0]);
          break;
        case 'reject_payment':
          response = await discordBot.handleRejectPaymentButton(interaction, params[0]);
          break;
        default:
          response = {
            content: 'Unknown button action',
            flags: 64,
          };
      }

      // Update the message
      await discordBot.editMessage(interaction.message.id, interaction.token, response);
    } catch (error) {
      logger.error('Error processing component interaction:', error);
    }
  });

  return deferredResponse;
}

// Handle modal submissions
async function handleModalSubmit(interaction: any, discordBot: any) {
  const { data: { custom_id, components }, user } = interaction;

  // Defer the response
  const deferredResponse = {
    type: InteractionResponseType.DeferredChannelMessageWithSource,
    data: {
      flags: 64, // Ephemeral
    },
  };

  // Process the modal submission in the background
  setImmediate(async () => {
    try {
      let response;

      // Parse custom_id to determine modal type
      const [modalType, ...params] = custom_id.split(':');

      switch (modalType) {
        case 'submit_order':
          response = await discordBot.handleSubmitOrderModal(interaction, params[0]);
          break;
        case 'create_order':
          response = await discordBot.handleCreateOrderModal(interaction);
          break;
        default:
          response = {
            content: 'Unknown modal type',
            flags: 64,
          };
      }

      // Send the follow-up message
      await discordBot.sendFollowUpMessage(interaction.id, interaction.token, response);
    } catch (error) {
      logger.error('Error processing modal submission:', error);
      await discordBot.sendFollowUpMessage(interaction.id, interaction.token, {
        content: 'An error occurred while processing your submission.',
        flags: 64,
      });
    }
  });

  return deferredResponse;
}

// Handle autocomplete
async function handleAutocomplete(interaction: any, discordBot: any) {
  const { data: { name, options } } = interaction;

  try {
    let choices = [];

    // Get the focused option
    const focusedOption = options.find((opt: any) => opt.focused);
    
    if (focusedOption) {
      switch (name) {
        case 'order':
          if (focusedOption.name === 'slug') {
            choices = await discordBot.getOrderAutocompleteChoices(focusedOption.value);
          }
          break;
        case 'submit':
          if (focusedOption.name === 'order') {
            choices = await discordBot.getOrderAutocompleteChoices(focusedOption.value);
          }
          break;
      }
    }

    return {
      type: InteractionResponseType.ApplicationCommandAutocompleteResult,
      data: {
        choices: choices.slice(0, 25), // Discord limit
      },
    };
  } catch (error) {
    logger.error('Error handling autocomplete:', error);
    return {
      type: InteractionResponseType.ApplicationCommandAutocompleteResult,
      data: {
        choices: [],
      },
    };
  }
}

export default router;