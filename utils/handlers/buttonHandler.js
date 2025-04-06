const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
require('dotenv').config();
const allyVerificationHandler = require('./allyVerificationHandler');
const recruitmentHandler = require('./recruitmentHandler');
const ticketJoinHandler = require('./ticketJoinHandler');
const ticketCloseHandler = require('./ticketCloseHandler');

module.exports = (client) => {
  client.on('interactionCreate', async (interaction) => {
    if (interaction.isButton()) {
      const customId = interaction.customId;
      const user = interaction.user;
      const channel = interaction.channel;
      const threadId = channel?.id;
      const requiredRoles = process.env.requiredRoles ? process.env.requiredRoles.split(',') : []; 
      const memberRoles = interaction.member?.roles.cache || new Map();
      const hasPermission = requiredRoles.length === 0 || requiredRoles.some(roleId => memberRoles.has(roleId));

      try {
        const [prefix, action, identifier] = customId.split('_');

        // Fetch the original message tied to the button interaction
        const message = await interaction.message.fetch();
        const messageId = message.id;

        if (prefix === 'ticket') {
          switch (action) {
            case 'join':
              if (!hasPermission) {
                return interaction.reply({ 
                  content: '❌ You do not have permission to run this!', 
                  ephemeral: true,
                });
              }
              await ticketJoinHandler(interaction, identifier, messageId, threadId);
              return;

            case 'close':
              if (!hasPermission) {
                return interaction.reply({ 
                  content: '❌ You do not have permission to run this!', 
                  ephemeral: true,
                });
              }

              // Create and show the modal
              const modal = new ModalBuilder()
                .setCustomId(`ticket_close_modal_${identifier}`)
                .setTitle('Close Ticket Reason');

              const reasonInput = new TextInputBuilder()
                .setCustomId('reason')
                .setLabel('Reason for Closing')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Enter the reason for closing this ticket...')
                .setRequired(true);

              const actionRow = new ActionRowBuilder().addComponents(reasonInput);
              modal.addComponents(actionRow);

              await interaction.showModal(modal); // Show modal
              return;

            default:
              console.error(`Unknown action "${action}" for ticket.`);
              break;
          }
        }

        // Handle other button interactions
        switch (customId) {
          case 'start_ally_verification':
            await allyVerificationHandler(interaction, user, channel, threadId);
            break;

          case 'start_recruitment':
            await recruitmentHandler(interaction, user, channel, threadId);
            break;

          default:
            console.error(`Unknown button custom ID "${customId}".`);
            break;
        }
      } catch (error) {
        console.error('Error handling button interaction:', error);
        await interaction.reply({
          content: 'An error occurred while processing this button interaction.',
          ephemeral: true,
        });
      }
    }

    // Handle modal submissions
    if (interaction.isModalSubmit()) {
      try {
        const customId = interaction.customId;

        if (customId.startsWith('ticket_close_modal_')) {
          const identifier = customId.split('_')[3];
          const reason = interaction.fields.getTextInputValue('reason');

          const channel = interaction.channel;
          const threadId = channel?.id;
          const messageId = interaction.message?.id;

          // Defer the reply to allow processing
          await interaction.deferReply({ ephemeral: true });

          // Process the ticket closure
          await ticketCloseHandler(interaction, identifier, messageId, threadId, reason);

          // Acknowledge closure
          if (!interaction.replied) {
            await interaction.followUp({
              content: `Ticket has been successfully closed with reason: "${reason}".`,
              ephemeral: true,
            });
          }
        }
      } catch (error) {
        console.error('Error handling modal submission:', error);
        await interaction.reply({
          content: 'An error occurred while processing the modal submission.',
          ephemeral: true,
        });
      }
    }
  });
};
